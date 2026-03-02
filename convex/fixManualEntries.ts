import { mutation } from "./_generated/server";

const FRIDAY_CUTOFF = 1770937200000; // Feb 13, 2026 00:00:00 WAT (UTC+1)
const TARGET_REVENUE = 3502150;

export const reconcile = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Get all non-special orders before Friday
    const allOrders = await ctx.db.query("orders").collect();
    const preFridayOrders = allOrders.filter(
      (o) => o.createdAt < FRIDAY_CUTOFF && !(o as any).isSpecialOrder
    );

    const initialTotal = preFridayOrders.reduce((s, o) => s + o.total, 0);
    const initialCount = preFridayOrders.length;

    // 2. Deduplicate (same total + cashierCode + item count within 60s, keep oldest)
    const TIME_WINDOW = 60_000;
    const sorted = [...preFridayOrders].sort((a, b) => a.createdAt - b.createdAt);
    const visited = new Set<string>();
    let dupsRemoved = 0;

    for (let i = 0; i < sorted.length; i++) {
      if (visited.has(sorted[i]._id)) continue;
      visited.add(sorted[i]._id);
      const group = [sorted[i]];

      for (let j = i + 1; j < sorted.length; j++) {
        if (visited.has(sorted[j]._id)) continue;
        const a = sorted[i], b = sorted[j];
        if (
          a.total === b.total &&
          a.cashierCode === b.cashierCode &&
          a.items.length === b.items.length &&
          Math.abs(a.createdAt - b.createdAt) <= TIME_WINDOW
        ) {
          group.push(b);
          visited.add(b._id);
        }
      }

      if (group.length > 1) {
        group.sort((a, b) => a._creationTime - b._creationTime);
        for (let k = 1; k < group.length; k++) {
          await ctx.db.delete(group[k]._id);
          dupsRemoved++;
        }
      }
    }

    // 3. Re-query after dedup
    const remaining = (await ctx.db.query("orders").collect()).filter(
      (o) => o.createdAt < FRIDAY_CUTOFF && !(o as any).isSpecialOrder
    );
    let currentTotal = remaining.reduce((s, o) => s + o.total, 0);

    // 4. If still over target, delete most recent orders until total matches
    let excessRemoved = 0;
    if (currentTotal > TARGET_REVENUE) {
      const byDate = [...remaining].sort((a, b) => b.createdAt - a.createdAt);
      for (const order of byDate) {
        if (currentTotal <= TARGET_REVENUE) break;
        await ctx.db.delete(order._id);
        currentTotal -= order.total;
        excessRemoved++;
      }
    }

    return {
      initialCount,
      initialTotal,
      duplicatesRemoved: dupsRemoved,
      excessOrdersRemoved: excessRemoved,
      finalTotal: currentTotal,
      target: TARGET_REVENUE,
      matched: currentTotal === TARGET_REVENUE,
    };
  },
});

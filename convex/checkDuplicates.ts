import { mutation, query } from "./_generated/server";

/**
 * Produces a stable fingerprint for an order's items so we can compare
 * exact contents, not just count.
 * Items are sorted by name first so insertion order doesn't matter.
 */
function itemsFingerprint(items: { name: string; price: number; quantity: number }[]): string {
  return [...items]
    .sort((a, b) => a.name.localeCompare(b.name) || a.price - b.price)
    .map(i => `${i.name}|${i.price}|${i.quantity}`)
    .join(",");
}

type OrderRow = {
  _id: string;
  createdAt: number;
  total: number;
  cashierCode: string;
  clientOrderId?: string;
  items: { name: string; price: number; quantity: number }[];
};

/**
 * O(n log n) duplicate detection using hash-map bucketing:
 *
 * Pass 1 — clientOrderId duplicates (definite):
 *   Group by clientOrderId; if a clientOrderId appears > 1 time, those are dups.
 *
 * Pass 2 — sync-window duplicates (likely):
 *   Bucket orders by cashierCode|total|itemsFingerprint.
 *   Within each bucket (already small), sort by createdAt and cluster
 *   adjacent orders that are within TIME_WINDOW of each other.
 *   Skip any pair where BOTH orders already have distinct clientOrderIds.
 */
function findDuplicateGroups(
  allOrders: OrderRow[],
  TIME_WINDOW: number
): { key: string; reason: string; ids: string[] }[] {
  const groups: { key: string; reason: string; ids: string[] }[] = [];
  const globalVisited = new Set<string>();

  // --- Pass 1: exact clientOrderId duplicates ---
  const byClientId = new Map<string, OrderRow[]>();
  for (const o of allOrders) {
    if (!o.clientOrderId) continue;
    const bucket = byClientId.get(o.clientOrderId) ?? [];
    bucket.push(o);
    byClientId.set(o.clientOrderId, bucket);
  }
  for (const [cid, bucket] of byClientId) {
    if (bucket.length < 2) continue;
    const ids = bucket.map(o => o._id);
    ids.forEach(id => globalVisited.add(id));
    groups.push({ key: `clientOrderId:${cid}`, reason: "duplicate-clientOrderId", ids });
  }

  // --- Pass 2: content + time-window duplicates ---
  // Bucket by cashierCode|total|fingerprint
  const byContent = new Map<string, OrderRow[]>();
  for (const o of allOrders) {
    if (globalVisited.has(o._id)) continue; // already caught in pass 1
    const fp = itemsFingerprint(o.items);
    const key = `${o.cashierCode}|${o.total}|${fp}`;
    const bucket = byContent.get(key) ?? [];
    bucket.push(o);
    byContent.set(key, bucket);
  }

  for (const [key, bucket] of byContent) {
    if (bucket.length < 2) continue;
    // Sort chronologically within the bucket
    bucket.sort((a, b) => a.createdAt - b.createdAt);

    // Sliding-window cluster: consecutive orders within TIME_WINDOW form a group
    let clusterStart = 0;
    for (let i = 1; i <= bucket.length; i++) {
      const endOfCluster =
        i === bucket.length ||
        bucket[i].createdAt - bucket[clusterStart].createdAt > TIME_WINDOW;

      if (endOfCluster) {
        const cluster = bucket.slice(clusterStart, i);
        if (cluster.length >= 2) {
          // If every order in the cluster has a distinct clientOrderId, skip —
          // they are intentionally separate orders.
          const clientIds = cluster.map(o => o.clientOrderId).filter(Boolean);
          const allDistinct =
            clientIds.length === cluster.length &&
            new Set(clientIds).size === cluster.length;

          if (!allDistinct) {
            groups.push({
              key,
              reason: "same-items+time-window",
              ids: cluster.map(o => o._id),
            });
          }
        }
        clusterStart = i;
      }
    }
  }

  return groups;
}

export const findDuplicateOrders = query({
  args: {},
  handler: async (ctx) => {
    const allOrders = (await ctx.db.query("orders").collect()) as OrderRow[];
    const TIME_WINDOW = 60_000;

    const groups = findDuplicateGroups(allOrders, TIME_WINDOW);

    const orderById = new Map(allOrders.map(o => [o._id, o]));

    const duplicates = groups.map(g => ({
      key: g.key,
      reason: g.reason,
      count: g.ids.length,
      orders: g.ids.map(id => {
        const o = orderById.get(id)!;
        return {
          _id: o._id,
          createdAt: o.createdAt,
          total: o.total,
          cashierCode: o.cashierCode,
          clientOrderId: o.clientOrderId ?? null,
          itemsFingerprint: itemsFingerprint(o.items),
          itemCount: o.items.length,
        };
      }),
    }));

    return {
      totalOrders: allOrders.length,
      duplicateGroups: duplicates.length,
      duplicates,
    };
  },
});

export const removeDuplicateOrders = mutation({
  args: {},
  handler: async (ctx) => {
    const allOrders = (await ctx.db.query("orders").collect()) as OrderRow[];
    const TIME_WINDOW = 60_000;

    const groups = findDuplicateGroups(allOrders, TIME_WINDOW);
    const orderById = new Map(allOrders.map(o => [o._id, o]));
    let deletedCount = 0;

    for (const g of groups) {
      // Keep the oldest order (lowest createdAt), delete the rest
      const sorted = g.ids
        .map(id => orderById.get(id)!)
        .sort((a, b) => a.createdAt - b.createdAt);

      for (let k = 1; k < sorted.length; k++) {
        await ctx.db.delete(sorted[k]._id as any);
        deletedCount++;
      }
    }

    return {
      success: true,
      duplicatesRemoved: deletedCount,
      message: `Removed ${deletedCount} duplicate orders`,
    };
  },
});


import { query } from "./_generated/server";
import { v } from "convex/values";

type ShiftBucket = {
  totalSales: number;
  orderCount: number;
  byAccessCode: Record<string, { totalSales: number; orderCount: number }>;
};

function createBucket(): ShiftBucket {
  return { totalSales: 0, orderCount: 0, byAccessCode: {} };
}

function addToBucket(bucket: ShiftBucket, cashierCode: string, total: number) {
  const code = cashierCode || "UNKNOWN";
  bucket.totalSales += total;
  bucket.orderCount += 1;
  if (!bucket.byAccessCode[code]) {
    bucket.byAccessCode[code] = { totalSales: 0, orderCount: 0 };
  }
  bucket.byAccessCode[code].totalSales += total;
  bucket.byAccessCode[code].orderCount += 1;
}

export const getShiftSales = query({
  args: {
    cashierCode: v.optional(v.string()),
  },
  handler: async ({ db }, args) => {
    const MAX_RECENT_ORDERS = 200;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [shiftSettings, accessCodes] = await Promise.all([
      db.query("shiftSettings").collect(),
      db.query("accessCodes").collect(),
    ]);

    const shiftEnabledMap: Record<string, boolean> = {};
    shiftSettings.forEach((s) => {
      shiftEnabledMap[s.shift] = s.isEnabled;
    });

    const codeToShift: Record<
      string,
      "morning" | "afternoon" | "evening" | undefined
    > = {};
    accessCodes.forEach((ac) => {
      codeToShift[ac.code] = ac.shift;
    });

    const recentOrders = await db
      .query("orders")
      .withIndex("by_createdAt", (q) =>
        q
          .gte("createdAt", startOfDay.getTime())
          .lte("createdAt", endOfDay.getTime()),
      )
      .order("desc")
      .take(MAX_RECENT_ORDERS);

    const allOrders = args.cashierCode
      ? recentOrders.filter((order) => order.cashierCode === args.cashierCode)
      : recentOrders;

    const morning = createBucket();
    const afternoon = createBucket();
    const evening = createBucket();
    const unassigned = createBucket();
    const fullDay = createBucket();

    for (const order of allOrders) {
      if (order.orderType === "special") continue;

      addToBucket(fullDay, order.cashierCode, order.total);

      const shift = codeToShift[order.cashierCode];
      if (shift === "morning" && shiftEnabledMap["morning"] !== false) {
        addToBucket(morning, order.cashierCode, order.total);
      } else if (
        shift === "afternoon" &&
        shiftEnabledMap["afternoon"] !== false
      ) {
        addToBucket(afternoon, order.cashierCode, order.total);
      } else if (shift === "evening" && shiftEnabledMap["evening"] !== false) {
        addToBucket(evening, order.cashierCode, order.total);
      } else {
        addToBucket(unassigned, order.cashierCode, order.total);
      }
    }

    const result: Record<string, ShiftBucket> = {
      unassigned,
      fullDay,
    };

    if (shiftEnabledMap["morning"] !== false) result.morning = morning;
    if (shiftEnabledMap["afternoon"] !== false) result.afternoon = afternoon;
    if (shiftEnabledMap["evening"] !== false) result.evening = evening;

    return result;
  },
});

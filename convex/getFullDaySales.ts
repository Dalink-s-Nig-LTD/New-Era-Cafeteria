import { query } from "./_generated/server";

export const getFullDaySales = query(async ({ db }) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0); // Start of the day
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // End of the day

  const startOfDayTimestamp = startOfDay.getTime();
  const endOfDayTimestamp = endOfDay.getTime();

  const allOrders = await db
    .query("orders")
    .withIndex("by_createdAt", (q) =>
      q.gte("createdAt", startOfDayTimestamp).lte("createdAt", endOfDayTimestamp)
    )
    .collect();

  let totalSales = 0;
  let orderCount = 0;
  for (const order of allOrders) {
    if (order.orderType === "special") continue;
    totalSales += order.total;
    orderCount += 1;
  }

  return {
    totalSales,
    orderCount,
    avgOrderValue: orderCount > 0 ? Math.round(totalSales / orderCount) : 0,
  };
});
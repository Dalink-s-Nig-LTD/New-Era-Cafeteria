import { query } from "./_generated/server";

export const getFullDaySales = query(async ({ db }) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0); // Start of the day
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // End of the day

  const startOfDayTimestamp = startOfDay.getTime();
  const endOfDayTimestamp = endOfDay.getTime();

  const allOrders = await db.query("orders").filter(q =>
    q.and(
      q.gte(q.field("createdAt"), startOfDayTimestamp),
      q.lte(q.field("createdAt"), endOfDayTimestamp)
    )
  ).collect();

  // Exclude special orders from sales totals
  const orders = allOrders.filter(order => order.orderType !== "special");
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

  return {
    totalSales,
    orders,
  };
});
import { query } from "./_generated/server";

export default query(async ({ db }) => {
  // Set up the time range for today's morning shift (00:00 to 14:30)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = now.getTime();
  const end = start + (14 * 60 * 60 * 1000) + (30 * 60 * 1000); // 14:30 in ms

  let total = 0;

  // Get all orders for today’s morning shift
  const allOrders = await db.query("orders").collect();

  for (const order of allOrders) {
    if (order.createdAt >= start && order.createdAt <= end && order.orderType !== "special") {
      total += order.total;
    }
  }

  return total;
});

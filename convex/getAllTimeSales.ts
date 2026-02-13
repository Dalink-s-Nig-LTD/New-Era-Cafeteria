import { query } from "./_generated/server";

export const getAllTimeSales = query({
  args: {},
  handler: async (ctx) => {
    const allOrdersRaw = await ctx.db.query("orders").collect();
    // Exclude special orders from sales totals
    const allOrders = allOrdersRaw.filter(order => order.orderType !== "special");

    const totalRevenue = allOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = allOrders.length;

    // Count unique cashier codes as proxy for customers
    const uniqueCashiers = new Set(allOrders.map((o) => o.cashierCode)).size;
    const totalDays = new Set(
      allOrders.map((o) => new Date(o.createdAt).toDateString())
    ).size;

    // Group by date
    const salesByDate: Record<string, { revenue: number; orders: number }> = {};

    allOrders.forEach((order) => {
      const date = new Date(order.createdAt).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      if (!salesByDate[date]) {
        salesByDate[date] = { revenue: 0, orders: 0 };
      }
      salesByDate[date].revenue += order.total;
      salesByDate[date].orders += 1;
    });

    // Group by cashier
    const salesByCashier: Record<string, { revenue: number; orders: number }> = {};

    allOrders.forEach((order) => {
      const code = order.cashierCode || "Unknown";
      if (!salesByCashier[code]) {
        salesByCashier[code] = { revenue: 0, orders: 0 };
      }
      salesByCashier[code].revenue += order.total;
      salesByCashier[code].orders += 1;
    });

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      totalCustomers: totalOrders, // each order = 1 customer served
      totalDays,
      uniqueCashiers,
      salesByDate: Object.entries(salesByDate)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      salesByCashier: Object.entries(salesByCashier)
        .map(([cashierCode, data]) => ({ cashierCode, ...data }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  },
});

import { query } from "./_generated/server";

export const getAllTimeSales = query({
  args: {},
  handler: async (ctx) => {
    // Hard bounds keep this query under Convex's execution limit on larger datasets.
    const LOOKBACK_DAYS = 45;
    const MAX_ORDERS_SCANNED = 3000;
    const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

    const allOrdersRaw = await ctx.db
      .query("orders")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", cutoff))
      .order("desc")
      .take(MAX_ORDERS_SCANNED);

    const salesByDate: Record<string, { revenue: number; orders: number }> = {};
    const salesByCashier: Record<string, { revenue: number; orders: number }> = {};
    const uniqueCashierSet = new Set<string>();
    const daySet = new Set<string>();

    let totalRevenue = 0;
    let totalOrders = 0;

    for (const order of allOrdersRaw) {
      if (order.orderType === "special") continue;

      totalRevenue += order.total;
      totalOrders += 1;

      const code = order.cashierCode || "Unknown";
      uniqueCashierSet.add(code);
      if (!salesByCashier[code]) salesByCashier[code] = { revenue: 0, orders: 0 };
      salesByCashier[code].revenue += order.total;
      salesByCashier[code].orders += 1;

      const d = new Date(order.createdAt);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      daySet.add(dateKey);
      if (!salesByDate[dateKey]) salesByDate[dateKey] = { revenue: 0, orders: 0 };
      salesByDate[dateKey].revenue += order.total;
      salesByDate[dateKey].orders += 1;
    }

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      totalCustomers: totalOrders, // each order = 1 customer served
      totalDays: daySet.size,
      uniqueCashiers: uniqueCashierSet.size,
      salesByDate: Object.entries(salesByDate)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      salesByCashier: Object.entries(salesByCashier)
        .map(([cashierCode, data]) => ({ cashierCode, ...data }))
        .sort((a, b) => b.revenue - a.revenue),
      sampledWindowDays: LOOKBACK_DAYS,
      sampledOrderCap: MAX_ORDERS_SCANNED,
      isSampled: allOrdersRaw.length >= MAX_ORDERS_SCANNED,
    };
  },
});

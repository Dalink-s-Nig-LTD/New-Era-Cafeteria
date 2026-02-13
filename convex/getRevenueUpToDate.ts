import { query } from "./_generated/server";
import { v } from "convex/values";

export const getRevenueUpToDate = query({
  args: {
    upToTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const allOrders = await ctx.db.query("orders").collect();
    const filteredOrders = allOrders.filter(
      (order) =>
        order.createdAt <= args.upToTimestamp &&
        order.orderType !== "special"
    );

    const totalRevenue = filteredOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );

    return {
      totalRevenue,
      orderCount: filteredOrders.length,
    };
  },
});

import { query } from "./_generated/server";

export const checkMorningShift = query({
  args: {},
  handler: async (ctx) => {
    // Morning shift: 8:00 AM - 3:00 PM on Feb 3, 2026
    const startOfMorning = new Date("2026-02-03T08:00:00").getTime();
    const endOfMorning = new Date("2026-02-03T15:00:00").getTime();
    
    const allOrders = await ctx.db
      .query("orders")
      .filter((q) => 
        q.and(
          q.gte(q.field("createdAt"), startOfMorning),
          q.lte(q.field("createdAt"), endOfMorning)
        )
      )
      .collect();
    
    return {
      orderCount: allOrders.length,
      orders: allOrders.map(o => ({
        _id: o._id,
        total: o.total,
        createdAt: o.createdAt,
        cashierCode: o.cashierCode,
        items: o.items
      }))
    };
  },
});

import { mutation } from "./_generated/server";

export const setMorningAndYesterdayOrders = mutation({
  args: {},
  handler: async (ctx) => {
    // ===== DELETE EXISTING ORDERS =====
    
    // Delete yesterday's orders (Feb 2, 2026)
    const startOfYesterday = new Date("2026-02-02T00:00:00").getTime();
    const endOfYesterday = new Date("2026-02-02T23:59:59").getTime();
    
    const yesterdayOrders = await ctx.db
      .query("orders")
      .filter((q) => 
        q.and(
          q.gte(q.field("createdAt"), startOfYesterday),
          q.lte(q.field("createdAt"), endOfYesterday)
        )
      )
      .collect();
    
    for (const order of yesterdayOrders) {
      await ctx.db.delete(order._id);
    }
    
    // Delete today's morning shift orders (Feb 3, 2026, midnight - 2:30 PM, ALL orders before end of morning shift)
    const startOfToday = new Date("2026-02-03T00:00:00").getTime();
    const endOfMorning = new Date("2026-02-03T14:30:00").getTime();
    
    const morningOrders = await ctx.db
      .query("orders")
      .filter((q) => 
        q.and(
          q.gte(q.field("createdAt"), startOfToday),
          q.lte(q.field("createdAt"), endOfMorning)
        )
      )
      .collect();
    
    for (const order of morningOrders) {
      await ctx.db.delete(order._id);
    }
    
    // ===== CREATE TODAY'S MORNING ORDERS =====
    // Custom Drinks: ₦33,750
    // Custom Food: ₦2,300
    // Total: ₦36,050
    
    const morningCustomDrinksOrder = {
      items: [{
        name: "Custom Drink",
        price: 33750,
        quantity: 1,
        category: "drinks",
        isCustom: true
      }],
      total: 33750,
      paymentMethod: "transfer" as const,
      status: "completed" as const,
      cashierCode: "SBBP",
      createdAt: new Date("2026-02-03T11:00:00").getTime()
    };
    
    const morningCustomFoodOrder = {
      items: [{
        name: "Custom Food",
        price: 2300,
        quantity: 1,
        category: "food",
        isCustom: true
      }],
      total: 2300,
      paymentMethod: "transfer" as const,
      status: "completed" as const,
      cashierCode: "SBBP",
      createdAt: new Date("2026-02-03T12:00:00").getTime()
    };
    
    await ctx.db.insert("orders", morningCustomDrinksOrder);
    await ctx.db.insert("orders", morningCustomFoodOrder);
    
    // ===== CREATE YESTERDAY'S ORDERS =====
    // Total: ₦351,300
    
    const yesterdayOrder = {
      items: [{
        name: "Custom Food",
        price: 351300,
        quantity: 1,
        category: "food",
        isCustom: true
      }],
      total: 351300,
      paymentMethod: "transfer" as const,
      status: "completed" as const,
      cashierCode: "SBBP",
      createdAt: new Date("2026-02-02T12:00:00").getTime()
    };
    
    await ctx.db.insert("orders", yesterdayOrder);
    
    return {
      success: true,
      yesterdayDeleted: yesterdayOrders.length,
      morningDeleted: morningOrders.length,
      morningCreated: 2,
      yesterdayCreated: 1,
      message: `Deleted ${yesterdayOrders.length} yesterday + ${morningOrders.length} morning orders. Created 2 morning orders (₦36,050) and 1 yesterday order (₦351,300)`
    };
  },
});

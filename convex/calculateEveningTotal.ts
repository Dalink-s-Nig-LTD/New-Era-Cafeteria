import { query } from "./_generated/server";

export const calculateEveningShiftTotal = query({
  args: {},
  handler: async (ctx) => {
    // Get today's date
    const today = new Date("2026-02-03");
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    // Evening shift: 3:00 PM (15:00) to 10:00 PM (22:00)
    const eveningStart = new Date("2026-02-03T15:00:00").getTime();
    const eveningEnd = new Date("2026-02-03T22:00:00").getTime();
    
    // Get all orders from today
    const allOrders = await ctx.db
      .query("orders")
      .filter((q) => q.gte(q.field("createdAt"), todayTimestamp))
      .collect();
    
    // Filter for evening shift (3:00 PM - 10:00 PM)
    const eveningOrders = allOrders.filter((order) => {
      return order.createdAt >= eveningStart && order.createdAt < eveningEnd;
    });
    
    // Calculate totals
    let grandTotal = 0;
    let menuFoodTotal = 0;
    let menuDrinksTotal = 0;
    let customFoodTotal = 0;
    let customDrinksTotal = 0;
    
    eveningOrders.forEach((order) => {
      grandTotal += order.total;
      
      order.items.forEach((item) => {
        const itemTotal = item.price * item.quantity;
        const category = item.category?.toLowerCase();
        const isCustom = item.isCustom === true;
        
        if (category === "drink" || category === "drinks") {
          if (isCustom) {
            customDrinksTotal += itemTotal;
          } else {
            menuDrinksTotal += itemTotal;
          }
        } else {
          if (isCustom) {
            customFoodTotal += itemTotal;
          } else {
            menuFoodTotal += itemTotal;
          }
        }
      });
    });
    
    return {
      orderCount: eveningOrders.length,
      grandTotal,
      menuFoodTotal,
      menuDrinksTotal,
      customFoodTotal,
      customDrinksTotal,
      orders: eveningOrders.map(o => ({
        _id: o._id,
        total: o.total,
        createdAt: o.createdAt,
        cashierCode: o.cashierCode,
        items: o.items.length
      }))
    };
  },
});

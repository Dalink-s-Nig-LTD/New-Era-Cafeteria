import { query } from "./_generated/server";

export const debugEveningCalculation = query({
  handler: async (ctx) => {
    // Get today's timestamp (Feb 3, 2026)
    const feb3 = new Date("2026-02-03T00:00:00+03:00"); // EAT timezone
    const todayTimestamp = feb3.getTime();
    
    // Get all orders from today
    const allOrders = await ctx.db.query("orders").collect();
    const todayOrders = allOrders.filter(order => order.createdAt >= todayTimestamp);
    
    // Filter evening shift (3:00 PM - 10:00 PM)
    const eveningOrders = todayOrders.filter((order) => {
      const date = new Date(order.createdAt);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      return timeInMinutes >= 900 && timeInMinutes < 1320; // 3:00 PM - 10:00 PM
    });
    
    // Calculate exactly like the frontend does
    let grandTotal = 0;
    let customFoodTotal = 0;
    let customDrinksTotal = 0;
    let menuFoodTotal = 0;
    let menuDrinksTotal = 0;
    
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
      // Sample of first 5 orders
      sampleOrders: eveningOrders.slice(0, 5).map(o => ({
        _id: o._id,
        total: o.total,
        createdAt: new Date(o.createdAt).toLocaleString(),
        cashierCode: o.cashierCode,
        itemCount: o.items.length
      }))
    };
  },
});

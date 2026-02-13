import { query } from "./_generated/server";

export const debugFrontendCalculation = query({
  handler: async (ctx) => {
    // Get today's timestamp (Feb 3, 2026)
    const feb3 = new Date("2026-02-03T00:00:00+03:00"); // EAT timezone
    const todayTimestamp = feb3.getTime();
    
    // Get all orders from today
    const allOrders = await ctx.db.query("orders").collect();
    const todayOrders = allOrders.filter(order => order.createdAt >= todayTimestamp);
    
    // Filter morning shift (7:30 AM - 2:30 PM)
    const morningOrders = todayOrders.filter((order) => {
      const date = new Date(order.createdAt);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      return timeInMinutes >= 450 && timeInMinutes < 870;
    });
    
    // Calculate exactly like the frontend does
    let grandTotal = 0;
    let customFoodTotal = 0;
    let customDrinksTotal = 0;
    let menuFoodTotal = 0;
    let menuDrinksTotal = 0;
    
    morningOrders.forEach((order) => {
      grandTotal += order.total;
      
      order.items.forEach((item) => {
        const itemTotal = item.price * item.quantity;
        const category = item.category?.toLowerCase();
        const isCustom = item.isCustom === true;
        
        console.log(`Item: ${item.name}, price: ${item.price}, qty: ${item.quantity}, category: ${category}, isCustom: ${isCustom}, itemTotal: ${itemTotal}`);
        
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
      orderCount: morningOrders.length,
      grandTotal,
      menuFoodTotal,
      menuDrinksTotal,
      customFoodTotal,
      customDrinksTotal,
      orders: morningOrders.map(o => ({
        _id: o._id,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items.map(i => ({
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          category: i.category,
          isCustom: i.isCustom,
          menuItemId: i.menuItemId
        }))
      }))
    };
  },
});

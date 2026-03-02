import { query } from "./_generated/server";

export const checkBetweenShiftOrders = query({
  handler: async (ctx) => {
    const feb3Start = new Date("2026-02-03T00:00:00").getTime();
    const feb4Start = new Date("2026-02-04T00:00:00").getTime();
    
    const allOrders = await ctx.db.query("orders").collect();
    const todayOrders = allOrders.filter(order => 
      order.createdAt >= feb3Start && order.createdAt < feb4Start
    );
    
    // Orders between 2:30 PM and 3:00 PM
    const betweenOrders = todayOrders.filter((order) => {
      const date = new Date(order.createdAt);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      return timeInMinutes >= 870 && timeInMinutes < 900;
    });
    
    // Check if frontend might be using <= instead of <
    const eveningWithEquals = todayOrders.filter((order) => {
      const date = new Date(order.createdAt);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      return timeInMinutes >= 870 && timeInMinutes < 1320; // From 2:30 PM
    });
    
    const calcTotals = (orders) => {
      let grandTotal = 0;
      let customFoodTotal = 0;
      let customDrinksTotal = 0;
      let menuFoodTotal = 0;
      let menuDrinksTotal = 0;
      
      orders.forEach((order) => {
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
      
      return { grandTotal, menuFoodTotal, menuDrinksTotal, customFoodTotal, customDrinksTotal };
    };
    
    return {
      betweenOrders: {
        count: betweenOrders.length,
        ...calcTotals(betweenOrders),
        orders: betweenOrders.map(o => ({
          time: `${new Date(o.createdAt).getHours()}:${String(new Date(o.createdAt).getMinutes()).padStart(2, '0')}`,
          total: o.total,
          items: o.items.length
        }))
      },
      eveningFrom230PM: {
        count: eveningWithEquals.length,
        ...calcTotals(eveningWithEquals)
      }
    };
  },
});

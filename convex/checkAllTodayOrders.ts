import { query } from "./_generated/server";

export const checkAllTodayOrders = query({
  handler: async (ctx) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    
    const allOrders = await ctx.db.query("orders").collect();
    const todayOrders = allOrders.filter(order => 
      order.createdAt >= todayStart && order.createdAt < tomorrowStart
    );
    
    const beforeMorning: any[] = [];
    const morningShift: any[] = [];
    const afternoonShift: any[] = [];
    const eveningShift: any[] = [];
    const afterEvening: any[] = [];
    
    todayOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      const timeInMinutes = date.getHours() * 60 + date.getMinutes();
      
      if (timeInMinutes < 450) {
        beforeMorning.push(order);
      } else if (timeInMinutes >= 450 && timeInMinutes < 900) {
        morningShift.push(order);
      } else if (timeInMinutes >= 900 && timeInMinutes < 1020) {
        afternoonShift.push(order);
      } else if (timeInMinutes >= 1020 && timeInMinutes < 1320) {
        eveningShift.push(order);
      } else {
        afterEvening.push(order);
      }
    });
    
    const calcTotals = (orders: any[]) => {
      let grandTotal = 0;
      let customFoodTotal = 0;
      let customDrinksTotal = 0;
      let menuFoodTotal = 0;
      let menuDrinksTotal = 0;
      
      orders.forEach((order) => {
        grandTotal += order.total;
        order.items.forEach((item: any) => {
          const itemTotal = item.price * item.quantity;
          const category = item.category?.toLowerCase();
          const isCustom = item.isCustom === true;
          
          if (category === "drink" || category === "drinks") {
            if (isCustom) customDrinksTotal += itemTotal;
            else menuDrinksTotal += itemTotal;
          } else {
            if (isCustom) customFoodTotal += itemTotal;
            else menuFoodTotal += itemTotal;
          }
        });
      });
      
      return { grandTotal, menuFoodTotal, menuDrinksTotal, customFoodTotal, customDrinksTotal };
    };
    
    return {
      totalOrders: todayOrders.length,
      beforeMorning: {
        count: beforeMorning.length,
        total: beforeMorning.reduce((sum, o) => sum + o.total, 0),
      },
      morningShift: {
        count: morningShift.length,
        ...calcTotals(morningShift),
      },
      afternoonShift: {
        count: afternoonShift.length,
        ...calcTotals(afternoonShift),
      },
      eveningShift: {
        count: eveningShift.length,
        ...calcTotals(eveningShift),
      },
      afterEvening: {
        count: afterEvening.length,
        total: afterEvening.reduce((sum, o) => sum + o.total, 0),
      },
      allDayTotal: todayOrders.reduce((sum, o) => sum + o.total, 0),
    };
  },
});

import { query } from "./_generated/server";
import { v } from "convex/values";

export const checkOrdersByDate = query({
  args: {
    dateStart: v.number(), // timestamp for start of day
    dateEnd: v.number(),   // timestamp for end of day
  },
  handler: async (ctx, args) => {
    const allOrders = await ctx.db.query("orders").collect();
    const dayOrders = allOrders.filter(
      (order) => order.createdAt >= args.dateStart && order.createdAt < args.dateEnd && order.orderType !== "special"
    );

    // Fetch all access codes from DB for display info
    const accessCodes = await ctx.db.query("accessCodes").collect();
    const codeMap: Record<string, { shift?: string }> = {};
    accessCodes.forEach((ac) => {
      codeMap[ac.code] = { shift: ac.shift };
    });

    const morningShift: any[] = [];
    const afternoonShift: any[] = [];
    const eveningShift: any[] = [];
    const unassigned: any[] = [];

    dayOrders.forEach((order) => {
      const shift = codeMap[order.cashierCode]?.shift;
      if (shift === "morning") morningShift.push(order);
      else if (shift === "afternoon") afternoonShift.push(order);
      else if (shift === "evening") eveningShift.push(order);
      else unassigned.push(order);
    });

    const calcTotals = (orders: any[]) => {
      let grandTotal = 0;
      let customFoodTotal = 0;
      let customDrinksTotal = 0;
      let menuFoodTotal = 0;
      let menuDrinksTotal = 0;
      const byAccessCode: Record<string, { total: number; orderCount: number; shift?: string }> = {};

      orders.forEach((order) => {
        grandTotal += order.total;
        const code = order.cashierCode || "UNKNOWN";
        if (!byAccessCode[code]) {
          byAccessCode[code] = {
            total: 0,
            orderCount: 0,
            shift: codeMap[code]?.shift,
          };
        }
        byAccessCode[code].total += order.total;
        byAccessCode[code].orderCount += 1;

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

      return { grandTotal, menuFoodTotal, menuDrinksTotal, customFoodTotal, customDrinksTotal, byAccessCode };
    };

    const allDayTotals = calcTotals(dayOrders);

    return {
      totalOrders: dayOrders.length,
      beforeMorning: { count: 0, total: 0 },
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
      afterEvening: { count: 0, total: 0 },
      allDayTotal: allDayTotals.grandTotal,
      allDayByAccessCode: allDayTotals.byAccessCode,
    };
  },
});

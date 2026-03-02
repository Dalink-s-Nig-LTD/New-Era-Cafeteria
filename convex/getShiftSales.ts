import { query } from "./_generated/server";

// Helper to group orders by access code - returns only aggregated data
function groupByAccessCode(orders: { cashierCode: string; total: number }[]) {
  const grouped: Record<string, { totalSales: number; orderCount: number }> = {};
  
  orders.forEach((order) => {
    const code = order.cashierCode || "UNKNOWN";
    if (!grouped[code]) {
      grouped[code] = { totalSales: 0, orderCount: 0 };
    }
    grouped[code].totalSales += order.total;
    grouped[code].orderCount += 1;
  });
  
  return grouped;
}

export const getShiftSales = query(async ({ db }) => {
  // Get shift settings to check which are enabled
  const shiftSettings = await db.query("shiftSettings").collect();
  const shiftEnabledMap: Record<string, boolean> = {};
  shiftSettings.forEach((s) => {
    shiftEnabledMap[s.shift] = s.isEnabled;
  });

  // Get start and end of today
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // Get all access codes to build a map of code -> shift
  const accessCodes = await db.query("accessCodes").collect();
  const codeToShift: Record<string, "morning" | "afternoon" | "evening" | undefined> = {};
  accessCodes.forEach((ac) => {
    codeToShift[ac.code] = ac.shift;
  });

  const allOrders = await db.query("orders")
    .withIndex("by_createdAt")
    .filter(q =>
      q.and(
        q.gte(q.field("createdAt"), startOfDay.getTime()),
        q.lte(q.field("createdAt"), endOfDay.getTime())
      )
    )
    .collect();

  const minimalOrders = allOrders
    .filter(order => order.orderType !== "special")
    .map(order => ({
      createdAt: order.createdAt,
      total: order.total,
      cashierCode: order.cashierCode,
    }));

  // Filter by access code shift assignment; disabled shifts go to unassigned
  const morningOrders = minimalOrders.filter((order) => {
    const shift = codeToShift[order.cashierCode];
    return shift === "morning" && shiftEnabledMap["morning"] !== false;
  });

  const afternoonOrders = minimalOrders.filter((order) => {
    const shift = codeToShift[order.cashierCode];
    return shift === "afternoon" && shiftEnabledMap["afternoon"] !== false;
  });

  const eveningOrders = minimalOrders.filter((order) => {
    const shift = codeToShift[order.cashierCode];
    return shift === "evening" && shiftEnabledMap["evening"] !== false;
  });

  // Orders from codes without shift assignment OR from disabled shifts
  const unassignedOrders = minimalOrders.filter((order) => {
    const shift = codeToShift[order.cashierCode];
    if (shift === undefined) return true;
    if (shift === "morning" && shiftEnabledMap["morning"] === false) return true;
    if (shift === "afternoon" && shiftEnabledMap["afternoon"] === false) return true;
    if (shift === "evening" && shiftEnabledMap["evening"] === false) return true;
    return false;
  });

  const morningTotal = morningOrders.reduce((sum, order) => sum + order.total, 0);
  const afternoonTotal = afternoonOrders.reduce((sum, order) => sum + order.total, 0);
  const eveningTotal = eveningOrders.reduce((sum, order) => sum + order.total, 0);
  const unassignedTotal = unassignedOrders.reduce((sum, order) => sum + order.total, 0);

  // Build result, only include enabled shifts
  const result: Record<string, any> = {
    unassigned: {
      totalSales: unassignedTotal,
      orderCount: unassignedOrders.length,
      byAccessCode: groupByAccessCode(unassignedOrders),
    },
    fullDay: {
      totalSales: morningTotal + afternoonTotal + eveningTotal + unassignedTotal,
      orderCount: minimalOrders.length,
      byAccessCode: groupByAccessCode(minimalOrders),
    },
  };

  if (shiftEnabledMap["morning"] !== false) {
    result.morning = {
      totalSales: morningTotal,
      orderCount: morningOrders.length,
      byAccessCode: groupByAccessCode(morningOrders),
    };
  }
  if (shiftEnabledMap["afternoon"] !== false) {
    result.afternoon = {
      totalSales: afternoonTotal,
      orderCount: afternoonOrders.length,
      byAccessCode: groupByAccessCode(afternoonOrders),
    };
  }
  if (shiftEnabledMap["evening"] !== false) {
    result.evening = {
      totalSales: eveningTotal,
      orderCount: eveningOrders.length,
      byAccessCode: groupByAccessCode(eveningOrders),
    };
  }

  return result;
});

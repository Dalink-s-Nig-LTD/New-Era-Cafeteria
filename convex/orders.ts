import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create a new order (for cashier)
export const createOrder = mutation({
  args: {
    items: v.array(
      v.object({
        menuItemId: v.optional(v.id("menuItems")),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
        category: v.optional(v.string()),
        isCustom: v.optional(v.boolean()),
      })
    ),
    total: v.number(),
    paymentMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("transfer"), v.literal("customer_balance")),
    customerId: v.optional(v.id("customers")),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
    orderType: v.optional(v.union(v.literal("regular"), v.literal("special"))),
    cashierCode: v.string(),
    cashierName: v.optional(v.string()),
    clientOrderId: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const preciseCreatedAt = args.createdAt || Date.now();

      // Primary dedup: check by clientOrderId (authoritative idempotency key)
      if (args.clientOrderId) {
        const existingByClientId = await ctx.db
          .query("orders")
          .withIndex("by_clientOrderId", (q) => q.eq("clientOrderId", args.clientOrderId!))
          .first();

        if (existingByClientId) {
          console.log(`[Dedup] Duplicate blocked by clientOrderId: ${args.clientOrderId}, cashier: ${args.cashierCode}`);
          return { _id: existingByClientId._id, isDuplicate: true };
        }
      } else {
        console.warn(`[Dedup] Order submitted without clientOrderId — cashier: ${args.cashierCode}, total: ${args.total}`);

        // Fallback fingerprint guard: same cashier + same total + same item count within 10 seconds
        const tenSecondsAgo = preciseCreatedAt - 10_000;
        const recentMatch = await ctx.db
          .query("orders")
          .withIndex("by_cashierCode", (q) => q.eq("cashierCode", args.cashierCode))
          .filter((q) =>
            q.and(
              q.gte(q.field("createdAt"), tenSecondsAgo),
              q.eq(q.field("total"), args.total)
            )
          )
          .first();

        if (recentMatch && recentMatch.items.length === args.items.length) {
          console.warn(`[Dedup] Fallback fingerprint blocked duplicate — cashier: ${args.cashierCode}, total: ${args.total}`);
          return { _id: recentMatch._id, isDuplicate: true };
        }
      }

      const order = {
        items: args.items,
        total: args.total,
        paymentMethod: args.paymentMethod,
        status: args.status,
        orderType: args.orderType || "regular",
        cashierCode: args.cashierCode,
        cashierName: args.cashierName,
        clientOrderId: args.clientOrderId,
        customerId: args.customerId,
        createdAt: preciseCreatedAt,
      };
      const id = await ctx.db.insert("orders", order);
      console.log(`[Order] Created: id=${id}, clientOrderId=${args.clientOrderId || 'none'}, cashier=${args.cashierCode}, total=${args.total}`);

      await ctx.db.insert("activityLogs", {
        accessCode: args.cashierCode,
        role: "cashier",
        action: "create_order",
        details: `Order created - Total: ₦${args.total}, Items: ${args.items.length}, Payment: ${args.paymentMethod}`,
        status: "success",
        createdAt: Date.now(),
      });

      return { _id: id, isDuplicate: false };
    } catch (error) {
      console.error("Error in createOrder mutation:", error);
      throw new Error("Failed to create order. Please try again later.");
    }
  },
});

// Get recent orders
export const getRecentOrders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
    
    return orders;
  },
});

// Get all orders (for admin reports) - with pagination to reduce bandwidth
export const getAllOrders = query({
  args: {
    limit: v.optional(v.number()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const daysBack = args.daysBack || 30;
    
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_createdAt")
      .filter((q) => q.gte(q.field("createdAt"), cutoffTime))
      .order("desc")
      .take(limit);
    
    return orders;
  },
});

// Get orders statistics
export const getOrdersStats = query({
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    
    const recentOrdersRaw = await ctx.db
      .query("orders")
      .withIndex("by_createdAt")
      .filter((q) => q.gte(q.field("createdAt"), twoWeeksAgo))
      .collect();
    const recentOrders = recentOrdersRaw.filter(order => order.orderType !== "special");
    
    const todayOrders = recentOrders.filter(order => order.createdAt >= oneDayAgo);
    const weekOrders = recentOrders.filter(order => order.createdAt >= oneWeekAgo);
    const lastWeekOrders = recentOrders.filter(
      order => order.createdAt >= twoWeeksAgo && order.createdAt < oneWeekAgo
    );
    
    const totalRevenue = weekOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = weekOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const dailyCustomers = todayOrders.length;
    
    const lastWeekRevenue = lastWeekOrders.reduce((sum, order) => sum + order.total, 0);
    const lastWeekOrderCount = lastWeekOrders.length;
    const lastWeekAvg = lastWeekOrderCount > 0 ? lastWeekRevenue / lastWeekOrderCount : 0;
    
    const revenueChange = lastWeekRevenue > 0 
      ? ((totalRevenue - lastWeekRevenue) / lastWeekRevenue * 100).toFixed(1)
      : "0";
    const ordersChange = lastWeekOrderCount > 0
      ? ((totalOrders - lastWeekOrderCount) / lastWeekOrderCount * 100).toFixed(1)
      : "0";
    const avgChange = lastWeekAvg > 0
      ? ((avgOrderValue - lastWeekAvg) / lastWeekAvg * 100).toFixed(1)
      : "0";
    
    return {
      totalRevenue,
      revenueChange: `${revenueChange >= "0" ? "+" : ""}${revenueChange}%`,
      totalOrders,
      ordersChange: `${ordersChange >= "0" ? "+" : ""}${ordersChange}%`,
      avgOrderValue: Math.round(avgOrderValue),
      avgChange: `${avgChange >= "0" ? "+" : ""}${avgChange}%`,
      dailyCustomers,
      dailyChange: "+0%",
    };
  },
});

// Get weekly sales data for chart
export const getWeeklySales = query({
  handler: async (ctx) => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const ordersRaw = await ctx.db
      .query("orders")
      .filter((q) => q.gte(q.field("createdAt"), oneWeekAgo))
      .collect();
    const orders = ordersRaw.filter(order => order.orderType !== "special");
    
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const salesByDay: Record<string, { revenue: number; orders: number }> = {};
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
      const dayName = dayNames[date.getDay()];
      salesByDay[dayName] = { revenue: 0, orders: 0 };
    }
    
    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const dayName = dayNames[date.getDay()];
      if (salesByDay[dayName]) {
        salesByDay[dayName].revenue += order.total;
        salesByDay[dayName].orders += 1;
      }
    });
    
    return Object.entries(salesByDay).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
    }));
  },
});

// Get category sales data
export const getCategorySales = query({
  handler: async (ctx) => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    const ordersRaw = await ctx.db
      .query("orders")
      .filter((q) => q.gte(q.field("createdAt"), oneWeekAgo))
      .collect();
    const orders = ordersRaw.filter(order => order.orderType !== "special");
    
    const menuItems = await ctx.db.query("menuItems").collect();
    const categoryMap = new Map(menuItems.map(item => [item._id, item.category]));
    
    const categorySales = new Map<string, number>();
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const category = item.menuItemId ? categoryMap.get(item.menuItemId) || "Other" : "Other";
        const currentAmount = categorySales.get(category) || 0;
        categorySales.set(category, currentAmount + (item.price * item.quantity));
      });
    });
    
    const total = Array.from(categorySales.values()).reduce((sum, val) => sum + val, 0);
    
    return Array.from(categorySales.entries()).map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
  },
});

// Reset all orders (superadmin only)
export const resetAllOrders = mutation({
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    for (const order of orders) {
      await ctx.db.delete(order._id);
    }
    return { success: true, deletedCount: orders.length };
  },
});

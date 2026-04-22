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

// Atomically create order and deduct customer balance.
// This prevents the split-write inconsistency between order creation and wallet deduction.
export const createOrderWithBalancePayment = mutation({
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
    customerId: v.id("customers"),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
    orderType: v.optional(v.union(v.literal("regular"), v.literal("special"))),
    cashierCode: v.string(),
    cashierName: v.optional(v.string()),
    clientOrderId: v.string(),
    createdAt: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const preciseCreatedAt = args.createdAt || Date.now();

    const existingByClientId = await ctx.db
      .query("orders")
      .withIndex("by_clientOrderId", (q) => q.eq("clientOrderId", args.clientOrderId))
      .first();

    if (existingByClientId) {
      const customer = await ctx.db.get(args.customerId);
      return {
        _id: existingByClientId._id,
        isDuplicate: true,
        balanceAfter: customer?.balance ?? 0,
      };
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found.");
    if (!customer.isActive) throw new Error("Customer account is inactive.");
    if (args.total <= 0) throw new Error("Amount must be positive.");
    if (customer.balance < args.total) throw new Error("Insufficient balance.");

    const orderId = await ctx.db.insert("orders", {
      items: args.items,
      total: args.total,
      paymentMethod: "customer_balance",
      status: args.status,
      orderType: args.orderType || "regular",
      cashierCode: args.cashierCode,
      cashierName: args.cashierName,
      clientOrderId: args.clientOrderId,
      customerId: args.customerId,
      createdAt: preciseCreatedAt,
    });

    const balanceBefore = customer.balance;
    const balanceAfter = balanceBefore - args.total;

    await ctx.db.patch(args.customerId, {
      balance: balanceAfter,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("customerTransactions", {
      customerId: args.customerId,
      type: "debit",
      amount: args.total,
      balanceBefore,
      balanceAfter,
      description: args.description,
      orderId,
      createdAt: Date.now(),
    });

    await ctx.db.insert("activityLogs", {
      accessCode: args.cashierCode,
      role: "cashier",
      action: "create_order",
      details: `Order + wallet debit completed - Total: ₦${args.total}, Items: ${args.items.length}`,
      status: "success",
      createdAt: Date.now(),
    });

    return { _id: orderId, isDuplicate: false, balanceAfter };
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

// Get all orders (for admin reports) - with cursor pagination for unlimited data
export const getAllOrders = query({
  args: {
    limit: v.optional(v.number()),
    daysBack: v.optional(v.number()),
    lastId: v.optional(v.string()), // Cursor for pagination
  },
  handler: async (ctx, args) => {
    // Cap limit to avoid exceeding Convex's return size limit (8192 items)
    const limit = Math.min(args.limit || 100, 5000);
    const daysBack = args.daysBack || 30;
    
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    
    // Fetch with arrow-function bounds (optimized)
    let query = ctx.db
      .query("orders")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", cutoffTime))
      .order("desc");
    
    // If we have a cursor, fetch extra and skip to after cursor
    if (args.lastId) {
      const allOrders = await query.collect();
      const lastIndex = allOrders.findIndex((o) => o._id === args.lastId);
      if (lastIndex >= 0 && lastIndex + 1 < allOrders.length) {
        return allOrders.slice(lastIndex + 1, lastIndex + 1 + limit);
      }
      return [];
    }
    
    const orders = await query.take(limit);
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
    
    const revenueChangeNum = lastWeekRevenue > 0 
      ? (totalRevenue - lastWeekRevenue) / lastWeekRevenue * 100
      : 0;
    const ordersChangeNum = lastWeekOrderCount > 0
      ? (totalOrders - lastWeekOrderCount) / lastWeekOrderCount * 100
      : 0;
    const avgChangeNum = lastWeekAvg > 0
      ? (avgOrderValue - lastWeekAvg) / lastWeekAvg * 100
      : 0;
    
    return {
      totalRevenue,
      revenueChange: `${revenueChangeNum >= 0 ? "+" : ""}${revenueChangeNum.toFixed(1)}%`,
      totalOrders,
      ordersChange: `${ordersChangeNum >= 0 ? "+" : ""}${ordersChangeNum.toFixed(1)}%`,
      avgOrderValue: Math.round(avgOrderValue),
      avgChange: `${avgChangeNum >= 0 ? "+" : ""}${avgChangeNum.toFixed(1)}%`,
      dailyCustomers,
      dailyChange: "+0%",
    };
  },
});

// Get weekly sales data for chart
export const getWeeklySales = query({
  handler: async (ctx) => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const startMs = weekStart.getTime();
    const endMs = weekEnd.getTime();

    const ordersRaw = await ctx.db
      .query("orders")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", startMs).lt("createdAt", endMs),
      )
      .collect();
    const orders = ordersRaw.filter((order) => order.orderType !== "special");

    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const salesByDay: Record<string, { revenue: number; orders: number }> = {
      Mon: { revenue: 0, orders: 0 },
      Tue: { revenue: 0, orders: 0 },
      Wed: { revenue: 0, orders: 0 },
      Thu: { revenue: 0, orders: 0 },
      Fri: { revenue: 0, orders: 0 },
      Sat: { revenue: 0, orders: 0 },
      Sun: { revenue: 0, orders: 0 },
    };

    orders.forEach((order) => {
      const d = new Date(order.createdAt).getDay();
      const label = labels[d === 0 ? 6 : d - 1];
      salesByDay[label].revenue += order.total;
      salesByDay[label].orders += 1;
    });

    return labels.map((date) => ({
      date,
      revenue: salesByDay[date].revenue,
      orders: salesByDay[date].orders,
    }));
  },
});

// Get category sales data
export const getCategorySales = query({
  handler: async (ctx) => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const ordersRaw = await ctx.db
      .query("orders")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", weekStart.getTime()).lt("createdAt", weekEnd.getTime()),
      )
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

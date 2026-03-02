import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { DatabaseReader } from "./_generated/server";

// Helper: validate admin access via access code OR admin email
async function validateAdmin(db: DatabaseReader, identifier: string) {
  // Try admin email (for superadmin)
  const normalizedIdentifier = identifier.toLowerCase().trim();
  const users = await db.query("adminUsers")
    .withIndex("by_email", (q) => q.eq("email", normalizedIdentifier))
    .collect();
  const adminUser = users[0] ?? null;
  if (adminUser && adminUser.role === "superadmin") {
    return { type: "email" as const, identifier: normalizedIdentifier, userId: adminUser._id };
  }
  // Try access code for cashier/admin (but do not allow manual entries)
  const accessCode = await db.query("accessCodes")
    .withIndex("by_code", (q) => q.eq("code", identifier))
    .unique();
  if (accessCode && ["admin", "cashier"].includes(accessCode.role)) {
    throw new Error("Only superadmins (by email) can perform this action");
  }
  throw new Error("Only authorized superadmins can perform this action");
}

// Create a new manual entry (stored as an order)
export const createManualEntry = mutation({
  args: {
    amount: v.number(),
    description: v.string(),
    date: v.number(),
    reason: v.string(),
    cashierCode: v.string(),
    orderCashierCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await validateAdmin(ctx.db, args.cashierCode);

    // Determine category based on description
    const isFood = args.description.toLowerCase().includes("food");
    const isDrink = args.description.toLowerCase().includes("drink");
    const category = isDrink ? "drinks" : isFood ? "food" : "food";
    const absAmount = Math.abs(args.amount);

    // Store as an order in the orders table
    const orderId = await ctx.db.insert("orders", {
      items: [
        {
          name: args.description,
          price: args.amount,
          quantity: 1,
          category: category,
          isCustom: true,
        },
      ],
      total: args.amount,
      paymentMethod: "cash",
      status: "completed",
      cashierCode: args.orderCashierCode || args.cashierCode,
      createdAt: args.date,
    });

    // Also keep a record in manualEntries for audit purposes
    const entryId = await ctx.db.insert("manualEntries", {
      amount: args.amount,
      description: args.description,
      date: args.date,
      reason: args.reason,
      addedByEmail: args.cashierCode,
      createdAt: Date.now(),
      orderId: orderId,
    });

    // Log activity
    await ctx.db.insert("activityLogs", {
      accessCode: args.cashierCode,
      role: "admin",
      action: "create_manual_entry",
      details: `Manual entry added - Amount: ₦${args.amount}, Description: ${args.description}`,
      status: "success",
      createdAt: Date.now(),
    });

    return entryId;
  },
});

// Get all manual entries
export const getManualEntries = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("manualEntries")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      return entries.filter((entry) => {
        if (args.startDate && entry.date < args.startDate) return false;
        if (args.endDate && entry.date > args.endDate) return false;
        return true;
      });
    }

    return entries;
  },
});

// Get manual entries statistics
export const getManualEntriesStats = query({
  handler: async (ctx) => {
    const entries = await ctx.db.query("manualEntries").collect();

    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const todayEntries = entries.filter(
      (e) => e.date >= startOfDay.getTime()
    );
    const monthEntries = entries.filter(
      (e) => e.date >= startOfMonth.getTime()
    );

    const stats = {
      total: entries.length,
      totalAmount: entries.reduce((sum, e) => sum + e.amount, 0),
      todayTotal: todayEntries.reduce((sum, e) => sum + e.amount, 0),
      monthTotal: monthEntries.reduce((sum, e) => sum + e.amount, 0),
      todayCount: todayEntries.length,
      monthCount: monthEntries.length,
    };

    return stats;
  },
});

// Delete a manual entry (admin only)
export const deleteManualEntry = mutation({
  args: {
    id: v.id("manualEntries"),
    cashierCode: v.string(),
  },
  handler: async (ctx, args) => {
    await validateAdmin(ctx.db, args.cashierCode);

    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Manual entry not found");
    }

    await ctx.db.delete(args.id);

    // Log activity
    await ctx.db.insert("activityLogs", {
      accessCode: args.cashierCode,
      role: "admin",
      action: "delete_manual_entry",
      details: `Manual entry deleted - Amount: ₦${entry.amount}, Description: ${entry.description}`,
      status: "success",
      createdAt: Date.now(),
    });

    return args.id;
  },
});

// Update a manual entry (admin only)
export const updateManualEntry = mutation({
  args: {
    id: v.id("manualEntries"),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
    date: v.optional(v.number()),
    reason: v.optional(v.string()),
    cashierCode: v.string(),
  },
  handler: async (ctx, args) => {
    await validateAdmin(ctx.db, args.cashierCode);

    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Manual entry not found");
    }

    const { id, cashierCode, ...updates } = args;
    const updateData: Record<string, string | number> = {};
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.reason !== undefined) updateData.reason = updates.reason;

    await ctx.db.patch(id, updateData);

    // Log activity
    await ctx.db.insert("activityLogs", {
      accessCode: args.cashierCode,
      role: "admin",
      action: "update_manual_entry",
      details: `Manual entry updated - Original Amount: ₦${entry.amount}`,
      status: "success",
      createdAt: Date.now(),
    });

    return id;
  },
});

// Replace all orders for a specific day with morning/evening shift totals
export const replaceDayOrders = mutation({
  args: {
    date: v.number(),
    morningTotal: v.number(),
    eveningTotal: v.number(),
    reason: v.string(),
    cashierCode: v.string(),
    orderCashierCode: v.optional(v.string()),
    morningCashierCode: v.optional(v.string()),
    eveningCashierCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await validateAdmin(ctx.db, args.cashierCode);

    // Use args.date directly as local midnight (sent from browser)
    const startOfDay = args.date;
    const endOfDay = args.date + 86399999; // +23:59:59.999

    // Delete all existing orders for this day
    const existingOrders = await ctx.db.query("orders")
      .withIndex("by_createdAt")
      .filter(q => q.and(q.gte(q.field("createdAt"), startOfDay), q.lte(q.field("createdAt"), endOfDay)))
      .collect();

    const deletedCount = existingOrders.length;
    for (const order of existingOrders) {
      await ctx.db.delete(order._id);
    }

    // Create morning shift order if total > 0
    let morningOrderId = undefined;
    if (args.morningTotal > 0) {
      const morningTime = args.date + 10 * 3600000; // 10:00 AM offset
      morningOrderId = await ctx.db.insert("orders", {
        items: [{
          name: "Morning Shift Manual Entry",
          price: args.morningTotal,
          quantity: 1,
          category: "food",
          isCustom: true,
        }],
        total: args.morningTotal,
        paymentMethod: "cash",
        status: "completed",
        cashierCode: args.morningCashierCode || args.orderCashierCode || args.cashierCode,
        createdAt: morningTime,
      });
    }

    // Create evening shift order if total > 0
    let eveningOrderId = undefined;
    if (args.eveningTotal > 0) {
      const eveningTime = args.date + 19 * 3600000; // 7:00 PM offset
      eveningOrderId = await ctx.db.insert("orders", {
        items: [{
          name: "Evening Shift Manual Entry",
          price: args.eveningTotal,
          quantity: 1,
          category: "food",
          isCustom: true,
        }],
        total: args.eveningTotal,
        paymentMethod: "cash",
        status: "completed",
        cashierCode: args.eveningCashierCode || args.orderCashierCode || args.cashierCode,
        createdAt: eveningTime,
      });
    }

    const combinedTotal = args.morningTotal + args.eveningTotal;

    // Create audit record
    const entryId = await ctx.db.insert("manualEntries", {
      amount: combinedTotal,
      description: `Day replacement — Morning: ₦${args.morningTotal.toLocaleString()}, Evening: ₦${args.eveningTotal.toLocaleString()}`,
      date: startOfDay,
      reason: args.reason,
      addedByEmail: args.cashierCode,
      createdAt: Date.now(),
      orderId: morningOrderId ?? eveningOrderId,
    });

    // Log activity
    await ctx.db.insert("activityLogs", {
      accessCode: args.cashierCode,
      role: "admin",
      action: "replace_day_orders",
      details: `Replaced ${deletedCount} orders for ${new Date(args.date).toISOString().split("T")[0]} — Morning: ₦${args.morningTotal}, Evening: ₦${args.eveningTotal}, Combined: ₦${combinedTotal}`,
      status: "success",
      createdAt: Date.now(),
    });

    return { entryId, deletedCount, morningOrderId, eveningOrderId };
  },
});

// Get manual entries total for a specific date range (useful for reports)
export const getManualEntriesTotal = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db.query("manualEntries").collect();

    const filteredEntries = entries.filter(
      (entry) =>
        entry.date >= args.startDate && entry.date <= args.endDate
    );

    const total = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);

    return {
      total,
      count: filteredEntries.length,
      entries: filteredEntries,
    };
  },
});


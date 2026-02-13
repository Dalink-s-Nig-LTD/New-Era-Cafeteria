import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create a new manual entry (stored as an order)
export const createManualEntry = mutation({
  args: {
    amount: v.number(),
    description: v.string(),
    date: v.number(),
    reason: v.string(),
    addedByEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("adminUsers").withIndex("by_email", q => q.eq("email", args.addedByEmail)).collect();
    const adminUser = users[0] ?? null;
    
    if (!adminUser || adminUser.role !== "superadmin") {
      throw new Error("Only superadmins can add manual entries");
    }
    const adminId = adminUser._id;

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
      cashierCode: "MANUAL",
      createdAt: args.date,
    });

    // Also keep a record in manualEntries for audit purposes
    const entryId = await ctx.db.insert("manualEntries", {
      amount: args.amount,
      description: args.description,
      date: args.date,
      reason: args.reason,
      addedBy: adminId,
      addedByEmail: args.addedByEmail,
      createdAt: Date.now(),
      orderId: orderId, // Link to the order
    });

    // Log activity
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      userEmail: args.addedByEmail,
      role: "superadmin",
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

// Delete a manual entry (superadmin only)
export const deleteManualEntry = mutation({
  args: {
    id: v.id("manualEntries"),
    deletedByEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("adminUsers").withIndex("by_email", q => q.eq("email", args.deletedByEmail)).collect();
    const adminUser = users[0] ?? null;
    
    if (!adminUser || adminUser.role !== "superadmin") {
      throw new Error("Only superadmins can delete manual entries");
    }
    const adminId = adminUser._id;

    const entry = await ctx.db.get(args.id);
    
    if (!entry) {
      throw new Error("Manual entry not found");
    }

    await ctx.db.delete(args.id);

    // Log activity
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      userEmail: args.deletedByEmail,
      role: "superadmin",
      action: "delete_manual_entry",
      details: `Manual entry deleted - Amount: ₦${entry.amount}, Description: ${entry.description}`,
      status: "success",
      createdAt: Date.now(),
    });

    return args.id;
  },
});

// Update a manual entry (superadmin only)
export const updateManualEntry = mutation({
  args: {
    id: v.id("manualEntries"),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
    date: v.optional(v.number()),
    reason: v.optional(v.string()),
    updatedByEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("adminUsers").withIndex("by_email", q => q.eq("email", args.updatedByEmail)).collect();
    const adminUser = users[0] ?? null;
    
    if (!adminUser || adminUser.role !== "superadmin") {
      throw new Error("Only superadmins can update manual entries");
    }
    const adminId = adminUser._id;

    const entry = await ctx.db.get(args.id);
    
    if (!entry) {
      throw new Error("Manual entry not found");
    }

    const { id, updatedByEmail, ...updates } = args;

    // Only update fields that are provided
    const updateData: Record<string, string | number> = {};
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.reason !== undefined) updateData.reason = updates.reason;

    await ctx.db.patch(id, updateData);

    // Log activity
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      userEmail: args.updatedByEmail,
      role: "superadmin",
      action: "update_manual_entry",
      details: `Manual entry updated - Original Amount: ₦${entry.amount}`,
      status: "success",
      createdAt: Date.now(),
    });

    return id;
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

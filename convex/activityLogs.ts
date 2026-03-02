import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Log an activity
export const logActivity = mutation({
  args: {
    userId: v.optional(v.id("adminUsers")),
    accessCode: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    role: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("activityLogs", {
      userId: args.userId,
      accessCode: args.accessCode,
      userEmail: args.userEmail,
      role: args.role,
      action: args.action,
      details: args.details,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      status: args.status,
      createdAt: Date.now(),
    });
    return logId;
  },
});

// Get all activity logs (superadmin only)
export const getAllLogs = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const offset = args.offset || 0;
    
    const logs = await ctx.db
      .query("activityLogs")
      .order("desc")
      .collect();
    
    return {
      logs: logs.slice(offset, offset + limit),
      total: logs.length,
      hasMore: offset + limit < logs.length,
    };
  },
});

// Get logs filtered by various criteria
export const getFilteredLogs = query({
  args: {
    userId: v.optional(v.id("adminUsers")),
    accessCode: v.optional(v.string()),
    role: v.optional(v.string()),
    action: v.optional(v.string()),
    status: v.optional(v.union(v.literal("success"), v.literal("failed"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const offset = args.offset || 0;
    
    const query = ctx.db.query("activityLogs");
    
    // Apply filters
    let logs = await query.order("desc").collect();
    
    if (args.userId) {
      logs = logs.filter(log => log.userId === args.userId);
    }
    
    if (args.accessCode) {
      logs = logs.filter(log => log.accessCode === args.accessCode);
    }
    
    if (args.role) {
      logs = logs.filter(log => log.role === args.role);
    }
    
    if (args.action) {
      logs = logs.filter(log => log.action === args.action);
    }
    
    if (args.status) {
      logs = logs.filter(log => log.status === args.status);
    }
    
    if (args.startDate) {
      logs = logs.filter(log => log.createdAt >= args.startDate!);
    }
    
    if (args.endDate) {
      logs = logs.filter(log => log.createdAt <= args.endDate!);
    }
    
    return {
      logs: logs.slice(offset, offset + limit),
      total: logs.length,
      hasMore: offset + limit < logs.length,
    };
  },
});

// Get logs for a specific user
export const getUserLogs = query({
  args: {
    userId: v.id("adminUsers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    
    return logs;
  },
});

// Get logs by access code (cashier activities)
export const getCashierLogs = query({
  args: {
    accessCode: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_accessCode", (q) => q.eq("accessCode", args.accessCode))
      .order("desc")
      .take(limit);
    
    return logs;
  },
});

// Get activity summary/statistics
export const getActivityStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db.query("activityLogs").collect();
    
    // Filter by date range if provided
    if (args.startDate) {
      logs = logs.filter(log => log.createdAt >= args.startDate!);
    }
    if (args.endDate) {
      logs = logs.filter(log => log.createdAt <= args.endDate!);
    }
    
    // Calculate statistics
    const totalLogs = logs.length;
    const successfulActions = logs.filter(log => log.status === "success").length;
    const failedActions = logs.filter(log => log.status === "failed").length;
    
    // Group by action type
    const actionCounts: Record<string, number> = {};
    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    
    // Group by role
    const roleCounts: Record<string, number> = {};
    logs.forEach(log => {
      roleCounts[log.role] = (roleCounts[log.role] || 0) + 1;
    });
    
    // Get unique users
    const uniqueUsers = new Set(logs.filter(log => log.userId).map(log => log.userId));
    const uniqueCashiers = new Set(logs.filter(log => log.accessCode).map(log => log.accessCode));
    
    return {
      totalLogs,
      successfulActions,
      failedActions,
      actionCounts,
      roleCounts,
      uniqueAdminUsers: uniqueUsers.size,
      uniqueCashiers: uniqueCashiers.size,
    };
  },
});

// Delete old logs (cleanup - superadmin only)
export const deleteOldLogs = mutation({
  args: {
    olderThanDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffDate = Date.now() - (args.olderThanDays * 24 * 60 * 60 * 1000);
    
    const oldLogs = await ctx.db
      .query("activityLogs")
      .filter((q) => q.lt(q.field("createdAt"), cutoffDate))
      .collect();
    
    let deletedCount = 0;
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
      deletedCount++;
    }
    
    return { deletedCount, cutoffDate };
  },
});

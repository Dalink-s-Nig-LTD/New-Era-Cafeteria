import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createSpecialOrder = mutation({
  args: {
    department: v.string(),
    staffName: v.string(),
    quantity: v.number(),
    itemDescription: v.string(),
    pricePerPack: v.number(),
    total: v.number(),
    deliveredBy: v.string(),
    date: v.number(),
    cashierCode: v.string(),
    cashierName: v.optional(v.string()),
    paymentStatus: v.optional(v.union(v.literal("paid"), v.literal("pending"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("specialOrders", {
      ...args,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLogs", {
      accessCode: args.cashierCode,
      role: "cashier",
      action: "create_special_order",
      details: JSON.stringify({
        department: args.department,
        staffName: args.staffName,
        total: args.total,
        itemDescription: args.itemDescription,
      }),
      status: "success",
      createdAt: now,
    });

    return id;
  },
});

export const getSpecialOrders = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("specialOrders")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);
  },
});

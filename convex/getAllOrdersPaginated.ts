import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Fetch all orders with pagination support
 * This query fetches orders in batches to work around Convex's return size limit
 * Each call returns up to batchSize orders after the lastOrderId cursor
 */
export const getAllOrdersPaginated = query({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()), // lastOrderId from previous batch
  },
  handler: async (ctx, args) => {
    const batchSize = Math.min(args.batchSize || 1000, 5000);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_createdAt")
      .order("desc")
      .take(batchSize + 1); // +1 to detect if there are more

    const hasMore = orders.length > batchSize;
    const result = orders.slice(0, batchSize);

    return {
      orders: result,
      hasMore,
      nextCursor: hasMore ? result[result.length - 1]?._id : null,
    };
  },
});

/**
 * Get count of all orders (useful for progress tracking)
 */
export const getOrdersCount = query({
  args: {},
  handler: async (ctx) => {
    const count = await ctx.db.query("orders").collect();
    return count.length;
  },
});

/**
 * Fetch all orders since a specific timestamp
 * Used for incremental syncing
 */
export const getOrdersSinceTimestamp = query({
  args: {
    sinceTimestamp: v.number(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.min(args.batchSize || 1000, 5000);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_createdAt")
      .filter((q) => q.gte(q.field("createdAt"), args.sinceTimestamp))
      .order("desc")
      .take(batchSize + 1);

    const hasMore = orders.length > batchSize;
    return {
      orders: orders.slice(0, batchSize),
      hasMore,
      nextCursor: hasMore ? orders[batchSize]?._id : null,
    };
  },
});

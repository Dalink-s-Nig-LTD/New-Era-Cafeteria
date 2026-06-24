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
    cursor: v.optional(v.string()),
    sinceTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.min(args.batchSize || 1000, 5000);
    const sinceTimestamp = args.sinceTimestamp || 0;

    const result = await ctx.db
      .query("orders")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", sinceTimestamp))
      .order("asc")
      .paginate({
        cursor: args.cursor || null,
        numItems: batchSize,
      });

    return {
      orders: result.page,
      hasMore: !result.isDone,
      nextCursor: result.continueCursor,
    };
  },
});

/**
 * Get count of all orders (useful for progress tracking)
 */
export const getOrdersCount = query({
  args: {},
  handler: async (ctx) => {
    // Disabled to prevent Convex transaction read limit errors (max 8000 reads)
    return 0;
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
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.sinceTimestamp))
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

import { v } from "convex/values";
import { query } from "./_generated/server";

// Query to get all admin users
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("adminUsers").collect();
  },
});

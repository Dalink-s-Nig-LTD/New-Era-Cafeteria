import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Update access codes to add shift field
export default mutation({
  args: {
    code: v.string(),
    shift: v.union(v.literal("morning"), v.literal("afternoon"), v.literal("evening")),
  },
  handler: async (ctx, args) => {
    const accessCode = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!accessCode) {
      throw new Error(`Access code ${args.code} not found`);
    }

    await ctx.db.patch(accessCode._id, {
      shift: args.shift,
    });

    return { success: true, code: args.code, shift: args.shift };
  },
});

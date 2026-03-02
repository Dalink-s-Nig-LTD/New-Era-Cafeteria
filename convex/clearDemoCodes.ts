import { mutation } from "./_generated/server";

// Clear demo access codes (1234, 0000)
export default mutation({
  handler: async (ctx) => {
    const demoCodes = ["1234", "0000"];
    let deletedCount = 0;

    for (const code of demoCodes) {
      const existing = await ctx.db
        .query("accessCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      
      if (existing) {
        await ctx.db.delete(existing._id);
        deletedCount++;
      }
    }

    return { 
      message: `Deleted ${deletedCount} demo codes`,
      note: "Admins should now generate codes from the dashboard"
    };
  },
});

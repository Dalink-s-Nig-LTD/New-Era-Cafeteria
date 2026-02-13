import { mutation } from "./_generated/server";

export const markAllAsSpecialOrders = mutation({
  handler: async (ctx) => {
    const allItems = await ctx.db.query("menuItems").collect();
    let count = 0;
    
    for (const item of allItems) {
      // Skip Custom Item
      if (item.category === "Custom") continue;
      
      await ctx.db.patch(item._id, {
        isSpecialOrder: true,
      });
      count++;
    }
    
    return { success: true, count, message: `Marked ${count} items as special orders` };
  },
});

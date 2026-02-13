import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const markItemsAsSpecialOrders = mutation({
  args: {
    itemIds: v.array(v.id("menuItems")),
  },
  handler: async (ctx, args) => {
    for (const itemId of args.itemIds) {
      await ctx.db.patch(itemId, {
        isSpecialOrder: true,
      });
    }
    return { success: true, count: args.itemIds.length };
  },
});

export const unmarkAllSpecialOrders = mutation({
  handler: async (ctx) => {
    const allItems = await ctx.db.query("menuItems").collect();
    let count = 0;
    
    for (const item of allItems) {
      if (item.isSpecialOrder) {
        await ctx.db.patch(item._id, {
          isSpecialOrder: false,
        });
        count++;
      }
    }
    
    return { success: true, count };
  },
});

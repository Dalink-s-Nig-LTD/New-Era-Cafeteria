import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get the custom placeholder item ID
export const getCustomPlaceholderId = query({
  handler: async (ctx) => {
    const customItem = await ctx.db
      .query("menuItems")
      .filter((q) => q.eq(q.field("name"), "Custom Item"))
      .first();
    
    return customItem?._id ?? null;
  },
});

// Get all menu items
export const getAllMenuItems = query({
  handler: async (ctx) => {
    const items = await ctx.db.query("menuItems").collect();
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get menu items by category
export const getMenuItemsByCategory = query({
  args: {
    category: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.category === "All") {
      return await ctx.db.query("menuItems").collect();
    }
    
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    
    return items;
  },
});

// Add new menu item
export const addMenuItem = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    category: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const itemId = await ctx.db.insert("menuItems", {
      name: args.name,
      price: args.price,
      category: args.category,
      image: args.image,
      available: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // Log menu item addition
    await ctx.db.insert("activityLogs", {
      role: "admin",
      action: "add_menu_item",
      details: `Added menu item: ${args.name} (₦${args.price}) - ${args.category}`,
      status: "success",
      createdAt: Date.now(),
    });
    
    return itemId;
  },
});

// Update menu item
export const updateMenuItem = mutation({
  args: {
    id: v.id("menuItems"),
    name: v.optional(v.string()),
    price: v.optional(v.number()),
    category: v.optional(v.string()),
    image: v.optional(v.string()),
    available: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    // Get original item for logging
    const item = await ctx.db.get(id);
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Toggle menu item availability
export const toggleMenuItemAvailability = mutation({
  args: {
    id: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }
    
    await ctx.db.patch(args.id, {
      available: !item.available,
      updatedAt: Date.now(),
    });
    
    return { success: true, available: !item.available };
  },
});

// Delete menu item
export const deleteMenuItem = mutation({
  args: {
    id: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Get unique categories
export const getCategories = query({
  handler: async (ctx) => {
    const items = await ctx.db.query("menuItems").collect();
    const categories = [...new Set(items.map(item => item.category))];
    return ["All", ...categories.sort()];
  },
});

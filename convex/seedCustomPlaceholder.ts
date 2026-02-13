import { mutation } from "./_generated/server";

// Seed a placeholder "Custom Item" for custom menu entries
export const seedCustomPlaceholder = mutation({
  handler: async (ctx) => {
    // Check if custom placeholder already exists
    const existing = await ctx.db
      .query("menuItems")
      .filter((q) => q.eq(q.field("name"), "Custom Item"))
      .first();

    if (existing) {
      console.log("Custom placeholder already exists:", existing._id);
      return existing._id;
    }

    // Create the custom placeholder item
    const customItemId = await ctx.db.insert("menuItems", {
      name: "Custom Item",
      price: 0, // Price will be set dynamically
      category: "Custom",
      image: undefined,
      available: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log("Created custom placeholder item:", customItemId);
    return customItemId;
  },
});

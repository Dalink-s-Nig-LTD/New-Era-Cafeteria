import { mutation } from "./_generated/server";

export const seedSpecialOrderItems = mutation({
  handler: async (ctx) => {
    const specialItems = [
      { name: "Birthday Cake (Small)", price: 5000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Birthday Cake (Medium)", price: 8000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Birthday Cake (Large)", price: 12000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Catering Tray - Jollof Rice", price: 15000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Catering Tray - Fried Rice", price: 15000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Party Pack (10 persons)", price: 20000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Party Pack (20 persons)", price: 35000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Bulk Meat Pie (12 pcs)", price: 3600, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Bulk Sausage Roll (12 pcs)", price: 3600, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Special Pepper Soup (Bowl)", price: 2500, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Assorted Meat Platter", price: 8000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
      { name: "Custom Combo Meal", price: 3000, category: "Special Orders", available: true, createdAt: Date.now(), updatedAt: Date.now() },
    ];

    const insertedIds = [];
    for (const item of specialItems) {
      const existing = await ctx.db
        .query("menuItems")
        .filter((q) => q.eq(q.field("name"), item.name))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("menuItems", item);
        insertedIds.push(id);
        console.log(`Added special order: ${item.name} - ₦${item.price}`);
      } else {
        console.log(`Skipped (already exists): ${item.name}`);
      }
    }

    return {
      message: `Added ${insertedIds.length} special order items`,
      insertedIds,
      total: specialItems.length,
    };
  },
});

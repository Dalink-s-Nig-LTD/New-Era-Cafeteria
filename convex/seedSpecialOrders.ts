import { mutation } from "./_generated/server";

// Delete all special order items
export const deleteSpecialOrderItems = mutation({
  handler: async (ctx) => {
    const specialItems = await ctx.db
      .query("menuItems")
      .filter((q) => 
        q.or(
          q.eq(q.field("category"), "Special Orders"),
          q.eq(q.field("isSpecialOrder"), true)
        )
      )
      .collect();

    for (const item of specialItems) {
      await ctx.db.delete(item._id);
      console.log(`Deleted: ${item.name}`);
    }

    return {
      message: `Deleted ${specialItems.length} special order items`,
      count: specialItems.length,
    };
  },
});

// Seed food and drink items
export const seedFoodAndDrinkItems = mutation({
  handler: async (ctx) => {
    const menuItems = [
      // Rice Items
      {
        name: "Jollof Rice",
        price: 500,
        category: "Rice",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Fried Rice",
        price: 500,
        category: "Rice",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "White Rice",
        price: 400,
        category: "Rice",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Coconut Rice",
        price: 600,
        category: "Rice",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      
      // Protein Items
      {
        name: "Chicken",
        price: 800,
        category: "Protein",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Turkey",
        price: 1000,
        category: "Protein",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Fish",
        price: 700,
        category: "Protein",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Beef",
        price: 600,
        category: "Protein",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Goat Meat",
        price: 900,
        category: "Protein",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      
      // Swallow Items
      {
        name: "Eba",
        price: 300,
        category: "Swallow",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Pounded Yam",
        price: 500,
        category: "Swallow",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Fufu",
        price: 400,
        category: "Swallow",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Semo",
        price: 350,
        category: "Swallow",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Amala",
        price: 400,
        category: "Swallow",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      
      // Soup Items
      {
        name: "Egusi Soup",
        price: 600,
        category: "Soup",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Ogbono Soup",
        price: 550,
        category: "Soup",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Vegetable Soup",
        price: 500,
        category: "Soup",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Bitter Leaf Soup",
        price: 600,
        category: "Soup",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Efo Riro",
        price: 550,
        category: "Soup",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      
      // Snacks Items
      {
        name: "Meat Pie",
        price: 200,
        category: "Snacks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Sausage Roll",
        price: 200,
        category: "Snacks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Samosa",
        price: 150,
        category: "Snacks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Puff Puff",
        price: 100,
        category: "Snacks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Plantain Chips",
        price: 150,
        category: "Snacks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Buns",
        price: 100,
        category: "Snacks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      
      // Drinks Items
      {
        name: "Coke",
        price: 200,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Sprite",
        price: 200,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Fanta",
        price: 200,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Pepsi",
        price: 200,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Water",
        price: 100,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Juice (Hollandia)",
        price: 300,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Juice (Chi)",
        price: 250,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Energy Drink",
        price: 400,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Malt",
        price: 250,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Yogurt",
        price: 300,
        category: "Drinks",
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const insertedIds = [];
    for (const item of menuItems) {
      // Check if item already exists
      const existing = await ctx.db
        .query("menuItems")
        .filter((q) => q.eq(q.field("name"), item.name))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("menuItems", item);
        insertedIds.push(id);
        console.log(`Added: ${item.name} - ₦${item.price}`);
      } else {
        console.log(`Skipped (already exists): ${item.name}`);
      }
    }

    return {
      message: `Added ${insertedIds.length} food and drink items`,
      insertedIds,
      total: menuItems.length,
    };
  },
});


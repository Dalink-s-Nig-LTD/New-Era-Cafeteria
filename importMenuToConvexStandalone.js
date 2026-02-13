// Standalone Node.js script to import menu items into Convex DB (dev and prod)
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

// Paste your menuItems array here directly:
const menuItems = [
  { name: 'Jollof Rice', price: 800, category: 'Rice' },
  { name: 'Fried Rice', price: 900, category: 'Rice' },
  { name: 'White Rice', price: 500, category: 'Rice' },
  { name: 'Coconut Rice', price: 850, category: 'Rice' },
  { name: 'Grilled Chicken', price: 1200, category: 'Protein' },
  { name: 'Fried Fish', price: 800, category: 'Protein' },
  { name: 'Beef', price: 600, category: 'Protein' },
  { name: 'Turkey', price: 1000, category: 'Protein' },
  { name: 'Pounded Yam', price: 600, category: 'Swallow' },
  { name: 'Eba', price: 300, category: 'Swallow' },
  { name: 'Amala', price: 350, category: 'Swallow' },
  { name: 'Semo', price: 400, category: 'Swallow' },
  { name: 'Egusi Soup', price: 500, category: 'Soup' },
  { name: 'Efo Riro', price: 450, category: 'Soup' },
  { name: 'Ogbono Soup', price: 500, category: 'Soup' },
  { name: 'Vegetable Soup', price: 400, category: 'Soup' },
  { name: 'Coca-Cola', price: 300, category: 'Drinks' },
  { name: 'Fanta', price: 300, category: 'Drinks' },
  { name: 'Bottled Water', price: 150, category: 'Drinks' },
  { name: 'Chapman', price: 500, category: 'Drinks' },
  { name: 'Meat Pie', price: 400, category: 'Snacks' },
  { name: 'Chicken Pie', price: 450, category: 'Snacks' },
  { name: 'Sausage Roll', price: 350, category: 'Snacks' },
  { name: 'Doughnut', price: 250, category: 'Snacks' }
];

const endpoints = [
  { name: "dev", url: "https://academic-bison-733.convex.cloud" },
  { name: "prod", url: "https://energized-dachshund-996.convex.cloud" },
];

async function importMenuItems() {
  for (const endpoint of endpoints) {
    console.log(`\nImporting to ${endpoint.name} (${endpoint.url})...`);
    const convex = new ConvexHttpClient(endpoint.url);
    for (const item of menuItems) {
      await convex.mutation(api.menuItems.addMenuItem, {
        name: item.name,
        price: item.price,
        category: item.category,
        image: item.image || undefined,
      });
      console.log(`[${endpoint.name}] Imported: ${item.name}`);
    }
    console.log(`[${endpoint.name}] All menu items imported.`);
  }
}

importMenuItems().catch(console.error);

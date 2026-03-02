import { MenuItem } from '@/types/cafeteria';

export const menuItems: MenuItem[] = [
  // Rice Dishes
  { id: '1', name: 'Jollof Rice', price: 800, category: 'Rice', available: true },
  { id: '2', name: 'Fried Rice', price: 900, category: 'Rice', available: true },
  { id: '3', name: 'White Rice', price: 500, category: 'Rice', available: true },
  { id: '4', name: 'Coconut Rice', price: 850, category: 'Rice', available: true },
  
  // Proteins
  { id: '5', name: 'Grilled Chicken', price: 1200, category: 'Protein', available: true },
  { id: '6', name: 'Fried Fish', price: 800, category: 'Protein', available: true },
  { id: '7', name: 'Beef', price: 600, category: 'Protein', available: true },
  { id: '8', name: 'Turkey', price: 1000, category: 'Protein', available: false },
  
  // Swallows
  { id: '9', name: 'Pounded Yam', price: 600, category: 'Swallow', available: true },
  { id: '10', name: 'Eba', price: 300, category: 'Swallow', available: true },
  { id: '11', name: 'Amala', price: 350, category: 'Swallow', available: true },
  { id: '12', name: 'Semo', price: 400, category: 'Swallow', available: true },
  
  // Soups
  { id: '13', name: 'Egusi Soup', price: 500, category: 'Soup', available: true },
  { id: '14', name: 'Efo Riro', price: 450, category: 'Soup', available: true },
  { id: '15', name: 'Ogbono Soup', price: 500, category: 'Soup', available: true },
  { id: '16', name: 'Vegetable Soup', price: 400, category: 'Soup', available: true },
  
  // Drinks
  { id: '17', name: 'Coca-Cola', price: 300, category: 'Drinks', available: true },
  { id: '18', name: 'Fanta', price: 300, category: 'Drinks', available: true },
  { id: '19', name: 'Bottled Water', price: 150, category: 'Drinks', available: true },
  { id: '20', name: 'Chapman', price: 500, category: 'Drinks', available: true },
  
  // Snacks
  { id: '21', name: 'Meat Pie', price: 400, category: 'Snacks', available: true },
  { id: '22', name: 'Chicken Pie', price: 450, category: 'Snacks', available: true },
  { id: '23', name: 'Sausage Roll', price: 350, category: 'Snacks', available: true },
  { id: '24', name: 'Doughnut', price: 250, category: 'Snacks', available: true },
];

export const categories = ['All', 'Rice', 'Protein', 'Swallow', 'Soup', 'Drinks', 'Snacks'];

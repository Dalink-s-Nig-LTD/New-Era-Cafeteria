import { SalesData, CategorySales, Order } from '@/types/cafeteria';

export const weeklySalesData: SalesData[] = [
  { date: 'Mon', revenue: 45000, orders: 52 },
  { date: 'Tue', revenue: 52000, orders: 61 },
  { date: 'Wed', revenue: 48000, orders: 55 },
  { date: 'Thu', revenue: 61000, orders: 72 },
  { date: 'Fri', revenue: 78000, orders: 89 },
  { date: 'Sat', revenue: 35000, orders: 41 },
  { date: 'Sun', revenue: 28000, orders: 32 },
];

export const categorySales: CategorySales[] = [
  { category: 'Rice', amount: 125000, percentage: 35 },
  { category: 'Protein', amount: 89000, percentage: 25 },
  { category: 'Swallow', amount: 53000, percentage: 15 },
  { category: 'Soup', amount: 36000, percentage: 10 },
  { category: 'Drinks', amount: 36000, percentage: 10 },
  { category: 'Snacks', amount: 18000, percentage: 5 },
];

export const recentOrders: Order[] = [
  {
    id: 'ORD-001',
    items: [
      { id: '1', name: 'Jollof Rice', price: 800, category: 'Rice', available: true, quantity: 2 },
      { id: '5', name: 'Grilled Chicken', price: 1200, category: 'Protein', available: true, quantity: 1 },
    ],
    total: 2800,
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    paymentMethod: 'cash',
    status: 'completed',
  },
  {
    id: 'ORD-002',
    items: [
      { id: '9', name: 'Pounded Yam', price: 600, category: 'Swallow', available: true, quantity: 1 },
      { id: '13', name: 'Egusi Soup', price: 500, category: 'Soup', available: true, quantity: 1 },
      { id: '7', name: 'Beef', price: 600, category: 'Protein', available: true, quantity: 2 },
    ],
    total: 2300,
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    paymentMethod: 'card',
    status: 'completed',
  },
  {
    id: 'ORD-003',
    items: [
      { id: '17', name: 'Coca-Cola', price: 300, category: 'Drinks', available: true, quantity: 3 },
      { id: '21', name: 'Meat Pie', price: 400, category: 'Snacks', available: true, quantity: 2 },
    ],
    total: 1700,
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    paymentMethod: 'transfer',
    status: 'completed',
  },
];

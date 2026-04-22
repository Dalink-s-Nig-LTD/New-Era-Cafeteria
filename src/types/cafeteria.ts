import type { Id } from "../../convex/_generated/dataModel";

// CustomCartItem type for custom entries
export interface CustomCartItem extends CartItem {
  isCustom?: true;
}

// Convex createOrder item shape
export interface ConvexOrderItem {
  menuItemId?: Id<"menuItems">;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  isCustom?: boolean;
}

// Order data as returned from Convex DB queries
export interface ConvexOrderRecord {
  _id: string;
  items: ConvexOrderItem[];
  total: number;
  paymentMethod: "cash" | "card" | "transfer";
  status: "pending" | "completed" | "cancelled";
  orderType?: "regular" | "special";
  cashierCode: string;
  cashierName?: string;
  createdAt: number;
}

// Flattened order used in reports / getTodaysOrders
export interface ReportOrder {
  id: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    category: string;
    isCustom: boolean;
  }[];
  total: number;
  timestamp: Date;
  paymentMethod: string;
  status: string;
  cashierCode: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  timestamp: Date;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'customer_balance';
  status: 'pending' | 'completed' | 'cancelled';
  cashierCode?: string;
  createdAt?: number;
  clientOrderId?: string;
  orderType?: 'regular' | 'special';
}

export interface SalesData {
  date: string;
  revenue: number;
  orders: number;
}

export interface CategorySales {
  category: string;
  amount: number;
  percentage: number;
}

// Enhanced role types
export type UserRole = 'superadmin' | 'manager' | 'vc' | 'supervisor' | 'admin' | 'cashier' | null;

// Access code for cashier/admin login
export interface AccessCode {
  id: string;
  code: string;
  role: 'cashier' | 'admin';
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  usedAt: Date | null;
  usedBy: string | null;
  isRevoked: boolean;
}

// Response from validateCode query
export interface ValidateCodeResponse {
  valid: boolean;
  error?: string;
  role?: string;
  code?: string;
  shift?: "morning" | "afternoon" | "evening";
}

// User profile for dashboard
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: Date;
}

// Customer record from Convex
export interface CustomerRecord {
  _id: Id<"customers">;
  customerId: string;
  firstName: string;
  lastName: string;
  department: string;
  classLevel: string;
  photo?: string;
  barcodeData: string;
  balance: number;
  isActive: boolean;
  expiryDate?: number;
  createdAt: number;
  updatedAt: number;
}

// Role permissions
export const ROLE_PERMISSIONS = {
  superadmin: {
    canManageAdmins: true,
    canManageCashiers: true,
    canViewAnalytics: true,
    canExportReports: true,
    canManageMenu: true,
    canProcessOrders: true,
    canGenerateAdminCodes: true,
    canGenerateCashierCodes: true,
  },
  admin: {
    canManageAdmins: false,
    canManageCashiers: true,
    canViewAnalytics: true,
    canExportReports: true,
    canManageMenu: true,
    canProcessOrders: true,
    canGenerateAdminCodes: false,
    canGenerateCashierCodes: true,
  },
  cashier: {
    canManageAdmins: false,
    canManageCashiers: false,
    canViewAnalytics: false,
    canExportReports: false,
    canManageMenu: false,
    canProcessOrders: true,
    canGenerateAdminCodes: false,
    canGenerateCashierCodes: false,
  },
} as const;

export type RolePermissions = typeof ROLE_PERMISSIONS[keyof typeof ROLE_PERMISSIONS];

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Admin users table
  adminUsers: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    role: v.optional(v.union(
      v.literal("superadmin"),
      v.literal("manager"),
      v.literal("vc"),
      v.literal("supervisor")
    )),
    createdAt: v.number(),
    createdBy: v.optional(v.id("adminUsers")),
    failedLoginAttempts: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Sessions table - stores active sessions
  sessions: defineTable({
    userId: v.optional(v.id("adminUsers")),
    code: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("cashier")),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_userId", ["userId"]),
  
  // Access codes for cashier login
  accessCodes: defineTable({
    code: v.string(),
    role: v.union(v.literal("admin"), v.literal("cashier")),
    shift: v.optional(v.union(v.literal("morning"), v.literal("afternoon"), v.literal("evening"))),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    usedCount: v.number(),
    maxUses: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_role", ["role"])
    .index("by_isActive", ["isActive"])
    .index("by_shift", ["shift"]),
  
  // Menu items stored in database
  menuItems: defineTable({
    name: v.string(),
    price: v.number(),
    category: v.string(), // Food categories, Drinks, or Special Orders
    image: v.optional(v.string()),
    available: v.boolean(),
    isSpecialOrder: v.optional(v.boolean()), // Flag for special order items
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_available", ["available"])
    .index("by_isSpecialOrder", ["isSpecialOrder"]),

  // Orders table
  orders: defineTable({
    items: v.array(v.object({
      menuItemId: v.optional(v.id("menuItems")), // Optional for custom items
      name: v.string(),
      price: v.number(),
      quantity: v.number(),
      category: v.optional(v.string()),
      isCustom: v.optional(v.boolean()), // Flag to identify custom items
    })),
    total: v.number(),
    paymentMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("transfer")),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
    orderType: v.optional(v.union(v.literal("regular"), v.literal("special"))), // Track special orders
    cashierCode: v.string(),
    cashierName: v.optional(v.string()),
    clientOrderId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_cashierCode", ["cashierCode"])
    .index("by_createdAt", ["createdAt"])
    .index("by_orderType", ["orderType"])
    .index("by_clientOrderId", ["clientOrderId"]),

  // Activity logs for audit trail
  activityLogs: defineTable({
    userId: v.optional(v.id("adminUsers")), // For admin users
    accessCode: v.optional(v.string()), // For cashier activities
    userEmail: v.optional(v.string()), // Store email for reference
    role: v.string(), // admin, cashier, superadmin, etc.
    action: v.string(), // login, logout, create_order, update_menu, delete_user, etc.
    details: v.optional(v.string()), // Additional context (JSON string)
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("failed")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_accessCode", ["accessCode"])
    .index("by_role", ["role"])
    .index("by_action", ["action"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  // Manual entries for previous amounts
  manualEntries: defineTable({
    amount: v.number(),
    description: v.string(), // Description of what this amount is for
    date: v.number(), // Date this amount relates to
    reason: v.string(), // Reason for manual entry (e.g., "System was down during update")
    addedBy: v.optional(v.id("adminUsers")), // Superadmin who added this
    addedByEmail: v.string(),
    createdAt: v.number(),
    orderId: v.optional(v.id("orders")), // Link to the order created for this manual entry
  })
    .index("by_date", ["date"])
    .index("by_addedBy", ["addedBy"])
    .index("by_createdAt", ["createdAt"])
    .index("by_orderId", ["orderId"]),

  // Special order delivery receipts
  specialOrders: defineTable({
    department: v.string(),
    staffName: v.string(),
    quantity: v.number(),
    itemDescription: v.string(),
    pricePerPack: v.number(),
    total: v.number(),
    deliveredBy: v.string(),
    date: v.number(),
    cashierCode: v.string(),
    cashierName: v.optional(v.string()),
    paymentStatus: v.optional(v.union(v.literal("paid"), v.literal("pending"))),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_date", ["date"]),
});

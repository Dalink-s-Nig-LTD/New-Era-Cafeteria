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
    resetCode: v.optional(v.string()),
    resetCodeExpiresAt: v.optional(v.number()),
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
    category: v.string(),
    image: v.optional(v.string()),
    available: v.boolean(),
    isSpecialOrder: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_available", ["available"])
    .index("by_isSpecialOrder", ["isSpecialOrder"]),

  // Orders table
  orders: defineTable({
    items: v.array(v.object({
      menuItemId: v.optional(v.id("menuItems")),
      name: v.string(),
      price: v.number(),
      quantity: v.number(),
      category: v.optional(v.string()),
      isCustom: v.optional(v.boolean()),
    })),
    total: v.number(),
    paymentMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("transfer"), v.literal("customer_balance")),
    customerId: v.optional(v.id("customers")),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
    orderType: v.optional(v.union(v.literal("regular"), v.literal("special"))),
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
    userId: v.optional(v.id("adminUsers")),
    accessCode: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    role: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
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
    description: v.string(),
    date: v.number(),
    reason: v.string(),
    addedBy: v.optional(v.id("adminUsers")),
    addedByEmail: v.string(),
    createdAt: v.number(),
    orderId: v.optional(v.id("orders")),
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

  // Customer profiles for barcode POS
  customers: defineTable({
    customerId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    department: v.string(),
    classLevel: v.string(),
    photo: v.optional(v.string()),
    barcodeData: v.string(),
    balance: v.number(),
    isActive: v.boolean(),
    expiryDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_customerId", ["customerId"])
    .index("by_barcodeData", ["barcodeData"])
    .index("by_department", ["department"])
    .index("by_isActive", ["isActive"]),

  // Shift settings for dynamic shift management
  shiftSettings: defineTable({
    shift: v.union(v.literal("morning"), v.literal("afternoon"), v.literal("evening")),
    startHour: v.number(),
    startMinute: v.number(),
    endHour: v.number(),
    endMinute: v.number(),
    isEnabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_shift", ["shift"]),

  // Customer transaction ledger
  customerTransactions: defineTable({
    customerId: v.id("customers"),
    type: v.union(v.literal("debit"), v.literal("credit")),
    amount: v.number(),
    balanceBefore: v.number(),
    balanceAfter: v.number(),
    description: v.string(),
    orderId: v.optional(v.id("orders")),
    addedBy: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_customerId", ["customerId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_type", ["type"]),
});

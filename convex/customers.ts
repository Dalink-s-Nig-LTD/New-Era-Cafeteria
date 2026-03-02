import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate unique barcode string with CUST-YYYYMMDD-XXXXXX format
function generateBarcodeString(): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 6; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CUST-${yyyy}${mm}${dd}-${rand}`;
}

// Create a new customer
export const createCustomer = mutation({
  args: {
    customerId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    department: v.string(),
    classLevel: v.string(),
    photo: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate customerId
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .first();
    if (existing) {
      throw new Error("A customer with this ID already exists.");
    }

    // Generate unique barcode
    const barcodeData = generateBarcodeString();

    const now = Date.now();
    const id = await ctx.db.insert("customers", {
      customerId: args.customerId,
      firstName: args.firstName,
      lastName: args.lastName,
      department: args.department,
      classLevel: args.classLevel,
      photo: args.photo,
      barcodeData,
      balance: 0,
      isActive: true,
      expiryDate: args.expiryDate,
      createdAt: now,
      updatedAt: now,
    });

    return { _id: id, barcodeData };
  },
});

// Update customer profile
export const updateCustomer = mutation({
  args: {
    id: v.id("customers"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    department: v.optional(v.string()),
    classLevel: v.optional(v.string()),
    photo: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const customer = await ctx.db.get(id);
    if (!customer) throw new Error("Customer not found.");

    const filtered: Record<string, string | number | undefined> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }
    await ctx.db.patch(id, filtered);
    return { success: true };
  },
});

// Get customer by barcode
export const getCustomerByBarcode = query({
  args: { barcodeData: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_barcodeData", (q) => q.eq("barcodeData", args.barcodeData))
      .first();
  },
});

// Get customer by Convex ID
export const getCustomerById = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get all customers
export const getAllCustomers = query({
  args: {
    search: v.optional(v.string()),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let customers;
    if (args.department) {
      customers = await ctx.db
        .query("customers")
        .withIndex("by_department", (q) => q.eq("department", args.department!))
        .collect();
    } else {
      customers = await ctx.db.query("customers").collect();
    }

    if (args.search) {
      const s = args.search.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.firstName.toLowerCase().includes(s) ||
          c.lastName.toLowerCase().includes(s) ||
          c.customerId.toLowerCase().includes(s) ||
          c.barcodeData.toLowerCase().includes(s)
      );
    }

    return customers.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Toggle active status
export const toggleCustomerActive = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found.");
    await ctx.db.patch(args.id, { isActive: !customer.isActive, updatedAt: Date.now() });
    return { isActive: !customer.isActive };
  },
});

// Delete customer
export const deleteCustomer = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

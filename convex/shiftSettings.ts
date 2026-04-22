import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const SHIFT_DEFAULTS = [
  { shift: "morning" as const, startHour: 7, startMinute: 0, endHour: 12, endMinute: 0 },
  { shift: "afternoon" as const, startHour: 12, startMinute: 0, endHour: 15, endMinute: 0 },
  { shift: "evening" as const, startHour: 15, startMinute: 0, endHour: 23, endMinute: 59 },
];

// Get all shift settings
export const getShiftSettings = query(async ({ db }) => {
  return await db.query("shiftSettings").collect();
});

// Get only enabled shift names
export const getEnabledShifts = query(async ({ db }) => {
  const all = await db.query("shiftSettings").collect();
  return all.filter((s) => s.isEnabled).map((s) => s.shift);
});

// Update a shift's settings
export const updateShiftSettings = mutation({
  args: {
    shift: v.union(v.literal("morning"), v.literal("afternoon"), v.literal("evening")),
    startHour: v.number(),
    startMinute: v.number(),
    endHour: v.number(),
    endMinute: v.number(),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shiftSettings")
      .withIndex("by_shift", (q) => q.eq("shift", args.shift))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        startHour: args.startHour,
        startMinute: args.startMinute,
        endHour: args.endHour,
        endMinute: args.endMinute,
        isEnabled: args.isEnabled,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("shiftSettings", {
        shift: args.shift,
        startHour: args.startHour,
        startMinute: args.startMinute,
        endHour: args.endHour,
        endMinute: args.endMinute,
        isEnabled: args.isEnabled,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Seed default shifts if none exist
export const seedDefaultShifts = mutation(async ({ db }) => {
  const existing = await db.query("shiftSettings").collect();
  if (existing.length > 0) return { seeded: false, message: "Shifts already exist" };

  for (const def of SHIFT_DEFAULTS) {
    await db.insert("shiftSettings", {
      ...def,
      isEnabled: true,
      updatedAt: Date.now(),
    });
  }

  return { seeded: true, message: "Default shifts created" };
});

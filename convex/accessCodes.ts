import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate a secure 4-character alphanumeric code
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0/O, 1/I/l)
  let code = '';
  for (let i = 0; i < 4; i++) {
    // Use crypto-secure random if available
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  return code;
}

// Validate an access code (for login)
export const validateCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const accessCode = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!accessCode) {
      return { valid: false, error: "Invalid access code" };
    }

    if (!accessCode.isActive) {
      return { valid: false, error: "Access code has been deactivated" };
    }

    if (accessCode.expiresAt && accessCode.expiresAt < Date.now()) {
      return { valid: false, error: "Access code has expired" };
    }

    if (accessCode.maxUses && accessCode.usedCount >= accessCode.maxUses) {
      return { valid: false, error: "Access code has reached maximum uses" };
    }

    // Check shift time restrictions using dynamic settings
    if (accessCode.shift) {
      const shiftConfig = await ctx.db
        .query("shiftSettings")
        .withIndex("by_shift", (q) => q.eq("shift", accessCode.shift!))
        .first();

      if (shiftConfig && !shiftConfig.isEnabled) {
        return { valid: false, error: "This shift is currently disabled" };
      }

      // Time restriction check commented out for flexibility — uncomment to enforce
      /*
      if (shiftConfig) {
        const now = new Date();
        const localHour = (now.getUTCHours() + 3) % 24;
        const localMinute = now.getUTCMinutes();
        const currentTimeInMinutes = localHour * 60 + localMinute;
        const startTime = shiftConfig.startHour * 60 + shiftConfig.startMinute;
        const endTime = shiftConfig.endHour * 60 + shiftConfig.endMinute;

        if (currentTimeInMinutes < startTime || currentTimeInMinutes > endTime) {
          const formatTime = (h: number, m: number) => {
            const period = h >= 12 ? "PM" : "AM";
            const hour12 = h % 12 || 12;
            return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
          };
          return {
            valid: false,
            error: `${accessCode.shift.charAt(0).toUpperCase() + accessCode.shift.slice(1)} shift access is only available from ${formatTime(shiftConfig.startHour, shiftConfig.startMinute)} to ${formatTime(shiftConfig.endHour, shiftConfig.endMinute)}`,
          };
        }
      }
      */
    }

    return {
      valid: true,
      role: accessCode.role,
      code: args.code,
    };
  },
});

// Record usage of an access code
export const useCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const accessCode = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!accessCode) {
      throw new Error("Incorrect Access Code");
    }

    if (!accessCode.isActive) {
      // Log failed access attempt
      await ctx.db.insert("activityLogs", {
        accessCode: args.code,
        role: "cashier",
        action: "login",
        details: "Failed login - code deactivated",
        status: "failed",
        createdAt: Date.now(),
      });
      throw new Error("Access code has been deactivated");
    }

    if (accessCode.expiresAt && accessCode.expiresAt < Date.now()) {
      throw new Error("Access code has expired");
    }

    if (accessCode.maxUses && accessCode.usedCount >= accessCode.maxUses) {
      throw new Error("Access code has reached maximum uses");
    }

    // Check shift time restrictions using dynamic settings
    if (accessCode.shift) {
      const shiftConfig = await ctx.db
        .query("shiftSettings")
        .withIndex("by_shift", (q) => q.eq("shift", accessCode.shift!))
        .first();

      if (shiftConfig && !shiftConfig.isEnabled) {
        await ctx.db.insert("activityLogs", {
          accessCode: args.code,
          role: "cashier",
          action: "login",
          details: `Failed login - ${accessCode.shift} shift is disabled`,
          status: "failed",
          createdAt: Date.now(),
        });
        throw new Error("This shift is currently disabled");
      }

      if (shiftConfig) {
        const now = new Date();
        const localHour = (now.getUTCHours() + 3) % 24;
        const localMinute = now.getUTCMinutes();
        const currentTimeInMinutes = localHour * 60 + localMinute;
        const startTime = shiftConfig.startHour * 60 + shiftConfig.startMinute;
        const endTime = shiftConfig.endHour * 60 + shiftConfig.endMinute;

        // Time restriction check commented out for flexibility — uncomment to enforce
        /*
        if (currentTimeInMinutes < startTime || currentTimeInMinutes > endTime) {
          const formatTime = (h: number, m: number) => {
            const period = h >= 12 ? "PM" : "AM";
            const hour12 = h % 12 || 12;
            return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
          };
          throw new Error(
            `${accessCode.shift.charAt(0).toUpperCase() + accessCode.shift.slice(1)} shift access is only available from ${formatTime(shiftConfig.startHour, shiftConfig.startMinute)} to ${formatTime(shiftConfig.endHour, shiftConfig.endMinute)}`
          );
        }
        */
      }
    }

    await ctx.db.patch(accessCode._id, {
      usedCount: accessCode.usedCount + 1,
    });

    // Log successful cashier login
    await ctx.db.insert("activityLogs", {
      accessCode: args.code,
      role: accessCode.role,
      action: "login",
      details: `Successful login${accessCode.shift ? ` - ${accessCode.shift} shift` : ""}`,
      status: "success",
      createdAt: Date.now(),
    });

    // Create session (expires in 8 hours)
    const sessionId = await ctx.db.insert("sessions", {
      code: args.code,
      role: accessCode.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });

    return { sessionId, code: args.code, role: accessCode.role };
  },
});

// Generate a new access code
export const generateAccessCode = mutation({
  args: {
    role: v.union(v.literal("admin"), v.literal("cashier")),
    shift: v.optional(v.union(v.literal("morning"), v.literal("afternoon"), v.literal("evening"))),
    expiresInDays: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Generate unique 4-digit code
    let code = generateCode();
    let existingCode = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    // Keep generating until we get a unique code
    while (existingCode) {
      code = generateCode();
      existingCode = await ctx.db
        .query("accessCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }

    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
      : undefined;

    await ctx.db.insert("accessCodes", {
      code,
      role: args.role,
      shift: args.shift,
      createdAt: Date.now(),
      expiresAt,
      usedCount: 0,
      maxUses: args.maxUses,
      isActive: true,
    });

    // Log access code generation
    await ctx.db.insert("activityLogs", {
      role: "admin",
      action: "generate_code",
      details: `Generated ${args.role} access code: ${code}${args.shift ? ` (${args.shift} shift)` : ""}`,
      status: "success",
      createdAt: Date.now(),
    });

    return { code, shift: args.shift, expiresAt, maxUses: args.maxUses };
  },
});

// Get all access codes
export const listAccessCodes = query({
  handler: async (ctx) => {
    const codes = await ctx.db.query("accessCodes").collect();
    return codes.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Deactivate an access code
export const deactivateCode = mutation({
  args: {
    codeId: v.id("accessCodes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codeId, {
      isActive: false,
    });
    return { success: true };
  },
});

// Delete an access code
export const deleteCode = mutation({
  args: {
    codeId: v.id("accessCodes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.codeId);
    return { success: true };
  },
});

// Reset all access codes (superadmin only)
export const resetAllAccessCodes = mutation({
  handler: async (ctx) => {
    // Get all access codes
    const accessCodes = await ctx.db.query("accessCodes").collect();
    
    // Delete each access code
    for (const code of accessCodes) {
      await ctx.db.delete(code._id);
    }
    
    // Also delete all sessions created with access codes
    const sessions = await ctx.db
      .query("sessions")
      .filter((q) => q.neq(q.field("code"), undefined))
      .collect();
    
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    
    return { 
      success: true, 
      deletedCodes: accessCodes.length,
      deletedSessions: sessions.length 
    };
  },
});

// Update the shift of an existing access code (superadmin only)
export const updateCodeShift = mutation({
  args: {
    codeId: v.id("accessCodes"),
    shift: v.union(v.literal("morning"), v.literal("afternoon"), v.literal("evening")),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db.get(args.codeId);
    if (!code) {
      throw new Error("Access code not found");
    }

    await ctx.db.patch(args.codeId, {
      shift: args.shift,
    });

    await ctx.db.insert("activityLogs", {
      role: "admin",
      action: "update_shift",
      details: `Updated access code ${code.code} shift to ${args.shift}`,
      status: "success",
      createdAt: Date.now(),
    });

    return { success: true, code: code.code, shift: args.shift };
  },
});

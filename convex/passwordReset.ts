import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function generateOTP(): string {
  const values = crypto.getRandomValues(new Uint32Array(1));
  return String(values[0] % 1_000_000).padStart(6, "0");
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltArray = Array.from(salt);
  return JSON.stringify({ salt: saltArray, hash: hashArray });
}

function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one number",
    };
  }
  return { valid: true };
}

export const generateAndStoreOTP = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      return { success: false };
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await ctx.db.patch(user._id, {
      resetCode: otp,
      resetCodeExpiresAt: expiresAt,
    });

    return { success: true, user, otp };
  },
});

export const verifyResetCode = query({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      return { valid: false, error: "User not found" };
    }

    if (!user.resetCode) {
      return { valid: false, error: "No active password reset request" };
    }

    if (user.resetCode !== args.code.trim()) {
      return { valid: false, error: "Invalid reset code" };
    }

    if (!user.resetCodeExpiresAt || user.resetCodeExpiresAt < Date.now()) {
      return { valid: false, error: "Reset code has expired" };
    }

    return { valid: true };
  },
});

export const resetPassword = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const passwordCheck = isValidPassword(args.newPassword);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.error || "Invalid password");
    }

    const normalizedEmail = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.resetCode) {
      throw new Error("No active password reset request for this email");
    }

    if (user.resetCode !== args.code.trim()) {
      throw new Error("Invalid reset code");
    }

    if (!user.resetCodeExpiresAt || user.resetCodeExpiresAt < Date.now()) {
      throw new Error("Reset code has expired. Please request a new one.");
    }

    const passwordHash = await hashPassword(args.newPassword);

    await ctx.db.patch(user._id, {
      passwordHash,
      resetCode: undefined,
      resetCodeExpiresAt: undefined,
      failedLoginAttempts: 0,
      lockedUntil: undefined,
    });

    await ctx.db.insert("activityLogs", {
      userId: user._id,
      userEmail: user.email,
      role: user.role || "admin",
      action: "password_reset_completed",
      details: "Password reset via OTP",
      status: "success",
      createdAt: Date.now(),
    });

    return { success: true, message: "Password reset successfully" };
  },
});

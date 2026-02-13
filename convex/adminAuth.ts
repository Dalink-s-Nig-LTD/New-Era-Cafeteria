import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Password hashing using PBKDF2 (Web Crypto API compatible)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltArray = Array.from(salt);
  
  // Combine salt and hash
  return JSON.stringify({ salt: saltArray, hash: hashArray });
}

// Verify password
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const { salt, hash } = JSON.parse(storedHash);
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      data,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new Uint8Array(salt),
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    
    const hashArray = Array.from(new Uint8Array(derivedBits));
    return JSON.stringify(hashArray) === JSON.stringify(hash);
  } catch (error) {
    return false;
  }
}

// Email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password complexity validation
function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

// Sign up new admin
export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate email format
    if (!isValidEmail(args.email)) {
      throw new Error("Invalid email format");
    }

    // Validate password complexity
    const passwordCheck = isValidPassword(args.password);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.error || "Invalid password");
    }

    // Validate name
    if (args.name.trim().length < 2 || args.name.length > 100) {
      throw new Error("Name must be between 2 and 100 characters");
    }

    // Check if email already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existing) {
      throw new Error("Email already registered");
    }

    // Check if this is the first user (make them superadmin)
    const existingUsers = await ctx.db.query("adminUsers").collect();
    const role = existingUsers.length === 0 ? "superadmin" : "manager";

    // Create admin user
    const userId = await ctx.db.insert("adminUsers", {
      email: args.email.toLowerCase(),
      passwordHash: await hashPassword(args.password),
      name: args.name.trim(),
      role,
      createdAt: Date.now(),
    });

    // Create session (expires in 24 hours)
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      role: "admin",
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    // Log activity
    await ctx.db.insert("activityLogs", {
      userId,
      userEmail: args.email.toLowerCase(),
      role,
      action: "signup",
      details: `New admin user created: ${args.name}`,
      status: "success",
      createdAt: Date.now(),
    });

    return { 
      success: true, 
      userId,
      sessionId: sessionId.toString(),
      user: {
        email: args.email,
        name: args.name,
        role,
      }
    };
  },
});

// Sign in admin
export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate email format
    if (!isValidEmail(args.email)) {
      throw new Error("Invalid email format");
    }

    // Find user
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user) {
      throw new Error("Wrong password or email");
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${minutesLeft} minutes`);
    }

    // Verify password
    let isValid = false;
    try {
      isValid = await verifyPassword(args.password, user.passwordHash);
    } catch (error) {
      console.error("Password verification error:", error);
      throw new Error("Wrong password or email");
    }
    
    if (!isValid) {
      // Log failed login attempt
      await ctx.db.insert("activityLogs", {
        userId: user._id,
        userEmail: user.email,
        role: user.role || "admin",
        action: "login",
        details: "Failed login attempt - incorrect password",
        status: "failed",
        createdAt: Date.now(),
      });
      
      // Increment failed attempts
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updates: { failedLoginAttempts: number; lockedUntil?: number } = { failedLoginAttempts: attempts };
      
      // Lock account after 5 failed attempts for 15 minutes
      if (attempts >= 5) {
        updates.lockedUntil = Date.now() + 15 * 60 * 1000;
      }
      
      await ctx.db.patch(user._id, updates);
      throw new Error("Wrong password or email");
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts || user.lockedUntil) {
      await ctx.db.patch(user._id, { 
        failedLoginAttempts: 0,
        lockedUntil: undefined,
      });
    }

    // Create session (expires in 24 hours)
    const sessionId = await ctx.db.insert("sessions", {
      userId: user._id,
      role: "admin",
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return { 
      success: true,
      userId: user._id,
      sessionId: sessionId.toString(),
      user: {
        email: user.email,
        name: user.name,
        role: user.role || "manager",
      }
    };
  },
});

// Get current admin user
export const getCurrentUser = query({
  args: {
    sessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, args) => {
    if (!args.sessionId) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.userId) return null;

    // Check if session expired
    if (session.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      email: user.email,
      name: user.name,
      role: user.role || "manager",
    };
  },
});

// Sign out
export const signOut = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    
    if (session) {
      // Log logout activity
      if (session.userId) {
        const user = await ctx.db.get(session.userId);
        if (user) {
          await ctx.db.insert("activityLogs", {
            userId: user._id,
            userEmail: user.email,
            role: user.role || "admin",
            action: "logout",
            details: "User logged out",
            status: "success",
            createdAt: Date.now(),
          });
        }
      } else if (session.code) {
        await ctx.db.insert("activityLogs", {
          accessCode: session.code,
          role: session.role,
          action: "logout",
          details: "Cashier logged out",
          status: "success",
          createdAt: Date.now(),
        });
      }
    }
    
    await ctx.db.delete(args.sessionId);
    return { success: true };
  },
});

// Get all admin users (superadmin only)
export const getAllAdmins = query({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db.query("adminUsers").collect();
    return admins.map((admin) => ({
      _id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role || "manager",
      createdAt: admin.createdAt,
    }));
  },
});

// Create admin user (superadmin only)
export const createAdmin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("superadmin"),
      v.literal("manager"),
      v.literal("vc"),
      v.literal("supervisor")
    ),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Verify requester is superadmin
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.userId) {
      throw new Error("Unauthorized");
    }

    const requester = await ctx.db.get(session.userId);
    if (!requester || requester.role !== "superadmin") {
      throw new Error("Only superadmins can create admin users");
    }

    // Check if email already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existing) {
      throw new Error("Email already registered");
    }

    // Create admin user
    const userId = await ctx.db.insert("adminUsers", {
      email: args.email.toLowerCase(),
      passwordHash: await hashPassword(args.password),
      name: args.name.trim(),
      role: args.role,
      createdAt: Date.now(),
      createdBy: requester._id,
    });

    // Log admin creation
    await ctx.db.insert("activityLogs", {
      userId: requester._id,
      userEmail: requester.email,
      role: requester.role || "superadmin",
      action: "create_user",
      details: `Created ${args.role} user: ${args.name} (${args.email})`,
      status: "success",
      createdAt: Date.now(),
    });

    return { success: true, userId };
  },
});

// Update admin role (superadmin only)
export const updateAdminRole = mutation({
  args: {
    adminId: v.id("adminUsers"),
    role: v.union(
      v.literal("superadmin"),
      v.literal("manager"),
      v.literal("vc"),
      v.literal("supervisor")
    ),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Verify requester is superadmin
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.userId) {
      throw new Error("Unauthorized");
    }

    const requester = await ctx.db.get(session.userId);
    if (!requester || requester.role !== "superadmin") {
      throw new Error("Only superadmins can update roles");
    }

    // Don't allow changing own role
    if (requester._id === args.adminId) {
      throw new Error("Cannot change your own role");
    }

    const targetUser = await ctx.db.get(args.adminId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.adminId, { role: args.role });
    
    // Log role update
    await ctx.db.insert("activityLogs", {
      userId: requester._id,
      userEmail: requester.email,
      role: requester.role || "superadmin",
      action: "update_user_role",
      details: `Updated ${targetUser.name}'s role from ${targetUser.role} to ${args.role}`,
      status: "success",
      createdAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Delete admin user (superadmin only)
export const deleteAdmin = mutation({
  args: {
    adminId: v.id("adminUsers"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Verify requester is superadmin
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.userId) {
      throw new Error("Unauthorized");
    }

    const requester = await ctx.db.get(session.userId);
    if (!requester || requester.role !== "superadmin") {
      throw new Error("Only superadmins can delete admin users");
    }

    // Don't allow deleting self
    if (requester._id === args.adminId) {
      throw new Error("Cannot delete yourself");
    }

    const targetUser = await ctx.db.get(args.adminId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    await ctx.db.delete(args.adminId);
    
    // Log user deletion
    await ctx.db.insert("activityLogs", {
      userId: requester._id,
      userEmail: requester.email,
      role: requester.role || "superadmin",
      action: "delete_user",
      details: `Deleted user: ${targetUser.name} (${targetUser.email})`,
      status: "success",
      createdAt: Date.now(),
    });
    
    // Delete all sessions for this user
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.adminId))
      .collect();
    
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    return { success: true };
  },
});

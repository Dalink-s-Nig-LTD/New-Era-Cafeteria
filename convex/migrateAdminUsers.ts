import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Migration to add role field to existing admin users
export const addRoleToExistingAdmins = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all admin users
    const allUsers = await ctx.db.query("adminUsers").collect();

    type AdminUser = {
      _id: Id<"adminUsers">;
      email: string;
      name: string;
      role?: "superadmin" | "manager" | "vc";
      // add other fields as needed
    };

    let updated = 0;
    for (const user of allUsers as AdminUser[]) {
      // Check if user already has a role
      if (!user.role) {
        // Assign default role based on email or name
        let role: "superadmin" | "manager" | "vc" = "manager";
        
        // Try to guess role from email or name
        const emailLower = user.email.toLowerCase();
        const nameLower = user.name.toLowerCase();
        
        if (emailLower.includes("super") || nameLower.includes("super")) {
          role = "superadmin";
        } else if (emailLower.includes("vc") || nameLower.includes("vc")) {
          role = "vc";
        } else if (emailLower.includes("manager") || nameLower.includes("manager")) {
          role = "manager";
        }
        
        // Update the user with the role
        await ctx.db.patch(user._id, { role });
        updated++;
      }
    }
    
    return { success: true, updated, total: allUsers.length };
  },
});

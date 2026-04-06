"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const result = await ctx.runMutation(api.passwordReset.generateAndStoreOTP, {
      email: args.email,
    });

    if (!result.success || !result.user || !result.otp) {
      return {
        success: true,
        message: "If this email is registered, a reset code has been sent.",
      };
    }

    const user = result.user;
    const otp = result.otp;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fffcf5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:520px;margin:28px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);border:1px solid #fde68a;">
    <div style="background:#f59e0b;padding:22px 20px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">New Era Cafeteria</h1>
      <p style="margin:6px 0 0;color:#fef3c7;font-size:12px;">Password Reset Request</p>
    </div>

    <div style="padding:28px 22px;">
      <p style="margin:0 0 16px;color:#1f2937;font-size:15px;">Hello <strong>${user.name || "Admin"}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
        Use the code below to reset your New Era Cafeteria admin password.
      </p>

      <div style="background:#fffbeb;border:1px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
        <p style="margin:0 0 10px;color:#92400e;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Reset Code</p>
        <p style="margin:0;color:#1f2937;font-size:34px;font-weight:900;letter-spacing:5px;font-family:'Courier New',monospace;">${otp}</p>
      </div>

      <p style="margin:0 0 14px;color:#6b7280;font-size:13px;">This code expires in 15 minutes.</p>
      <p style="margin:0;color:#92400e;font-size:12px;"><strong>Do not share this code with anyone.</strong></p>
    </div>

    <div style="background:#fffbeb;padding:14px 20px;text-align:center;border-top:1px solid #fde68a;">
      <p style="margin:0;color:#a16207;font-size:11px;">Redeemer's University, Ede, Osun State, Nigeria</p>
    </div>
  </div>
</body>
</html>`;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "New Era Cafeteria", email: "neweracafeteria@gmail.com" },
        to: [{ email: user.email }],
        subject: "Password Reset Code - New Era Cafeteria",
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send reset email: ${response.status} - ${errorText}`);
    }

    return {
      success: true,
      message: "If this email is registered, a reset code has been sent.",
    };
  },
});

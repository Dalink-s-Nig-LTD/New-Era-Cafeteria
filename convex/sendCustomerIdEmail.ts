"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const sendCustomerIdEmail = action({
  args: {
    to: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    customerId: v.string(),
    pdfBase64: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error("BREVO_API_KEY is not configured.");
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fffcf5;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);border:1px solid #fde68a;">
    
    <div style="background:#f59e0b;padding:24px 20px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;">New Era Cafeteria</h1>
      <p style="margin:4px 0 0;color:#fef3c7;font-size:13px;font-weight:500;">Digital ID Notification</p>
    </div>

    <div style="padding:32px 24px;">
      <p style="margin:0 0 16px;color:#1f2937;font-size:16px;">Dear <strong>${args.firstName} ${args.lastName}</strong>,</p>
      
      <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.7;">
        Your official **New Era Cafeteria Customer ID Card** is ready. We have attached it to this email as a PDF. Please follow the steps below to set up your card:
      </p>

      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#92400e;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">📋 What you need to do:</p>
        
        <table border="0" cellpadding="0" cellspacing="0" style="width:100%; color:#78350f; font-size:13px; line-height:1.8;">
          <tr>
            <td style="vertical-align:top; width:24px;">1️⃣</td>
            <td><strong>Download</strong> the attached PDF file to your device.</td>
          </tr>
          <tr>
            <td style="vertical-align:top; width:24px;">2️⃣</td>
            <td><strong>Print</strong> the card on standard size (85.6mm × 54mm).</td>
          </tr>
          <tr>
            <td style="vertical-align:top; width:24px;">3️⃣</td>
            <td><strong>Scan</strong> your barcode at the cafeteria to pay from your wallet.</td>
          </tr>
        </table>
      </div>

      <div style="background:#fefce8; border-left:4px solid #f59e0b; padding:12px 16px; margin-bottom:24px;">
        <p style="margin:0; color:#b45309; font-size:12px; font-style:italic;">
          <strong>Security Reminder:</strong> Your barcode is private. Treat it like a bank card to protect your wallet balance.
        </p>
      </div>

      <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;text-align:center;">
        Questions? Contact the Cafeteria Admin Office for assistance.
      </p>
    </div>

    <div style="background:#fffbeb;padding:20px 24px;text-align:center;border-top:1px solid #fde68a;">
      <p style="margin:0;color:#92400e;font-size:12px;font-weight:700;">New Era Cafeteria</p>
      <p style="margin:4px 0 0;color:#d97706;font-size:10px;">Redeemer's University, Ede, Osun State, Nigeria</p>
    </div>
  </div>
</body>
</html>`;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "New Era Cafeteria", email: "neweracafeteria@gmail.com" },
        to: [{ email: args.to }],
        subject: `Your New Era Cafeteria Customer ID - ${args.firstName} ${args.lastName}`,
        htmlContent,
        attachment: [
          {
            content: args.pdfBase64,
            name: `ID_${args.firstName}_${args.lastName}.pdf`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
    }

    return { success: true };
  },
});

"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

function buildReceiptText(args: {
  department: string;
  staffName: string;
  quantity: number;
  itemDescription: string;
  pricePerPack: number;
  total: number;
  deliveredBy: string;
  date: string;
  paymentStatus: string;
}): string {
  const W = 42;
  const SEP = "=".repeat(W);
  const DASH = "-".repeat(W);
  const center = (s: string) => {
    const sp = Math.max(0, Math.floor((W - s.length) / 2));
    return " ".repeat(sp) + s;
  };
  const pad = (l: string, r: string) => {
    const sp = Math.max(1, W - l.length - r.length);
    return l + " ".repeat(sp) + r;
  };

  const lines: string[] = [];
  lines.push(SEP);
  lines.push(center("New Era Cafeteria"));
  lines.push(center("Redeemer's University, Ede,"));
  lines.push(center("Osun State, Nigeria"));
  lines.push(SEP);
  lines.push(center("SPECIAL ORDER DELIVERY RECEIPT"));
  lines.push(DASH);
  lines.push(pad("Department:", args.department));
  lines.push(pad("Staff In Charge:", args.staffName));
  lines.push(DASH);
  lines.push(pad("Quantity:", `${args.quantity} packs`));
  lines.push(pad("Item:", args.itemDescription));
  lines.push(pad("Price Per Pack:", `N${args.pricePerPack.toLocaleString()}`));
  lines.push(DASH);
  lines.push(pad("TOTAL:", `N${args.total.toLocaleString()}`));
  lines.push(DASH);
  lines.push(pad("Payment:", args.paymentStatus === "paid" ? "PAID" : "PENDING"));
  lines.push(pad("Delivered By:", args.deliveredBy));
  lines.push("                  (New Era Cafeteria)");
  lines.push(DASH);
  lines.push("");
  lines.push("Received By: ________________________");
  lines.push(`  Name:  ${args.staffName}`);
  lines.push(`  Date:  ${args.date}`);
  lines.push("");
  lines.push("Delivered By: ________________________");
  lines.push(`  Name:  ${args.deliveredBy}`);
  lines.push(`  Date:  ${args.date}`);
  lines.push(SEP);
  lines.push(center("Thank you for your business!"));
  lines.push("");
  return lines.join("\n");
}

export const sendReceiptEmail = action({
  args: {
    to: v.string(),
    department: v.string(),
    staffName: v.string(),
    quantity: v.number(),
    itemDescription: v.string(),
    pricePerPack: v.number(),
    total: v.number(),
    deliveredBy: v.string(),
    date: v.string(),
    paymentStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error("BREVO_API_KEY is not configured. Add it in your Convex dashboard under Settings > Environment Variables.");
    }

    const receiptText = buildReceiptText(args);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.12);">
    <!-- Header -->
    <div style="background:#1a1a2e;padding:28px 24px;text-align:center;box-sizing:border-box;">
      <div style="width:60px;height:60px;border-radius:50%;background:#ffffff;margin:0 auto 12px;line-height:60px;font-size:28px;font-weight:900;color:#1a1a2e;">N</div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;text-align:center;">New Era Cafeteria</h1>
      <p style="margin:6px 0 0;color:#a0a0c0;font-size:12px;text-align:center;">Special Order Delivery Receipt</p>
    </div>
    <!-- Receipt body -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:28px 24px;">
      <pre style="font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.5;white-space:pre;font-weight:600;color:#1a1a2e;margin:0;background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;padding:20px;overflow-x:auto;text-align:left;display:inline-block;">${receiptText}</pre>
    </td></tr></table>
    <!-- Footer -->
    <div style="background:#f8f8f8;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;color:#888;font-size:11px;">This is an automated receipt from New Era Cafeteria</p>
      <p style="margin:4px 0 0;color:#aaa;font-size:10px;">Redeemer's University, Ede, Osun State, Nigeria</p>
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
        subject: `Special Order Receipt - ${args.department} (${args.date})`,
        htmlContent,
      }),
    });

    const responseText = await response.text();
    console.log("Brevo API response status:", response.status, "body:", responseText);
    
    if (!response.ok) {
      console.error("Brevo API error:", response.status, responseText);
      throw new Error(`Failed to send email: ${response.status} - ${responseText}`);
    }

    return { success: true, messageId: responseText };
  },
});

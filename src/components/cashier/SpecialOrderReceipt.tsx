import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Printer,
  Loader2,
  Download,
  Mail,
  Send,
  Share2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useMutation, useAction } from "convex/react";
import { api } from "@/lib/convexApi";
import jsPDF from "jspdf";
import { orderQueue } from "@/lib/orderQueue";
import {
  isTauri,
  printSpecialOrderReceiptTauri,
  autoSelectDefaultPrinter,
} from "@/lib/tauriPrint";
import type { SpecialOrderReceiptData } from "@/lib/escpos";
import { format } from "date-fns";
import type { CartItem } from "@/types/cafeteria";

interface SpecialOrderReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  // Cart-mode props
  cartItems?: CartItem[];
  cartTotal?: number;
  paymentMethod?: "cash" | "card" | "transfer";
  onOrderCompleted?: () => void;
}

export function SpecialOrderReceipt({
  isOpen,
  onClose,
  cartItems,
  cartTotal,
  paymentMethod,
  onOrderCompleted,
}: SpecialOrderReceiptProps) {
  const { code, userName } = useAuth();
  const { completeOrder } = useCart();
  const createSpecialOrder = useMutation(api.specialOrders.createSpecialOrder);
  const sendReceiptEmail = useAction(
    (api as any).sendReceiptEmail.sendReceiptEmail,
  );

  const isCartMode = !!cartItems && cartItems.length > 0;

  const [department, setDepartment] = useState("");
  const [staffName, setStaffName] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [itemDescription, setItemDescription] = useState("Special Order");
  const [pricePerPack, setPricePerPack] = useState<number | "">("");
  const [deliveredBy, setDeliveredBy] = useState(userName || "");
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">(
    "paid",
  );
  const [printing, setPrinting] = useState(false);
  const [emailAddresses, setEmailAddresses] = useState<string[]>([""]);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Pre-fill from cart items when in cart mode
  useEffect(() => {
    if (isCartMode && cartItems) {
      const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const desc = cartItems.map((item) => item.name).join(", ");
      const totalPrice = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const avgPrice = totalQty > 0 ? Math.round(totalPrice / totalQty) : 0;

      setQuantity(totalQty);
      setItemDescription(desc);
      setPricePerPack(avgPrice);
    }
  }, [isCartMode, cartItems]);

  const total =
    typeof quantity === "number" && typeof pricePerPack === "number"
      ? quantity * pricePerPack
      : 0;

  const isValid =
    department.trim() &&
    staffName.trim() &&
    typeof quantity === "number" &&
    quantity > 0 &&
    typeof pricePerPack === "number" &&
    pricePerPack > 0 &&
    deliveredBy.trim();

  const formattedDate = (() => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  })();

  const buildPlainReceipt = (): string => {
    const W = 42; // character width for 80mm paper
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
    lines.push(pad("Department:", department));
    lines.push(pad("Staff In Charge:", staffName));
    lines.push(DASH);
    lines.push(pad("Quantity:", `${quantity} packs`));
    lines.push(pad("Item:", itemDescription));
    lines.push(
      pad("Price Per Pack:", `N${Number(pricePerPack).toLocaleString()}`),
    );
    lines.push(DASH);
    lines.push(pad("TOTAL:", `N${total.toLocaleString()}`));
    lines.push(DASH);
    lines.push(pad("Payment:", paymentStatus === "paid" ? "PAID" : "PENDING"));
    lines.push(pad("Delivered By:", deliveredBy));
    lines.push("                  (New Era Cafeteria)");
    lines.push(DASH);
    lines.push("");
    lines.push("Received By: ________________________");
    lines.push(`  Name:  ${staffName}`);
    lines.push(`  Date:  ${formattedDate}`);
    lines.push("");
    lines.push("Delivered By: ________________________");
    lines.push(`  Name:  ${deliveredBy}`);
    lines.push(`  Date:  ${formattedDate}`);
    lines.push(SEP);
    lines.push(center("Thank you for your business!"));
    lines.push("");
    return lines.join("\n");
  };

  const triggerBrowserPrint = () => {
    const text = buildPlainReceipt();
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "absolute";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);
    const printDoc =
      printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!printDoc) return;
    printDoc.write(`<html><head><title>Special Order Receipt</title><style>
      @page { size: 80mm auto; margin: 0; }
      * { margin:0; padding:0; }
      body { margin:0; padding:0; width:80mm; max-width:80mm; overflow:hidden; background:white; }
    </style></head><body><pre style="font-family:'Courier New',Courier,monospace;font-size:9.5px;font-weight:600;margin:0;padding:1mm 2mm;white-space:pre;overflow:hidden;width:100%;max-width:76mm;box-sizing:border-box;">${text}</pre></body></html>`);
    printDoc.close();
    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(printFrame), 100);
    }, 300);
  };

  const handleDownloadPDF = () => {
    if (!isValid) return;
    const doc = new jsPDF({ unit: "mm", format: [80, 180] });
    const W = 76;
    let y = 8;
    const center = (text: string, size: number) => {
      doc.setFontSize(size);
      const tw = doc.getTextWidth(text);
      doc.text(text, (80 - tw) / 2, y);
      y += size * 0.5;
    };
    const row = (left: string, right: string, size = 9) => {
      doc.setFontSize(size);
      doc.text(left, 4, y);
      const rw = doc.getTextWidth(right);
      doc.text(right, W - rw, y);
      y += size * 0.45;
    };

    doc.setFont("courier", "bold");
    center("New Era Cafeteria", 12);
    y += 1;
    center("Redeemer's University, Ede,", 8);
    center("Osun State, Nigeria", 8);
    y += 2;
    doc.setLineWidth(0.3);
    doc.line(4, y, W, y);
    y += 3;
    center("SPECIAL ORDER DELIVERY RECEIPT", 9);
    y += 2;
    doc.line(4, y, W, y);
    y += 3;

    row("Department:", department);
    row("Staff In Charge:", staffName);
    y += 1;
    doc.line(4, y, W, y);
    y += 3;
    row("Quantity:", `${quantity} packs`);
    row("Item:", itemDescription);
    row("Price Per Pack:", `N${Number(pricePerPack).toLocaleString()}`);
    y += 1;
    doc.line(4, y, W, y);
    y += 3;
    row("TOTAL:", `N${total.toLocaleString()}`, 11);
    y += 1;
    doc.line(4, y, W, y);
    y += 3;
    row("Payment:", paymentStatus === "paid" ? "PAID" : "PENDING");
    row("Delivered By:", deliveredBy);
    y += 4;
    doc.setFontSize(8);
    doc.text("Received By: ________________________", 4, y);
    y += 4;
    row("Name:", staffName, 8);
    row("Date:", formattedDate, 8);
    y += 3;
    doc.text("Delivered By: ________________________", 4, y);
    y += 4;
    row("Name:", deliveredBy, 8);
    row("Date:", formattedDate, 8);
    y += 4;
    doc.line(4, y, W, y);
    y += 3;
    center("Thank you for your business!", 8);

    doc.save(`special_order_${department.replace(/\s+/g, "_")}_${dateStr}.pdf`);
    toast.success("PDF downloaded");
  };

  const handleSendEmail = async () => {
    const validEmails = emailAddresses.filter((e) => e.trim());
    if (!isValid || validEmails.length === 0) return;
    setSendingEmail(true);
    try {
      await Promise.all(
        validEmails.map((email) =>
          sendReceiptEmail({
            to: email.trim(),
            department,
            staffName,
            quantity: Number(quantity),
            itemDescription,
            pricePerPack: Number(pricePerPack),
            total,
            deliveredBy,
            date: formattedDate,
            paymentStatus,
          }),
        ),
      );
      toast.success(`Receipt sent to ${validEmails.join(", ")}`);
      setShowEmailInput(false);
      setEmailAddresses([""]);
    } catch (error) {
      console.error("Email send error:", error);
      toast.error("Failed to send email. Check your Brevo API key.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePrint = async () => {
    if (!isValid) return;
    setPrinting(true);

    const orderData = {
      department,
      staffName,
      quantity: Number(quantity),
      itemDescription,
      pricePerPack: Number(pricePerPack),
      total,
      deliveredBy,
      date: new Date(dateStr).getTime(),
      cashierCode: code || "unknown",
      cashierName: userName || undefined,
      paymentStatus,
    };

    try {
      // 1. Save to local queue
      const queueId = await orderQueue.addSpecialOrder(orderData);
      console.log("Special order saved locally:", queueId);

      // 2. Try Convex sync
      try {
        await createSpecialOrder(orderData);
        await orderQueue.updateSpecialOrderStatus(queueId, "synced");
        console.log("Special order synced to Convex");
      } catch (syncError) {
        console.warn("Convex sync failed, will retry later:", syncError);
      }

      // 3. If cart mode, also complete the regular order (with special type)
      if (isCartMode && paymentMethod) {
        completeOrder(paymentMethod);
      }

      // 4. Print
      const receiptData: SpecialOrderReceiptData = {
        department,
        staffName,
        quantity: Number(quantity),
        itemDescription,
        pricePerPack: Number(pricePerPack),
        total,
        deliveredBy,
        date: formattedDate,
        paymentStatus,
      };

      let printed = false;
      if (isTauri()) {
        await autoSelectDefaultPrinter();
        printed = await printSpecialOrderReceiptTauri(receiptData);
      }

      if (!printed) {
        triggerBrowserPrint();
      }

      toast.success("Special order receipt printed & saved");
      // Reset form
      setDepartment("");
      setStaffName("");
      setQuantity("");
      setItemDescription("Special Order");
      setPricePerPack("");
      setDeliveredBy(userName || "");
      setDateStr(format(new Date(), "yyyy-MM-dd"));
      setPaymentStatus("paid");

      if (isCartMode && onOrderCompleted) {
        onOrderCompleted();
      }
      onClose();
    } catch (error) {
      console.error("Special order error:", error);
      toast.error("Failed to process special order");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] flex flex-col"
        aria-describedby="special-order-desc"
      >
        <DialogHeader>
          <DialogTitle>Special Order Delivery Receipt</DialogTitle>
        </DialogHeader>
        <span id="special-order-desc" className="sr-only">
          Fill in special order details and print receipt
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-auto">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="department">Department *</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. VC's Office"
              />
            </div>
            <div>
              <Label htmlFor="staffName">Staff in Charge *</Label>
              <Input
                id="staffName"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Recipient name"
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity (packs) *</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="0"
                readOnly={isCartMode}
                className={isCartMode ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="itemDescription">Item Description</Label>
              <Input
                id="itemDescription"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                readOnly={isCartMode}
                className={isCartMode ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="pricePerPack">Price Per Pack (₦) *</Label>
              <Input
                id="pricePerPack"
                type="number"
                min={0}
                value={pricePerPack}
                onChange={(e) =>
                  setPricePerPack(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="0"
                readOnly={isCartMode}
                className={isCartMode ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="deliveredBy">Delivered By</Label>
              <Input
                id="deliveredBy"
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>

            {/* Payment Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Payment Status</Label>
                <p className="text-xs text-muted-foreground">
                  {paymentStatus === "paid"
                    ? "Payment received"
                    : "Payment pending"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${paymentStatus === "pending" ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  Pending
                </span>
                <Switch
                  checked={paymentStatus === "paid"}
                  onCheckedChange={(checked) =>
                    setPaymentStatus(checked ? "paid" : "pending")
                  }
                />
                <span
                  className={`text-xs font-medium ${paymentStatus === "paid" ? "text-green-600" : "text-muted-foreground"}`}
                >
                  Paid
                </span>
              </div>
            </div>

            {total > 0 && (
              <div className="p-3 rounded-lg bg-muted text-center">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-lg font-bold text-foreground">
                  ₦{total.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className="border rounded-lg p-3 bg-white text-black overflow-auto flex flex-col">
            <pre className="font-mono text-[13px] leading-snug whitespace-pre-wrap font-bold flex-1">
              {buildPlainReceipt()}
            </pre>
          </div>
        </div>

        {/* Action Buttons - below the grid */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={handlePrint}
              disabled={!isValid || printing}
            >
              {printing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              {printing ? "Printing..." : "Print Receipt"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!isValid}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover">
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowEmailInput(!showEmailInput)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email Receipt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {showEmailInput && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              {emailAddresses.map((email, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    type="email"
                    placeholder={`recipient${idx + 1}@example.com`}
                    value={email}
                    onChange={(e) => {
                      const updated = [...emailAddresses];
                      updated[idx] = e.target.value;
                      setEmailAddresses(updated);
                    }}
                    className="flex-1"
                  />
                  {emailAddresses.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        setEmailAddresses(
                          emailAddresses.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                {emailAddresses.length < 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setEmailAddresses([...emailAddresses, ""])}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add recipient
                  </Button>
                )}
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={handleSendEmail}
                  disabled={
                    !emailAddresses.some((e) => e.trim()) || sendingEmail
                  }
                >
                  {sendingEmail ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-1" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useMutation } from "convex/react";
import { api } from "@/lib/convexApi";
import { orderQueue } from "@/lib/orderQueue";
import { isTauri, printSpecialOrderReceiptTauri, autoSelectDefaultPrinter } from "@/lib/tauriPrint";
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

  const isCartMode = !!cartItems && cartItems.length > 0;

  const [department, setDepartment] = useState("");
  const [staffName, setStaffName] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [itemDescription, setItemDescription] = useState("Special Order");
  const [pricePerPack, setPricePerPack] = useState<number | "">("");
  const [deliveredBy, setDeliveredBy] = useState(userName || "");
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("paid");
  const [printing, setPrinting] = useState(false);

  // Pre-fill from cart items when in cart mode
  useEffect(() => {
    if (isCartMode && cartItems) {
      const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const desc = cartItems.map((item) => item.name).join(", ");
      const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const avgPrice = totalQty > 0 ? Math.round(totalPrice / totalQty) : 0;

      setQuantity(totalQty);
      setItemDescription(desc);
      setPricePerPack(avgPrice);
    }
  }, [isCartMode, cartItems]);

  const total = (typeof quantity === "number" && typeof pricePerPack === "number")
    ? quantity * pricePerPack : 0;

  const isValid = department.trim() && staffName.trim() && typeof quantity === "number" && quantity > 0
    && typeof pricePerPack === "number" && pricePerPack > 0 && deliveredBy.trim();

  const formattedDate = (() => {
    try { return format(new Date(dateStr), "dd/MM/yyyy"); } catch { return dateStr; }
  })();

  const buildPlainReceipt = (): string => {
    const W = 40;
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
    lines.push(pad("Price Per Pack:", `N${Number(pricePerPack).toLocaleString()}`));
    lines.push(DASH);
    lines.push(pad("TOTAL:", `N${total.toLocaleString()}`));
    lines.push(DASH);
    lines.push(pad("Payment:", paymentStatus === "paid" ? "PAID" : "PENDING"));
    lines.push(pad("Delivered By:", deliveredBy));
    lines.push("                    (New Era Cafeteria)");
    lines.push(DASH);
    lines.push("");
    lines.push("Received By: ________________________");
    lines.push(pad("Name:", staffName));
    lines.push(pad("Date:", formattedDate));
    lines.push("");
    lines.push("Delivered By: ________________________");
    lines.push(pad("Name:", deliveredBy));
    lines.push(pad("Date:", formattedDate));
    lines.push(SEP);
    lines.push(center("Thank you for your business!"));
    lines.push(SEP);
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
    const printDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!printDoc) return;
    printDoc.write(`<html><head><title>Special Order Receipt</title><style>
      @page { size: 80mm auto; margin: 0; }
      * { margin:0; padding:0; }
      body { margin:0; padding:0; width:80mm; background:white; }
    </style></head><body><pre style="font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;margin:0;padding:2mm;white-space:pre;overflow:hidden;">${text}</pre></body></html>`);
    printDoc.close();
    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(printFrame), 100);
    }, 300);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="special-order-desc">
        <DialogHeader>
          <DialogTitle>Special Order Delivery Receipt</DialogTitle>
        </DialogHeader>
        <span id="special-order-desc" className="sr-only">Fill in special order details and print receipt</span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="department">Department *</Label>
              <Input id="department" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. VC's Office" />
            </div>
            <div>
              <Label htmlFor="staffName">Staff in Charge *</Label>
              <Input id="staffName" value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Recipient name" />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity (packs) *</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={e => setQuantity(e.target.value ? Number(e.target.value) : "")}
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
                onChange={e => setItemDescription(e.target.value)}
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
                onChange={e => setPricePerPack(e.target.value ? Number(e.target.value) : "")}
                placeholder="0"
                readOnly={isCartMode}
                className={isCartMode ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="deliveredBy">Delivered By</Label>
              <Input id="deliveredBy" value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} />
            </div>

            {/* Payment Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Payment Status</Label>
                <p className="text-xs text-muted-foreground">
                  {paymentStatus === "paid" ? "Payment received" : "Payment pending"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${paymentStatus === "pending" ? "text-amber-600" : "text-muted-foreground"}`}>
                  Pending
                </span>
                <Switch
                  checked={paymentStatus === "paid"}
                  onCheckedChange={(checked) => setPaymentStatus(checked ? "paid" : "pending")}
                />
                <span className={`text-xs font-medium ${paymentStatus === "paid" ? "text-green-600" : "text-muted-foreground"}`}>
                  Paid
                </span>
              </div>
            </div>

            {total > 0 && (
              <div className="p-3 rounded-lg bg-muted text-center">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-lg font-bold text-foreground">₦{total.toLocaleString()}</span>
              </div>
            )}

            <Button className="w-full" onClick={handlePrint} disabled={!isValid || printing}>
              {printing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
              {printing ? "Processing..." : "Print & Save"}
            </Button>
          </div>

          {/* Live Preview */}
          <div className="border rounded-lg p-4 bg-white text-black overflow-auto max-h-[60vh]">
            <pre className="font-mono text-[12px] leading-tight whitespace-pre-wrap font-bold">{buildPlainReceipt()}</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useRef, useEffect, useState } from "react";
import {
  isTauri,
  printReceiptTauri,
  autoSelectDefaultPrinter,
} from "@/lib/tauriPrint";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, CheckCircle, Loader2 } from "lucide-react";
import { Order } from "@/types/cafeteria";
import { format } from "date-fns";

// Helper to format order number as 'DD-MM-00001' (increments per day)
function formatOrderNumber(order: Order) {
  if (/^\d{2}-\d{2}-\d{5}$/.test(order.id)) return order.id;
  const date =
    order.timestamp instanceof Date
      ? order.timestamp
      : new Date(order.timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const num = order.id.replace(/\D/g, "").slice(-5).padStart(5, "0");
  return `${day}-${month}-${num}`;
}

// Helper to categorize items into food and drinks
function categorizeItems(
  items: { name: string; price: number; quantity: number; category?: string }[],
) {
  const food: typeof items = [];
  const drinks: typeof items = [];
  items.forEach((item) => {
    if (
      item.category?.toLowerCase() === "drink" ||
      item.category?.toLowerCase() === "drinks"
    ) {
      drinks.push(item);
    } else {
      food.push(item);
    }
  });
  return { food, drinks };
}

interface ReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

// POS Receipt Component
const POSReceipt = ({
  order,
  type,
}: {
  order: Order;
  type: "food" | "drinks";
}) => {
  const { food, drinks } = categorizeItems(order.items);
  const items = type === "food" ? food : drinks;
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  if (items.length === 0) return null;
  return (
    <div
      className="pos-receipt"
      style={{
        width: "80mm",
        maxWidth: "80mm",
        margin: 0,
        padding: "3mm",
        backgroundColor: "white",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "12px",
        color: "#000",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Header: Name and Location */}
      <div
        style={{ textAlign: "center", marginBottom: "4px", lineHeight: "1.2" }}
      >
        <div style={{ fontWeight: "900", fontSize: "15px", letterSpacing: 1 }}>
          New Era Cafeteria
        </div>
        <div style={{ fontSize: "12px", marginTop: 2 }}>
          Redeemer's University, Ede, Osun State, Nigeria
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }}></div>

      {/* Order Details */}
      <div style={{ fontSize: "11px", marginBottom: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Order No:</span>
          <span style={{ fontWeight: "600" }}>{formatOrderNumber(order)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Date:</span>
          <span>{format(order.timestamp, "dd/MM/yyyy HH:mm")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Payment:</span>
          <span style={{ textTransform: "capitalize" }}>
            {order.paymentMethod}
          </span>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }}></div>

      {/* Items */}
      <div style={{ marginBottom: "4px" }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
              fontSize: "12px",
            }}
          >
            <span style={{ flex: 1 }}>
              {item.quantity}x {item.name}
            </span>
            <span
              style={{
                marginLeft: "8px",
                textAlign: "right",
                fontWeight: "500",
              }}
            >
              ₦{(item.price * item.quantity).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }}></div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "bold",
          fontSize: "13px",
          marginBottom: "8px",
        }}
      >
        <span>TOTAL</span>
        <span>₦{total.toLocaleString()}</span>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }}></div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "4px" }}>
        <p style={{ fontWeight: "600" }}>Thank you for your patronage!</p>
        <p style={{ marginTop: "2px" }}>Please come again</p>
      </div>
    </div>
  );
};

export function ReceiptModal({ order, isOpen, onClose }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printerReady, setPrinterReady] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [autoPrinted, setAutoPrinted] = useState(false);
  // Track which receipts have been printed
  const [printedReceipts, setPrintedReceipts] = useState<Set<'food' | 'drinks' | 'all'>>(new Set());
  const isDesktop = isTauri();

  // Reset printed state when modal closes or order changes
  useEffect(() => {
    if (!isOpen) {
      setAutoPrinted(false);
      setPrintedReceipts(new Set());
    }
  }, [isOpen]);

  // Build plain-text receipt that works reliably in WebView2 print
  const buildPlainReceipt = (items: { name: string; price: number; quantity: number; category?: string }[], orderData: Order, receiptType?: 'food' | 'drinks'): string => {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNo = formatOrderNumber(orderData);
    const dateStr = format(orderData.timestamp, "dd/MM/yyyy HH:mm");
    const W = 40; // character width for alignment
    const SEP = '-'.repeat(W);
    const pad = (l: string, r: string) => l + ' '.repeat(Math.max(1, W - l.length - r.length)) + r;
    const center = (s: string) => {
      const spaces = Math.max(0, Math.floor((W - s.length) / 2));
      return ' '.repeat(spaces) + s;
    };

    const lines: string[] = [];
    lines.push(center('New Era Cafeteria'));
    lines.push(center('Redeemer\'s University, Ede,'));
    lines.push(center('Osun State, Nigeria'));
    lines.push(SEP);
    lines.push(pad('Order No:', orderNo));
    lines.push(pad('Date:', dateStr));
    lines.push(pad('Payment:', orderData.paymentMethod.charAt(0).toUpperCase() + orderData.paymentMethod.slice(1)));
    lines.push(SEP);
    items.forEach(item => {
      const name = `${item.quantity}x ${item.name}`;
      const price = `N${(item.price * item.quantity).toLocaleString()}`;
      lines.push(pad(name.length > W - 10 ? name.substring(0, W - 10) : name, price));
    });
    lines.push(SEP);
    lines.push(pad('TOTAL', `N${total.toLocaleString()}`));
    lines.push(SEP);
    lines.push('');
    lines.push('  Thank you for your patronage!');
    lines.push('       Please come again');

    return lines.join('\n');
  };

  // Browser print using hidden iframe with plain text (works in WebView2)
  const triggerBrowserPrint = (type?: "food" | "drinks") => {
    if (!order) return;
    const { food: foodItems, drinks: drinkItems } = categorizeItems(order.items);
    
    const sections: string[] = [];
    if (type === 'food' || !type) {
      if (foodItems.length > 0) sections.push(buildPlainReceipt(foodItems, order, 'food'));
    }
    if (type === 'drinks' || !type) {
      if (drinkItems.length > 0) sections.push(buildPlainReceipt(drinkItems, order, 'drinks'));
    }
    if (sections.length === 0) return;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "absolute";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);

    const printDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!printDoc) return;

    const content = sections.map(s => `<pre style="font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;margin:0;padding:2mm;white-space:pre;overflow:hidden;">${s}</pre>`).join('<div style="page-break-before:always"></div>');
    printDoc.write(`<html><head><title>Receipt</title><style>
      @page { size: 80mm auto; margin: 0; }
      * { margin:0; padding:0; }
      body { margin:0; padding:0; width:80mm; background:white; }
    </style></head><body>${content}</body></html>`);
    printDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(printFrame); }, 100);
    }, 300);
    
    setPrintedReceipts(prev => new Set(prev).add(type || 'all'));
  };

  // Auto-detect printer and then auto-print on desktop
  useEffect(() => {
    if (!isDesktop || !isOpen || !order || autoPrinted || printing) {
      return;
    }

    const detectAndPrint = async () => {
      // First detect printer
      const printer = await autoSelectDefaultPrinter();
      const hasPrinter = !!printer?.connected;
      setPrinterReady(hasPrinter);
      
      if (printer) {
        console.log('Printer ready for receipt:', printer.name);
      }

      // Now attempt to print
      setAutoPrinted(true);
      setPrinting(true);
      
      const { food, drinks } = categorizeItems(order.items);
      const hasBoth = food.length > 0 && drinks.length > 0;
      
      try {
        let allSuccess = true;
        
        if (hasPrinter) {
          // Try thermal printer first
          if (hasBoth) {
            const foodSuccess = await printReceiptTauri(order, 'food');
            if (foodSuccess) {
              console.log('Food receipt printed');
              setPrintedReceipts(prev => new Set(prev).add('food'));
            } else {
              allSuccess = false;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const drinksSuccess = await printReceiptTauri(order, 'drinks');
            if (drinksSuccess) {
              console.log('Drinks receipt printed');
              setPrintedReceipts(prev => new Set(prev).add('drinks'));
            } else {
              allSuccess = false;
            }
            
            if (foodSuccess && drinksSuccess) {
              toast.success("Receipts printed successfully");
            } else if (!foodSuccess && !drinksSuccess) {
              allSuccess = false;
            } else {
              toast.warning("Some receipts failed to print");
            }
          } else {
            const success = await printReceiptTauri(order);
            if (success) {
              toast.success("Receipt printed successfully");
              setPrintedReceipts(prev => new Set(prev).add('all'));
            } else {
              allSuccess = false;
            }
          }
        } else {
          allSuccess = false;
        }
        
        // Fallback to browser print using iframe (not window.print)
        if (!allSuccess) {
          console.log('Thermal print failed or no printer, using browser print fallback');
          toast.info("No thermal printer - opening print dialog");
          if (hasBoth) {
            // Print food first, then drinks with delay
            setTimeout(() => {
              triggerBrowserPrint('food');
              setTimeout(() => {
                triggerBrowserPrint('drinks');
              }, 1000);
            }, 300);
          } else {
            setTimeout(() => {
              triggerBrowserPrint();
            }, 300);
          }
        }
      } catch (error) {
        console.error("Auto-print error:", error);
        toast.error("Failed to print receipt - trying browser print");
        if (hasBoth) {
          setTimeout(() => {
            triggerBrowserPrint('food');
            setTimeout(() => {
              triggerBrowserPrint('drinks');
            }, 1000);
          }, 300);
        } else {
          setTimeout(() => {
            triggerBrowserPrint();
          }, 300);
        }
      } finally {
        setPrinting(false);
      }
    };

    detectAndPrint();
  }, [isDesktop, isOpen, order, autoPrinted, printing]);

  if (!order) return null;

  const { food, drinks } = categorizeItems(order.items);
  const hasBoth = food.length > 0 && drinks.length > 0;

  const handlePrint = async (type?: "food" | "drinks") => {
    const printKey = type || 'all';
    
    // Desktop app: Try thermal printer first, fallback to browser
    if (isDesktop) {
      setPrinting(true);
      try {
        // Re-check printer status
        const printer = await autoSelectDefaultPrinter();
        const hasPrinter = !!printer?.connected;
        
        if (hasPrinter) {
          const success = await printReceiptTauri(order, type);
          if (success) {
            toast.success("Receipt printed successfully");
            setPrintedReceipts(prev => new Set(prev).add(printKey));
            setPrinting(false);
            return;
          }
        }
        
        // Fallback to browser print
        console.log('Using browser print fallback');
        toast.info("Using browser print dialog");
        triggerBrowserPrint(type);
      } catch (error) {
        console.error("Print error:", error);
        toast.error("Thermal print failed - using browser print");
        triggerBrowserPrint(type);
      } finally {
        setPrinting(false);
      }
      return;
    }

    // Web app: Use browser print dialog directly
    triggerBrowserPrint(type);
  };

  // Check if a specific receipt type has been printed
  const isPrinted = (type?: 'food' | 'drinks') => {
    const key = type || 'all';
    return printedReceipts.has(key) || printedReceipts.has('all');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md max-h-[80vh] overflow-y-auto"
        aria-describedby="receipt-modal-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="w-5 h-5" />
            Order Complete
          </DialogTitle>
        </DialogHeader>
        <span id="receipt-modal-desc" style={{ display: "none" }}>
          Receipt details and print options for the completed order.
        </span>

        <div ref={receiptRef} className="space-y-4">
          {food.length > 0 && <POSReceipt order={order} type="food" />}
          {drinks.length > 0 && <POSReceipt order={order} type="drinks" />}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={printing}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          {hasBoth ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handlePrint("food")}
                disabled={printing || isPrinted('food')}
              >
                {printing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isPrinted('food') ? (
                  <CheckCircle className="w-4 h-4 mr-2 text-success" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                {isPrinted('food') ? 'Printed' : 'Print Food'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handlePrint("drinks")}
                disabled={printing || isPrinted('drinks')}
              >
                {printing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isPrinted('drinks') ? (
                  <CheckCircle className="w-4 h-4 mr-2 text-success" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                {isPrinted('drinks') ? 'Printed' : 'Print Drinks'}
              </Button>
            </>
          ) : (
            <Button 
              className="flex-1" 
              onClick={() => handlePrint()} 
              disabled={printing || isPrinted()}
            >
              {printing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isPrinted() ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              {isPrinted() ? 'Printed' : 'Print Receipt'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

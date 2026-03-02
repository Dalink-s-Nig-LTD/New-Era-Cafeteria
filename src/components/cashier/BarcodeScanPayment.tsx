import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, useQuery, useMutation } from "@/lib/convexApi";
import { toast } from "sonner";
import {
  Loader2,
  ScanBarcode,
  Wallet,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface BarcodeScanPaymentProps {
  isOpen: boolean;
  onClose: () => void;
  cartTotal: number;
  onPaymentComplete: (customerId: Id<"customers">) => void;
}

export function BarcodeScanPayment({
  isOpen,
  onClose,
  cartTotal,
  onPaymentComplete,
}: BarcodeScanPaymentProps) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const customer = useQuery(
    api.customers.getCustomerByBarcode,
    scannedBarcode ? { barcodeData: scannedBarcode } : "skip",
  );
  const deductFunds = useMutation(api.customerFunds.deductFunds);

  useEffect(() => {
    if (isOpen) {
      setBarcodeInput("");
      setScannedBarcode("");
      setProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Global scanner intercept: while the payment dialog is open, any keystroke
  // re-routes focus to the barcode input so the QR/barcode scanner always lands
  // in the right field even if the cashier clicked elsewhere.
  useEffect(() => {
    if (!isOpen) return;
    const intercept = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.startsWith("F") && e.key.length > 1) return;
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", intercept);
    return () => document.removeEventListener("keydown", intercept);
  }, [isOpen]);

  const handleScan = () => {
    const code = barcodeInput.trim().toUpperCase();
    if (!code) return;
    setScannedBarcode(code);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleScan();
  };

  const handleConfirmPayment = async () => {
    if (!customer || !customer._id) return;
    if (customer.balance < cartTotal) {
      toast.error("Insufficient balance");
      return;
    }
    setProcessing(true);
    try {
      await deductFunds({
        customerId: customer._id as Id<"customers">,
        amount: cartTotal,
        description: `POS Purchase - ₦${cartTotal.toLocaleString()}`,
      });
      toast.success(
        `₦${cartTotal.toLocaleString()} deducted from ${customer.firstName}'s wallet`,
      );
      onPaymentComplete(customer._id as Id<"customers">);
      onClose();
    } catch (error: Error | unknown) {
      const message = error instanceof Error ? error.message : "Payment failed";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const hasSufficientBalance = customer && customer.balance >= cartTotal;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" aria-describedby="barcode-pay-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Wallet Payment
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Scan or enter the customer's barcode to deduct from their wallet
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Barcode Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
              Step 1: Scan or type the customer ID code
            </label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Scan QR / barcode or type code..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="flex-1 font-mono"
              />
              <Button onClick={handleScan} variant="outline" size="icon">
                <ScanBarcode className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Point the barcode scanner at the customer's ID card, or manually
              type the code and press Enter
            </p>
          </div>
          {/* Customer Info */}
          {scannedBarcode && customer === undefined && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {scannedBarcode && customer === null && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              No customer found for this barcode
            </div>
          )}

          {customer && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                Step 2: Confirm payment details
              </label>
              <div className="p-4 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Customer
                  </span>
                  <span className="font-semibold">
                    {customer.firstName} {customer.lastName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Department
                  </span>
                  <span className="text-sm">{customer.department}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Balance</span>
                  <span
                    className={`font-bold text-lg ${hasSufficientBalance ? "text-success" : "text-destructive"}`}
                  >
                    ₦{customer.balance.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted flex items-center justify-between">
                <span className="text-sm font-medium">Order Total</span>
                <span className="font-bold text-lg text-primary">
                  ₦{cartTotal.toLocaleString()}
                </span>
              </div>

              {!customer.isActive && (
                <div className="p-2 rounded bg-amber-100/80 text-amber-900 text-xs text-center">
                  This account is inactive
                </div>
              )}

              {!hasSufficientBalance && customer.isActive && (
                <div className="p-2 rounded bg-destructive/10 text-destructive text-xs text-center">
                  Insufficient balance (needs ₦
                  {(cartTotal - customer.balance).toLocaleString()} more)
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleConfirmPayment}
                disabled={
                  !hasSufficientBalance || !customer.isActive || processing
                }
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {processing
                  ? "Processing..."
                  : `Pay ₦${cartTotal.toLocaleString()}`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

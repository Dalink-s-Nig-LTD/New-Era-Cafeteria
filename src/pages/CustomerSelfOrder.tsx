import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { api, useQuery, useMutation } from "@/lib/convexApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  ArrowLeft,
  Wallet,
  Printer,
  Loader2,
  CreditCard,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getSqliteDB } from "@/lib/sqlite";
import {
  isTauri,
  printReceiptTauri,
  autoSelectDefaultPrinter,
} from "@/lib/tauriPrint";
import type { Id } from "../../convex/_generated/dataModel";
import type { CustomerRecord, Order } from "@/types/cafeteria";

import logo from "@/assets/logo.png";
import { BalanceCard } from "@/components/customer/BalanceCard";
import {
  CustomerNavBar,
  type CustomerTab,
} from "@/components/customer/CustomerNavBar";
import { CustomerWallet } from "@/components/customer/CustomerWallet";
import { CustomerHistory } from "@/components/customer/CustomerHistory";

type KioskStep = "scan" | "menu" | "checkout" | "success";

const STEP_LABELS: Record<KioskStep, string> = {
  scan: "Identify",
  menu: "Select Items",
  checkout: "Confirm",
  success: "Done",
};
const STEP_PROGRESS: Record<KioskStep, number> = {
  scan: 25,
  menu: 50,
  checkout: 75,
  success: 100,
};

interface CartItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
}

interface KioskMenuItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

function CustomerKiosk() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<KioskStep>("scan");
  const [activeTab, setActiveTab] = useState<CustomerTab>("menu");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [confirmedBalance, setConfirmedBalance] = useState<number | null>(null);
  const [selectedMenuType, setSelectedMenuType] = useState<"food" | "drinks">(
    "food",
  );
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [printing, setPrinting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Exit PIN dialog state
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitPin, setExitPin] = useState("");

  const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;

  const [cachedMenuItems, setCachedMenuItems] = useState<
    KioskMenuItem[] | null
  >(null);
  const [cachedCategories, setCachedCategories] = useState<string[] | null>(
    null,
  );
  const [cacheLoading, setCacheLoading] = useState(isDesktop);

  const remoteMenuItems = useQuery(api.menuItems.getAllMenuItems, {});
  const remoteCategories = useQuery(api.menuItems.getCategories, {});

  useEffect(() => {
    if (!isDesktop) return;

    const loadCachedMenu = async () => {
      try {
        const sqliteDB = getSqliteDB();
        if (!sqliteDB) {
          setCacheLoading(false);
          return;
        }
        const rows = await sqliteDB.getCachedMenuItems();
        setCachedMenuItems(rows as KioskMenuItem[]);

        const uniqueCategories = [
          "All",
          ...Array.from(new Set(rows.map((row) => row.category))).sort(),
        ];
        setCachedCategories(uniqueCategories);
      } catch (error) {
        console.error("Failed to load cached kiosk menu:", error);
      } finally {
        setCacheLoading(false);
      }
    };

    loadCachedMenu();
  }, [isDesktop]);

  const hasCachedMenu = !!cachedMenuItems && cachedMenuItems.length > 0;
  const menuItems = isDesktop
    ? hasCachedMenu
      ? cachedMenuItems
      : remoteMenuItems || []
    : remoteMenuItems;
  const categories = isDesktop
    ? hasCachedMenu
      ? cachedCategories
      : remoteCategories || ["All"]
    : remoteCategories;
  const hasValidPrefix =
    barcodeInput.startsWith("STU-") || barcodeInput.startsWith("CUST-");
  const customerLookupFromServer = useQuery(
    api.customers.getCustomerByBarcode,
    hasValidPrefix ? { barcodeData: barcodeInput } : "skip",
  );
  const [cachedCustomerLookup, setCachedCustomerLookup] =
    useState<CustomerRecord | null>(null);

  useEffect(() => {
    if (!isDesktop || !hasValidPrefix || !barcodeInput.trim()) {
      setCachedCustomerLookup(null);
      return;
    }

    const loadCachedCustomer = async () => {
      try {
        const sqliteDB = getSqliteDB();
        if (!sqliteDB) return;
        const cached = await sqliteDB.getCachedCustomerByBarcode(
          barcodeInput.trim(),
        );
        if (!cached) {
          setCachedCustomerLookup(null);
          return;
        }

        setCachedCustomerLookup({
          _id: cached._id as Id<"customers">,
          customerId: cached.customerId,
          firstName: cached.firstName,
          lastName: cached.lastName,
          department: cached.department,
          classLevel: cached.classLevel,
          photo: cached.photo,
          barcodeData: cached.barcodeData,
          balance: cached.balance,
          isActive: cached.isActive,
          expiryDate: cached.expiryDate,
          createdAt: cached.createdAt,
          updatedAt: cached.updatedAt,
        });
      } catch (error) {
        console.error("Failed to load cached customer lookup:", error);
      }
    };

    loadCachedCustomer();
  }, [isDesktop, hasValidPrefix, barcodeInput]);

  const customerLookup = customerLookupFromServer || cachedCustomerLookup;
  const createOrderWithBalancePayment = useMutation(
    api.orders.createOrderWithBalancePayment,
  );

  // PIN validation: validate locally from SQLite cache
  const [pinValidationError, setPinValidationError] = useState("");
  const [pinValidating, setPinValidating] = useState(false);

  useEffect(() => {
    if (step === "scan" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  // Global scanner intercept: any keystroke while on scan step re-routes focus to
  // the barcode input so a QR/barcode scanner always feeds into it regardless of
  // where the user last clicked.
  useEffect(() => {
    if (step !== "scan" || exitDialogOpen) return;
    const intercept = (e: KeyboardEvent) => {
      // Leave modifier combos and function keys alone
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.startsWith("F") && e.key.length > 1) return;
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", intercept);
    return () => document.removeEventListener("keydown", intercept);
  }, [step, exitDialogOpen]);

  // Navigation guard - prevent back button escape
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setExitDialogOpen(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Block keyboard shortcuts (Alt+Left, F12, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.key === "ArrowLeft") ||
        (e.altKey && e.key === "ArrowRight") ||
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "J")
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const validatePinLocally = useCallback(async () => {
    try {
      if (!isDesktop) {
        // On web, PIN validation not available locally
        setPinValidationError("PIN validation not available on web");
        setPinValidating(false);
        setExitPin("");
        return;
      }

      const sqliteDB = getSqliteDB();
      if (!sqliteDB) {
        setPinValidationError("Database unavailable");
        setPinValidating(false);
        setExitPin("");
        return;
      }

      const isValid = await sqliteDB.validateAccessCode(exitPin);
      if (isValid) {
        // PIN is valid, exit
        setExitDialogOpen(false);
        setExitPin("");
        setPinValidationError("");
        navigate("/");
      } else {
        setPinValidationError("Invalid access code");
        setExitPin("");
      }
    } catch (error) {
      console.error("PIN validation error:", error);
      setPinValidationError("Validation error");
      setExitPin("");
    } finally {
      setPinValidating(false);
    }
  }, [isDesktop, exitPin, navigate]);

  useEffect(() => {
    if (exitPin.length === 4) {
      setPinValidating(true);
      validatePinLocally();
    }
  }, [exitPin, validatePinLocally]);

  const handleExitDialogOpen = () => {
    setExitPin("");
    setPinValidationError("");
    setExitDialogOpen(true);
  };

  // Auto-proceed on barcode scan
  useEffect(() => {
    if (step === "scan" && customerLookup && hasValidPrefix) {
      if (customerLookup.isActive) {
        setCustomer(customerLookup as CustomerRecord);
        setStep("menu");
        toast({ title: `Welcome, ${customerLookup.firstName}!` });
      } else {
        toast({
          title: "Account inactive",
          description: "This customer account is deactivated.",
          variant: "destructive",
        });
      }
    }
  }, [customerLookup, hasValidPrefix, step, toast]);

  useEffect(() => {
    if (step === "success") {
      successTimerRef.current = setTimeout(() => resetKiosk(), 15000);
      return () => clearTimeout(successTimerRef.current);
    }
  }, [step]);

  const resetKiosk = () => {
    setStep("scan");
    setCustomer(null);
    setCart([]);
    setBarcodeInput("");
    setConfirmedBalance(null);
    setSelectedMenuType("food");
    setSelectedCategory("All");
    setCompletedOrder(null);
    setActiveTab("menu");
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      if (!hasValidPrefix) {
        toast({
          title: "Invalid QR code",
          description: "Please scan a valid customer QR code.",
          variant: "destructive",
        });
      }
    }
  };

  const handleContinueAfterScan = () => {
    if (customerLookup && customerLookup.isActive) {
      setCustomer(customerLookup as CustomerRecord);
      setStep("menu");
      toast({ title: `Welcome, ${customerLookup.firstName}!` });
    }
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const remainingBalance = (customer?.balance || 0) - cartTotal;

  const addToCart = (item: KioskMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c._id === item._id);
      if (existing) {
        return prev.map((c) =>
          c._id === item._id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          _id: item._id,
          name: item.name,
          price: item.price,
          category: item.category,
          quantity: 1,
        },
      ];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c._id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  };

  // Build an Order object for receipt printing
  const buildOrder = (orderId: string): Order => ({
    id: orderId,
    items: cart.map((c) => ({
      id: c._id,
      name: c.name,
      price: c.price,
      category: c.category,
      quantity: c.quantity,
      available: true,
    })),
    total: cartTotal,
    timestamp: new Date(),
    paymentMethod: "customer_balance",
    status: "completed",
    cashierCode: "KIOSK",
  });

  const handleCheckout = async () => {
    if (!customer || cartTotal <= 0 || cartTotal > customer.balance) return;
    setProcessing(true);
    try {
      const orderId = `KIOSK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const orderResult = await createOrderWithBalancePayment({
        items: cart.map((c) => ({
          menuItemId: c._id as Id<"menuItems">,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          category: c.category,
        })),
        total: cartTotal,
        status: "completed" as const,
        orderType: "regular" as const,
        cashierCode: "KIOSK",
        cashierName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer._id,
        clientOrderId: orderId,
        createdAt: Date.now(),
        description: `Kiosk order: ${cart
          .map((c) => (c.quantity > 1 ? `${c.name} x${c.quantity}` : c.name))
          .join(", ")}`,
      });

      // Save to SQLite locally
      try {
        const sqliteDB = getSqliteDB();
        if (sqliteDB) {
          await sqliteDB.addCustomerOrder({
            id: orderId,
            barcode: customer.barcodeData,
            customerName: `${customer.firstName} ${customer.lastName}`,
            items: cart.map((c) => ({
              name: c.name,
              price: c.price,
              quantity: c.quantity,
              category: c.category,
            })),
            total: cartTotal,
            paymentMethod: "customer_balance",
            paymentStatus: "paid",
            createdAt: Date.now(),
          });
        }
      } catch (sqlErr) {
        console.error("SQLite save failed (non-blocking):", sqlErr);
      }

      setConfirmedBalance(orderResult.balanceAfter);
      const order = buildOrder(orderId);
      setCompletedOrder(order);
      setStep("success");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Order failed";
      toast({
        title: "Order failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Print receipt
  const handlePrint = async () => {
    if (!completedOrder) return;
    setPrinting(true);
    try {
      if (isDesktop) {
        const printer = await autoSelectDefaultPrinter();
        if (printer?.connected) {
          const success = await printReceiptTauri(completedOrder);
          if (success) {
            toast({ title: "Receipt printed!" });
            setPrinting(false);
            return;
          }
        }
      }
      // Browser fallback
      triggerBrowserPrint(completedOrder);
    } catch {
      toast({ title: "Print failed", variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  };

  const triggerBrowserPrint = (order: Order) => {
    const W = 42;
    const SEP = "-".repeat(W);
    const pad = (l: string, r: string) =>
      l + " ".repeat(Math.max(1, W - l.length - r.length)) + r;
    const center = (s: string) =>
      " ".repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;

    const lines: string[] = [];
    lines.push(center("New Era Cafeteria"));
    lines.push(center("Redeemer's University, Ede"));
    lines.push(SEP);
    lines.push(pad("Date:", format(order.timestamp, "dd/MM/yyyy HH:mm")));
    lines.push(pad("Payment:", "Customer Balance"));
    lines.push(pad("Status:", "Paid"));
    lines.push(SEP);
    order.items.forEach((item) => {
      const name = `${item.quantity}x ${item.name}`;
      const price = `N${(item.price * item.quantity).toLocaleString()}`;
      lines.push(
        pad(name.length > W - 10 ? name.substring(0, W - 10) : name, price),
      );
    });
    lines.push(SEP);
    lines.push(pad("TOTAL", `N${order.total.toLocaleString()}`));
    if (confirmedBalance !== null) {
      lines.push(pad("Balance After", `N${confirmedBalance.toLocaleString()}`));
    }
    lines.push(SEP);
    lines.push(center("Thank you!"));

    const printFrame = document.createElement("iframe");
    printFrame.style.cssText = "position:absolute;width:0;height:0;border:none";
    document.body.appendChild(printFrame);
    const doc =
      printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!doc) return;
    doc.write(
      `<html><head><style>@page{size:80mm auto;margin:0}*{margin:0;padding:0}body{margin:0;padding:0;width:80mm;background:white}</style></head><body><pre style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;margin:0;padding:2mm;white-space:pre">${lines.join("\n")}</pre></body></html>`,
    );
    doc.close();
    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(printFrame), 100);
    }, 300);
  };

  // Menu filtering
  const excludedCategories = ["Special Orders"];
  const allItems: KioskMenuItem[] =
    menuItems
      ?.filter(
        (i) =>
          i.available !== false && !excludedCategories.includes(i.category),
      )
      .map((i) => ({
        _id: i._id,
        name: i.name,
        price: i.price,
        category: i.category,
        available: i.available,
      })) || [];
  const drinkCategoryNames = ["Drinks"];
  const foodCats = (categories || []).filter(
    (c: string) =>
      c !== "All" &&
      !excludedCategories.includes(c) &&
      !drinkCategoryNames.includes(c),
  );
  const drinkCats = (categories || []).filter(
    (c: string) => c !== "All" && drinkCategoryNames.includes(c),
  );
  const activeCategories = selectedMenuType === "food" ? foodCats : drinkCats;
  const typeFilteredItems = allItems.filter((i) =>
    activeCategories.includes(i.category),
  );
  const filteredItems =
    selectedCategory === "All"
      ? typeFilteredItems
      : typeFilteredItems.filter((i) => i.category === selectedCategory);
  const isLoading = isDesktop
    ? !hasCachedMenu &&
      (remoteMenuItems === undefined || remoteCategories === undefined)
    : menuItems === undefined || categories === undefined;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExitDialogOpen}
            className="mr-1"
            title="Exit Kiosk"
          >
            <Lock className="w-5 h-5" />
          </Button>
          {customer && step === "menu" ? (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground font-display">
                Today's Menu
              </h1>
              <CustomerNavBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
          ) : (
            <h1 className="text-xl font-bold text-foreground font-display">
              New Era Cafeteria
            </h1>
          )}
        </div>
        {customer && (
          <div className="flex items-center gap-5">
            <Button variant="outline" size="sm" onClick={resetKiosk}>
              Exit
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 p-4 sm:p-6">
        {/* SCAN STEP */}
        {step === "scan" && (
          <div className="flex flex-col items-center justify-center min-h-[55vh] gap-8">
            <div className="text-center space-y-2">
              <img
                src={logo}
                alt="Logo"
                className="w-60 h-60 mx-auto"
                style={{ animation: "pulsate 2s ease-in-out infinite" }}
              />
              <h2 className="text-3xl font-bold text-foreground font-display">
                Welcome!
              </h2>
              <p className="text-muted-foreground max-w-md">
                Scan your unique QR code or enter your ID manually to start
                ordering.
              </p>
            </div>
            <Input
              ref={inputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
              onKeyDown={handleBarcodeScan}
              placeholder="Scan or enter your QR code (e.g. CUST-20260216-ABC123)"
              className="max-w-md text-center text-lg font-mono"
              autoFocus
            />
            {barcodeInput.trim().length > 0 &&
              (customerLookup && customerLookup.isActive ? (
                <Button
                  size="lg"
                  className="mt-2"
                  onClick={handleContinueAfterScan}
                >
                  Continue as {customerLookup.firstName}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="mt-2"
                  disabled={customerLookup === undefined || !customerLookup}
                >
                  {customerLookup === undefined ? "Looking up..." : "Continue"}
                </Button>
              ))}
          </div>
        )}

        {/* MENU STEP - with tab switching */}
        {step === "menu" && activeTab === "menu" && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={selectedMenuType === "food" ? "default" : "outline"}
                  onClick={() => {
                    setSelectedMenuType("food");
                    setSelectedCategory("All");
                  }}
                  className={cn(
                    "flex-1 sm:flex-none",
                    selectedMenuType === "food"
                      ? ""
                      : "bg-white text-gray-800 border-border hover:bg-primary hover:text-white",
                  )}
                >
                  Food Menu
                </Button>
                <Button
                  variant={
                    selectedMenuType === "drinks" ? "default" : "outline"
                  }
                  onClick={() => {
                    setSelectedMenuType("drinks");
                    setSelectedCategory("All");
                  }}
                  className={cn(
                    "flex-1 sm:flex-none",
                    selectedMenuType === "drinks"
                      ? ""
                      : "bg-white text-gray-800 border-border hover:bg-primary hover:text-white",
                  )}
                >
                  Drinks Menu
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {["All", ...activeCategories].map((cat) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer px-3 py-1 text-sm",
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-white text-gray-800 border-border hover:bg-primary hover:text-white",
                    )}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
              {isLoading ? (
                <div className="text-center text-muted-foreground py-12">
                  Loading menu...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredItems.map((item) => (
                    <Card
                      key={item._id}
                      className="cursor-pointer hover:ring-2 ring-primary transition-all bg-card"
                      onClick={() => {
                        if (
                          customer &&
                          cartTotal + item.price <= customer.balance
                        ) {
                          addToCart(item);
                        } else {
                          toast({
                            title: "Insufficient balance",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <CardContent className="p-3 text-center">
                        <p className="font-medium text-sm text-foreground">
                          {item.name}
                        </p>
                        <p className="text-primary font-bold">
                          ₦{item.price.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground py-8">
                      No items available
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Cart Sidebar */}
            <div className="w-full lg:w-80 bg-white border border-border rounded-lg p-4">
              {/* Balance card above cart */}
              {customer && (
                <div className="mb-3">
                  <BalanceCard customer={customer} />
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Cart
                </h3>
                <Badge
                  variant={remainingBalance >= 0 ? "default" : "destructive"}
                >
                  Balance: ₦{remainingBalance.toLocaleString()}
                </Badge>
              </div>
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Add items from the menu
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          ₦{item.price} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQty(item._id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm w-6 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQty(item._id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setCart((p) => p.filter((c) => c._id !== item._id))
                          }
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between font-bold text-gray-800">
                  <span>Total:</span>
                  <span>₦{cartTotal.toLocaleString()}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => setStep("checkout")}
                  disabled={
                    !customer ||
                    cart.length === 0 ||
                    cartTotal > customer.balance
                  }
                >
                  Proceed to Checkout
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* WALLET TAB */}
        {step === "menu" && activeTab === "wallet" && customer && (
          <CustomerWallet customer={customer} />
        )}

        {/* HISTORY TAB */}
        {step === "menu" && activeTab === "history" && customer && (
          <CustomerHistory customer={customer} />
        )}

        {/* CHECKOUT STEP */}
        {step === "checkout" && customer && (
          <div className="max-w-md mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-foreground text-center font-display">
              Confirm Order
            </h2>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm text-muted-foreground">
                  Customer:{" "}
                  <strong className="text-foreground">
                    {customer.firstName} {customer.lastName}
                  </strong>
                </div>
                <div className="border-t border-border pt-2 space-y-1">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="flex justify-between text-sm"
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        ₦{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Payment Method:
                    </span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> Customer Balance
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Current Balance:
                    </span>
                    <span>₦{customer.balance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Total:</span>
                    <span className="font-bold text-destructive">
                      -₦{cartTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Remaining:</span>
                    <span className="text-primary">
                      ₦{remainingBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("menu")}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                    Processing...
                  </>
                ) : (
                  "Confirm Order"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* SUCCESS STEP */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center min-h-[55vh] gap-6 text-center max-w-md mx-auto">
            <CheckCircle className="w-24 h-24 text-primary" />
            <h2 className="text-3xl font-bold text-foreground font-display">
              Order Complete!
            </h2>
            <p className="text-muted-foreground">
              Your order has been placed successfully.
            </p>

            {/* Payment & Status Summary */}
            <Card className="w-full">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Method</span>
                  <Badge variant="outline" className="gap-1">
                    <CreditCard className="w-3 h-3" /> Customer Balance
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Status</span>
                  <Badge className="bg-success text-success-foreground gap-1">
                    <CheckCircle className="w-3 h-3" /> Paid
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold">
                    ₦{cartTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Remaining Balance
                  </span>
                  <span className="font-bold text-primary">
                    ₦{(confirmedBalance ?? remainingBalance).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Items summary */}
            <Card className="w-full">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-2 text-foreground">
                  Items Ordered
                </h4>
                <div className="space-y-1">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="flex justify-between text-sm"
                    >
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <span>
                        ₦{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={handlePrint}
                disabled={printing}
                className="flex-1"
              >
                {printing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                {printing ? "Printing..." : "Print Receipt"}
              </Button>
              <Button onClick={resetKiosk} className="flex-1">
                New Order
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Returning to scan screen in 15 seconds...
            </p>
          </div>
        )}
      </main>

      {/* Nav is now in header */}

      {/* Exit PIN Dialog */}
      <Dialog
        open={exitDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setExitDialogOpen(false);
            setExitPin("");
            setPinValidationError("");
          }
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" /> Exit Kiosk Mode
            </DialogTitle>
            <DialogDescription>
              Enter your access code to return to the main screen.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <InputOTP
              maxLength={4}
              value={exitPin}
              onChange={(value) => {
                setExitPin(value.toUpperCase());
                setPinValidationError("");
              }}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-12 h-12 text-lg" />
                <InputOTPSlot index={1} className="w-12 h-12 text-lg" />
                <InputOTPSlot index={2} className="w-12 h-12 text-lg" />
                <InputOTPSlot index={3} className="w-12 h-12 text-lg" />
              </InputOTPGroup>
            </InputOTP>
            {pinValidationError && (
              <p className="text-sm text-destructive font-medium">
                {pinValidationError}
              </p>
            )}
            {exitPin.length === 4 && pinValidating && !pinValidationError && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Validating...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExitDialogOpen(false);
                setExitPin("");
                setPinValidationError("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CustomerKiosk;

/* CartContext - provides cart state and order management */
import React, {
  useContext,
  useState,
  useRef,
  ReactNode,
  useEffect,
  useCallback,
} from "react";

import { useMutation } from "@/lib/convexApi";
import { api } from "@/lib/convexApi";
import { convex } from "@/lib/convex";
import {
  CartItem,
  MenuItem,
  Order,
  CustomCartItem,
  ConvexOrderItem,
  ReportOrder,
} from "@/types/cafeteria";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "./AuthContext";
import { orderQueue } from "@/lib/orderQueue";
import { getSqliteDB } from "@/lib/sqlite";
import { getConnectionMonitor } from "@/lib/connectionMonitor";

// CartContext definition
interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem | CustomCartItem, initialQuantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  orders: Order[];
  completeOrder: (
    paymentMethod: "cash" | "card" | "transfer" | "customer_balance",
  ) => Order | null;
  downloadDailySalesPDF: (
    shift?: "morning" | "afternoon" | "evening" | "all",
  ) => void;
  syncPendingOrders: () => Promise<{
    synced: number;
    failed: number;
    total: number;
  }>;
  pendingOrdersCount: number;
  isConnected: boolean;
  isProcessingOrder: boolean;
}

// CustomCartItem type moved to types/cafeteria.ts

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const isTauri = "__TAURI__" in window;
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const syncInProgressRef = useRef(false);
  const recentlySubmittedRef = useRef<Set<string>>(new Set());
  const lastOrderTimeRef = useRef(0);
  const syncPendingOrdersRef = useRef<
    () => Promise<{ synced: number; failed: number; total: number }>
  >(async () => ({ synced: 0, failed: 0, total: 0 }));
  const [queueInitialized, setQueueInitialized] = useState(!isTauri); // initialized by default for web

  // Initialize orderQueue on mount (for Tauri only)
  useEffect(() => {
    if (!isTauri) return;
    const initOrderQueue = async () => {
      try {
        console.log("[CartContext] Initializing orderQueue...");
        await orderQueue.init();
        console.log("[CartContext] OrderQueue initialized successfully");
        setQueueInitialized(true);
      } catch (error) {
        console.error("[CartContext] Failed to initialize orderQueue:", error);
      }
    };
    initOrderQueue();
  }, [isTauri]);

  const { code: cashierCode, userName: cashierName } = useAuth();
  const createOrder = useMutation(api.orders.createOrder);

  const [items, setItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Update pending order count from orderQueue
  const updatePendingCount = useCallback(async () => {
    if (!queueInitialized) {
      console.log(
        "[CartContext] Skipping pending count - queue not initialized",
      );
      return;
    }

    try {
      const pending = await orderQueue.getPendingOrders();
      console.log(`[CartContext] Pending orders count: ${pending.length}`);
      setPendingOrdersCount(pending.length);
    } catch (error) {
      console.error("[CartContext] Failed to get pending count:", error);
    }
  }, [queueInitialized]);

  // Sync pending orders from orderQueue to backend
  const syncPendingOrders = useCallback(async () => {
    if (!queueInitialized) {
      console.warn("[CartContext] Cannot sync - queue not initialized");
      return { synced: 0, failed: 0, total: 0 };
    }

    // Cooldown: skip sync if an order was placed within the last 15 seconds
    if (Date.now() - lastOrderTimeRef.current < 15000) {
      console.log(
        "[CartContext] Sync skipped - cooldown after recent order placement",
      );
      return { synced: 0, failed: 0, total: 0 };
    }

    // Prevent concurrent sync runs (race condition guard)
    if (syncInProgressRef.current) {
      console.log("[CartContext] Sync already in progress, skipping...");
      return { synced: 0, failed: 0, total: 0 };
    }
    syncInProgressRef.current = true;

    try {
      const pending = await orderQueue.getPendingOrders();
      console.log(`[CartContext] Syncing ${pending.length} pending orders...`);

      let synced = 0;
      let failed = 0;

      for (const qo of pending) {
        // Skip orders that were just submitted directly (race condition prevention)
        if (recentlySubmittedRef.current.has(qo.id)) {
          console.log(
            `[CartContext] Skipping recently submitted order: ${qo.id}`,
          );
          continue;
        }

        // Re-check order status before syncing (it may have been marked synced already)
        try {
          const freshPending = await orderQueue.getPendingOrders();
          const stillPending = freshPending.find((p) => p.id === qo.id);
          if (!stillPending) {
            console.log(
              `[CartContext] Order ${qo.id} no longer pending, skipping`,
            );
            continue;
          }
        } catch (e) {
          console.warn("[CartContext] Failed to re-check order status:", e);
        }

        try {
          await orderQueue.updateStatus(qo.id, "syncing");
          const isCustom = (item: CartItem & { isCustom?: boolean }) =>
            item.isCustom ||
            (typeof item.id === "string" && item.id?.startsWith("custom-"));

          // Extract clientOrderId — prefer the dedicated SQLite column, fall back to order_data JSON
          const clientOrderId =
            qo.clientOrderId ||
            (qo.order as Order & { clientOrderId?: string }).clientOrderId ||
            undefined;

          await createOrder({
            items: qo.order.items.map(
              (item: CartItem & { isCustom?: boolean }) => ({
                ...(isCustom(item)
                  ? {}
                  : { menuItemId: item.id as Id<"menuItems"> }),
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                category: item.category,
                isCustom: isCustom(item) || undefined,
              }),
            ),
            total: qo.order.total,
            paymentMethod: qo.order.paymentMethod,
            status: "completed",
            orderType: "regular",
            cashierCode:
              (qo.order as Order & { cashierCode?: string }).cashierCode ||
              cashierCode ||
              "",
            cashierName: cashierName || undefined,
            clientOrderId,
            createdAt: qo.createdAt,
          });

          await orderQueue.updateStatus(qo.id, "synced");
          synced++;
          console.log(`✅ Synced order ${qo.id}`);
        } catch (error) {
          console.error(`❌ Failed to sync order ${qo.id}:`, error);
          await orderQueue.updateStatus(
            qo.id,
            "failed",
            error instanceof Error ? error.message : "Unknown error",
          );
          failed++;
        }
      }

      await updatePendingCount();
      console.log(
        `[CartContext] Sync complete: ${synced} synced, ${failed} failed out of ${pending.length}`,
      );
      return { synced, failed, total: pending.length };
    } finally {
      syncInProgressRef.current = false;
    }
  }, [
    createOrder,
    cashierCode,
    cashierName,
    updatePendingCount,
    queueInitialized,
  ]);

  // Keep ref in sync for stable auto-sync effect
  useEffect(() => {
    syncPendingOrdersRef.current = syncPendingOrders;
  }, [syncPendingOrders]);

  // Monitor connection status
  useEffect(() => {
    const monitor = getConnectionMonitor();
    if (!monitor) return;
    const unsubscribe = monitor.subscribe((connected) => {
      console.log(`[CartContext] Connection status changed: ${connected}`);
      setIsConnected(connected);
    });
    return unsubscribe;
  }, []);

  // Auto-sync when connection is restored (using ref to avoid re-triggering)
  useEffect(() => {
    if (isConnected && queueInitialized) {
      console.log("[CartContext] Connection restored, auto-syncing...");
      syncPendingOrdersRef.current();
    }
  }, [isConnected, queueInitialized]);

  // Update pending count when queue is initialized
  useEffect(() => {
    if (queueInitialized) {
      updatePendingCount();
    }
  }, [queueInitialized, updatePendingCount]);

  // Helper to get today's orders — single source of truth per environment
  const getTodaysOrders = async (): Promise<ReportOrder[]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Tauri (desktop): use local SQLite only, filtered to current cashier
    if (isTauri && queueInitialized) {
      try {
        const sqlite = getSqliteDB();
        const [cachedOrders, queuedOrders] = await Promise.all([
          sqlite
            ? sqlite.getCachedOrdersByRange(
                todayTimestamp,
                todayTimestamp + 24 * 60 * 60 * 1000,
              )
            : Promise.resolve([]),
          orderQueue.getAllOrders(),
        ]);

        const localOrders = queuedOrders
          .filter(
            (qo) =>
              qo.createdAt >= todayTimestamp &&
              (qo.order as Order & { orderType?: string; cashierCode?: string })
                .orderType !== "special" &&
              (qo.order as Order & { orderType?: string; cashierCode?: string })
                .cashierCode === cashierCode,
          )
          .map(
            (qo): ReportOrder => ({
              id: qo.id,
              items: (qo.order.items || []).map(
                (item: CartItem & { isCustom?: boolean }) => ({
                  id: item.id || `custom-${item.name}`,
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                  category: item.category || "Food",
                  isCustom: item.isCustom || false,
                }),
              ),
              total: qo.order.total,
              timestamp: new Date(qo.createdAt),
              paymentMethod: qo.order.paymentMethod,
              status: qo.order.status || "completed",
              cashierCode:
                (qo.order as Order & { cashierCode?: string }).cashierCode ||
                cashierCode ||
                "LOCAL",
            }),
          );

        const cachedReportOrders: ReportOrder[] = (cachedOrders || [])
          .filter(
            (order) =>
              order.createdAt >= todayTimestamp &&
              (order.orderType || "regular") !== "special" &&
              order.cashierCode === cashierCode,
          )
          .map((order) => ({
            id: order._id,
            items: (order.items || []).map((item) => ({
              id: item.menuItemId || `custom-${item.name}`,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              category: item.category || "Food",
              isCustom: item.isCustom || !item.menuItemId,
            })),
            total: order.total,
            timestamp: new Date(order.createdAt),
            paymentMethod: order.paymentMethod,
            status: order.status,
            cashierCode: order.cashierCode,
          }));

        const filtered = [...cachedReportOrders, ...localOrders].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        );

        console.log(
          `[CartContext] Tauri getTodaysOrders: ${filtered.length} orders from SQLite cache + queue (cashier: ${cashierCode})`,
        );
        return filtered;
      } catch (error) {
        console.error(
          "[CartContext] Failed to read SQLite orders for report:",
          error,
        );
        return [];
      }
    }

    // Web (browser): use Convex DB only, filtered to current cashier
    const allOrdersFromDB = await convex.query(api.orders.getAllOrders, {
      limit: 200,
      daysBack: 7,
    });

    const dbOrders: ReportOrder[] = allOrdersFromDB
      .filter(
        (order) =>
          order.createdAt >= todayTimestamp &&
          order.orderType !== "special" &&
          order.cashierCode === cashierCode,
      )
      .map((order) => ({
        id: order._id,
        items: order.items.map((item) => ({
          id: item.menuItemId || `custom-${item.name}`,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category || "Food",
          isCustom: item.isCustom || !item.menuItemId,
        })),
        total: order.total,
        timestamp: new Date(order.createdAt),
        paymentMethod: order.paymentMethod,
        status: order.status,
        cashierCode: order.cashierCode,
      }));

    console.log(
      `[CartContext] Web getTodaysOrders: ${dbOrders.length} orders from Convex`,
    );
    return dbOrders;
  };

  // Print daily sales report (receipt style)
  const downloadDailySalesPDF = async (
    shiftFilter: "morning" | "afternoon" | "evening" | "all" = "all",
  ) => {
    let todaysOrders = await getTodaysOrders();
    console.log(
      `Total orders (DB + localStorage + SQLite) today: ${todaysOrders.length}`,
    );

    // Build a map of access code -> shift assignment
    const accessCodesFromDB = await convex.query(
      api.accessCodes.listAccessCodes,
      {},
    );

    const codeToShift: Record<
      string,
      "morning" | "afternoon" | "evening" | undefined
    > = {};
    accessCodesFromDB.forEach((ac) => {
      codeToShift[ac.code] = ac.shift;
    });

    // Filter orders by access code shift assignment (not time-based)
    if (shiftFilter !== "all") {
      todaysOrders = todaysOrders.filter((order) => {
        const shift = codeToShift[order.cashierCode];
        return shift === shiftFilter;
      });
    }

    console.log(`Orders after ${shiftFilter} filter: ${todaysOrders.length}`);

    // Get the access code(s) used for orders in this shift
    const accessCodesUsed = [
      ...new Set(todaysOrders.map((order) => order.cashierCode)),
    ];
    const displayCode =
      accessCodesUsed.length > 0 ? accessCodesUsed.join(", ") : "N/A";

    let grandTotal = 0;
    let customFoodTotal = 0;
    let customDrinksTotal = 0;
    let menuFoodTotal = 0;
    let menuDrinksTotal = 0;

    // Calculate totals - use order.total for grand total, calculate categories from items
    todaysOrders.forEach((order) => {
      grandTotal += order.total;
      order.items.forEach((item) => {
        const itemTotal = item.price * item.quantity;
        const category = item.category?.toLowerCase();
        const isCustom = item.isCustom;
        if (category === "drink" || category === "drinks") {
          if (isCustom) {
            customDrinksTotal += itemTotal;
          } else {
            menuDrinksTotal += itemTotal;
          }
        } else {
          if (isCustom) {
            customFoodTotal += itemTotal;
          } else {
            menuFoodTotal += itemTotal;
          }
        }
      });
    });

    // Set shift label based on filter
    let shift = "Full Day";
    if (shiftFilter === "morning") {
      shift = "Morning Shift";
    } else if (shiftFilter === "afternoon") {
      shift = "Afternoon Shift";
    } else if (shiftFilter === "evening") {
      shift = "Evening Shift";
    }

    // Build plain text report (works reliably in WebView2)
    const W = 42;
    const SEP = "-".repeat(W);
    const pad = (l: string, r: string) =>
      l + " ".repeat(Math.max(1, W - l.length - r.length)) + r;

    const center = (s: string) => {
      const spaces = Math.max(0, Math.floor((W - s.length) / 2));
      return " ".repeat(spaces) + s;
    };

    const lines: string[] = [];
    lines.push(center("New Era Cafeteria"));
    lines.push(center("Redeemer's University, Ede,"));
    lines.push(center("Osun State, Nigeria"));
    lines.push(SEP);
    lines.push(center(shift));
    lines.push(SEP);
    lines.push(pad("Cashier:", displayCode));
    lines.push(pad("Date:", new Date().toLocaleDateString()));
    lines.push(pad("Time:", new Date().toLocaleTimeString()));
    lines.push(SEP);
    lines.push(center("SALES SUMMARY"));
    lines.push(SEP);
    lines.push(
      pad("Menu Food:", `N${Math.round(menuFoodTotal).toLocaleString()}`),
    );
    lines.push(
      pad("Menu Drinks:", `N${Math.round(menuDrinksTotal).toLocaleString()}`),
    );
    lines.push(SEP);
    lines.push(
      pad("Custom Food:", `N${Math.round(customFoodTotal).toLocaleString()}`),
    );
    lines.push(
      pad(
        "Custom Drinks:",
        `N${Math.round(customDrinksTotal).toLocaleString()}`,
      ),
    );
    lines.push(SEP);
    lines.push(pad("GRAND TOTAL:", `N${grandTotal.toLocaleString()}`));
    lines.push(SEP);
    lines.push("");
    lines.push(center("Redeemer's University, Ede"));
    lines.push(center("Thank you for your business!"));

    const reportText = lines.join("\n");

    // Create a hidden iframe for printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const printDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!printDoc) return;

    printDoc.write(`<html><head><title>Daily Sales Report</title><style>
      @page { size: 80mm auto; margin: 5mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { margin:0; padding:0; background:white; display:flex; justify-content:center; }
      pre {
        font-family:'Courier New',Courier,monospace;
        font-size:12px;
        margin:0 auto;
        padding:3mm;
        white-space:pre;
        width:80mm;
        max-width:80mm;
        line-height:1.4;
      }
    </style></head><body><pre>${reportText}</pre></body></html>`);
    printDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  const addItem = (
    item: MenuItem | CustomCartItem,
    initialQuantity: number = 1,
  ) => {
    const isCustomItem = "isCustom" in item;
    setItems((current) => {
      const existing = current.find((i) => i.id === item.id);
      if (existing) {
        return current.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + initialQuantity }
            : i,
        );
      }
      // If it's a custom item, mark isCustom
      if (isCustomItem) {
        return [
          ...current,
          { ...item, quantity: initialQuantity, isCustom: true },
        ];
      }
      return [...current, { ...item, quantity: initialQuantity }];
    });
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((current) =>
      current.map((i) => (i.id === id ? { ...i, quantity } : i)),
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Synchronous ref lock to block double-clicks within the same render frame
  const isSubmittingRef = useRef(false);

  const completeOrder = (
    paymentMethod: "cash" | "card" | "transfer" | "customer_balance",
  ): Order | null => {
    // Synchronous ref check — blocks even within the same React render frame
    if (isSubmittingRef.current) {
      console.warn("⚠️ [Dedup] Ref lock active, ignoring duplicate click");
      return null;
    }
    // Also check state for UI feedback
    if (isProcessingOrder) {
      console.warn("⚠️ [Dedup] State lock active, ignoring duplicate click");
      return null;
    }

    // Acquire locks immediately (ref is synchronous, state is async)
    isSubmittingRef.current = true;
    setIsProcessingOrder(true);

    const now = Date.now();
    lastOrderTimeRef.current = now; // Set cooldown for auto-sync
    // Single idempotency key for this checkout intent — reused for retries
    const clientOrderId = `order_${now}_${Math.random().toString(36).substr(2, 9)}`;
    // Determine if this is a special order
    const hasSpecialItems = items.some(
      (item) =>
        item.category === "Special Orders" ||
        (item as CustomCartItem & { isSpecialOrder?: boolean }).isSpecialOrder,
    );
    const orderType = hasSpecialItems ? "special" : "regular";

    // Helper to map cart items to Convex order items
    const mapToConvexItems = (cartItems: CartItem[]): ConvexOrderItem[] =>
      cartItems.map((item) => {
        const isCustom =
          (item as CustomCartItem).isCustom ||
          (typeof item.id === "string" && item.id?.startsWith("custom-"));
        return {
          ...(isCustom ? {} : { menuItemId: item.id as Id<"menuItems"> }),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category,
          isCustom: isCustom || undefined,
        };
      });

    const order: Order = {
      id: (() => {
        const d = new Date(now);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let suffix = "";
        for (let i = 0; i < 4; i++)
          suffix += chars[Math.floor(Math.random() * chars.length)];
        return `NE-${dd}${mm}${yy}-${suffix}`;
      })(),
      items: [...items],
      total,
      timestamp: new Date(),
      paymentMethod,
      status: "completed",
    };

    // Desktop app: Always queue in orderQueue first, then try backend sync
    if (isTauri && queueInitialized) {
      (async () => {
        try {
          const orderWithCashierCode = {
            ...order,
            cashierCode: cashierCode || "QUEUE",
            clientOrderId,
            createdAt: now,
          };
          console.log("[CartContext] Saving order to SQLite queue:", order.id);
          const queueId = await orderQueue.addOrder(orderWithCashierCode);
          console.log(
            "[CartContext] Order saved to SQLite successfully, queueId:",
            queueId,
          );

          // Track this queue entry to prevent auto-sync race condition
          recentlySubmittedRef.current.add(queueId);
          setTimeout(() => {
            recentlySubmittedRef.current.delete(queueId);
          }, 10000);

          await updatePendingCount();

          // Try to save to backend immediately (best effort)
          createOrder({
            items: mapToConvexItems(items),
            total,
            paymentMethod,
            status: "completed",
            orderType,
            cashierCode: cashierCode || "",
            cashierName: cashierName || undefined,
            clientOrderId,
            createdAt: now,
          })
            .then(async (result) => {
              console.log(
                "[CartContext] Order saved to backend successfully:",
                result,
              );
              isSubmittingRef.current = false;
              setIsProcessingOrder(false);
              // Mark as synced so auto-sync won't re-send this order
              try {
                await orderQueue.updateStatus(queueId, "synced");
                await updatePendingCount();
                console.log(
                  "[CartContext] Queue entry marked as synced:",
                  queueId,
                );
              } catch (e) {
                console.error(
                  "[CartContext] Failed to mark queue entry as synced:",
                  e,
                );
              }
            })
            .catch((error) => {
              console.error(
                "[CartContext] FAILED to save order to backend (will retry from queue):",
                error,
              );
              isSubmittingRef.current = false;
              setIsProcessingOrder(false);
              // Order remains in queue for later sync
            });
        } catch (queueError) {
          isSubmittingRef.current = false;
          setIsProcessingOrder(false);
          console.error("[CartContext] Failed to queue order:", queueError);
          alert(
            `Critical: Order ${order.id} could not be saved locally. Please contact support.`,
          );
        }
      })();
    } else if (!isTauri) {
      // Web app: Save to localStorage first as backup, then try backend
      // clientOrderId is stored so any retry reuses the same idempotency key
      const orderWithCode = {
        ...order,
        cashierCode: cashierCode || "",
        clientOrderId,
      };
      const currentPending = JSON.parse(
        localStorage.getItem("pendingOrders") || "[]",
      );
      const updatedPending = [orderWithCode, ...currentPending];
      localStorage.setItem("pendingOrders", JSON.stringify(updatedPending));

      createOrder({
        items: mapToConvexItems(items),
        total,
        paymentMethod,
        status: "completed",
        orderType,
        cashierCode: cashierCode || "",
        cashierName: cashierName || undefined,
        clientOrderId,
        createdAt: now,
      })
        .then((result) => {
          console.log("Order saved successfully:", result);
          isSubmittingRef.current = false;
          setIsProcessingOrder(false);

          // Remove this order from pending since it was saved successfully
          const pendingOrders = JSON.parse(
            localStorage.getItem("pendingOrders") || "[]",
          );
          const remainingOrders = pendingOrders.filter(
            (o: Order) => o.id !== order.id,
          );
          if (remainingOrders.length > 0) {
            localStorage.setItem(
              "pendingOrders",
              JSON.stringify(remainingOrders),
            );
          } else {
            localStorage.removeItem("pendingOrders");
          }
        })
        .catch((error) => {
          console.error("FAILED to save order:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          isSubmittingRef.current = false;
          setIsProcessingOrder(false);
          // Order stays in localStorage for retry
          console.log(`Order ${order.id} kept in localStorage for later sync`);
        });
    } else {
      // Tauri but queue not initialized yet
      console.error("[CartContext] Cannot save order - queue not initialized");
      isSubmittingRef.current = false;
      setIsProcessingOrder(false);
      alert("Order system not ready. Please wait and try again.");
      return null;
    }

    setOrders((current) => [order, ...current]);
    clearCart();
    return order;
  };

  // Only render children when queue is initialized (for Tauri)
  if (isTauri && !queueInitialized) {
    // Don't render anything; App.tsx will handle splash/loader
    return null;
  }

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        itemCount,
        orders,
        completeOrder,
        downloadDailySalesPDF,
        syncPendingOrders,
        pendingOrdersCount,
        isConnected,
        isProcessingOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// Hook exported separately to fix Fast Refresh compatibility
// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

// Export for compatibility
export type { CartContextType };

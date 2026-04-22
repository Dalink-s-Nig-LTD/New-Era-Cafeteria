// Bootstrap historical orders from Convex to SQLite on first app load.
// This reduces repeat Convex reads on desktop by warming the local store.

import { ConvexReactClient } from "convex/react";
import { api } from "@/lib/convexApi";
import { sqliteDB } from "@/lib/sqlite";
import { CartItem, Order } from "@/types/cafeteria";

const HIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const HIST_CACHE_TS_KEY = "historicalOrdersCacheLastSyncAt";

interface ConvexOrder {
  _id: string;
  items: Array<{
    menuItemId?: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
    isCustom?: boolean;
  }>;
  total: number;
  paymentMethod: string;
  status: string;
  cashierCode: string;
  cashierName?: string;
  clientOrderId?: string;
  createdAt: number;
  orderType?: string;
}

export async function bootstrapHistoricalOrders(
  convexClient: ConvexReactClient,
): Promise<number> {
  if (!sqliteDB) return 0;

  try {
    console.log("[Bootstrap] Starting historical orders bootstrap...");

    const existingOrders = await sqliteDB.getCachedOrders();
    const lastSyncRaw = localStorage.getItem(HIST_CACHE_TS_KEY);
    const lastSyncAt = lastSyncRaw ? Number(lastSyncRaw) : 0;
    const isFresh =
      Number.isFinite(lastSyncAt) &&
      Date.now() - lastSyncAt < HIST_CACHE_TTL_MS;

    // If cache is fresh and not empty, skip bootstrap
    if (existingOrders.length > 0 && isFresh) {
      console.log(
        `[Bootstrap] Historical cache still fresh (${existingOrders.length} orders), skipping bootstrap`,
      );
      return existingOrders.length;
    }

    // If cache is empty (new PC / fresh install), always fetch from Convex
    const skipBootstrap = existingOrders.length > 0 && isFresh;
    if (skipBootstrap) {
      console.log("[Bootstrap] Stale cache detected, refreshing from Convex...");
    } else if (existingOrders.length === 0) {
      console.log("[Bootstrap] Empty cache detected, fetching from Convex (new PC or fresh install)...");
    }

    const historicalOrders = (await convexClient.query(api.orders.getAllOrders, {
      limit: 20000,
      daysBack: 36500,
    })) as ConvexOrder[];

    if (!historicalOrders || historicalOrders.length === 0) {
      console.log("[Bootstrap] No historical orders found in Convex");
      return 0;
    }

    let insertedCount = 0;
    let skippedCount = 0;
    const ordersToCache: Array<{
      _id: string;
      items: Array<{
        menuItemId?: string;
        name: string;
        price: number;
        quantity: number;
        category?: string;
        isCustom?: boolean;
      }>;
      total: number;
      paymentMethod: string;
      status: string;
      orderType?: string;
      cashierCode: string;
      cashierName?: string;
      clientOrderId?: string;
      createdAt: number;
    }> = [];

    for (const convexOrder of historicalOrders) {
      try {
        const cartItems: CartItem[] = (convexOrder.items || []).map((item) => ({
          id: item.menuItemId || `custom-${convexOrder._id}-${item.name}`,
          name: item.name,
          price: item.price,
          category: item.category || "Custom",
          available: true,
          quantity: item.quantity,
        }));

        const normalizedOrder: Order = {
          id: convexOrder._id,
          items: cartItems,
          total: convexOrder.total || 0,
          timestamp: new Date(convexOrder.createdAt || Date.now()),
          paymentMethod: (convexOrder.paymentMethod ||
            "cash") as Order["paymentMethod"],
          status: (convexOrder.status || "completed") as Order["status"],
          cashierCode: convexOrder.cashierCode,
        };

        ordersToCache.push({
          _id: normalizedOrder.id,
          items: convexOrder.items || [],
          total: normalizedOrder.total,
          paymentMethod: normalizedOrder.paymentMethod,
          status: normalizedOrder.status,
          orderType: convexOrder.orderType,
          cashierCode: normalizedOrder.cashierCode || "",
          cashierName: convexOrder.cashierName,
          clientOrderId: convexOrder.clientOrderId,
          createdAt: convexOrder.createdAt,
        });
        insertedCount++;
      } catch {
        skippedCount++;
      }
    }

    if (ordersToCache.length > 0) {
      await sqliteDB.cacheOrders(ordersToCache);
      localStorage.setItem(HIST_CACHE_TS_KEY, String(Date.now()));
    }

    console.log(
      `[Bootstrap] Complete: ${insertedCount} inserted, ${skippedCount} skipped`,
    );
    return insertedCount;
  } catch (error) {
    console.error("[Bootstrap] Failed to bootstrap historical orders:", error);
    return 0;
  }
}

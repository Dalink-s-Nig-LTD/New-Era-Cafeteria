// Bootstrap all orders from Convex and cache to SQLite
// Fetches all historical orders in batches to work around Convex size limits

import { ConvexReactClient } from "convex/react";
import { api } from "@/lib/convexApi";
import { getSqliteDB } from "@/lib/sqlite";

const ALL_ORDERS_CACHE_TS_KEY = "allOrdersCacheTimestamp";
const ALL_ORDERS_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export async function bootstrapAllOrders(
  convex: ConvexReactClient,
): Promise<void> {
  const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;
  if (!isDesktop) {
    console.log("[Bootstrap] Web environment, skipping SQLite order cache");
    return;
  }

  const sqliteDB = getSqliteDB();
  if (!sqliteDB) {
    console.log("[Bootstrap] SQLite not available");
    return;
  }

  try {
    console.log("[Bootstrap] Starting all orders bootstrap...");

    // Check if cache is still fresh (24-hour TTL)
    const lastSyncRaw = localStorage.getItem(ALL_ORDERS_CACHE_TS_KEY);
    if (lastSyncRaw) {
      const lastSync = parseInt(lastSyncRaw, 10);
      const now = Date.now();
      const age = now - lastSync;

      if (age < ALL_ORDERS_SYNC_INTERVAL) {
        const hours = Math.round(age / (60 * 60 * 1000));
        console.log(
          `[Bootstrap] All orders cache still fresh (${hours}h old), skipping refresh`,
        );
        return;
      }

      console.log("[Bootstrap] All orders cache expired, refreshing from Convex...");
    }

    const cacheIsEmpty = (await sqliteDB.getCachedOrdersCount()) === 0;
    if (cacheIsEmpty) {
      console.log(
        "[Bootstrap] Empty orders cache detected, fetching from Convex (new PC or fresh install)...",
      );
    }

    // Fetch ALL orders using cursor pagination - no limit on total count
    let allOrders: Array<{ _id: string; createdAt?: number; [key: string]: unknown }> = [];
    let lastId: string | undefined = undefined;
    let batchNum = 0;

    try {
      console.log(`[Bootstrap] Fetching ALL orders from Convex (cursor pagination)...`);

      // Keep fetching until we get all orders
      while (true) {
        batchNum++;
        console.log(`[Bootstrap] Fetching batch ${batchNum} (cursor: ${lastId || "start"})...`);

        const result = await convex.query(
          api.orders.getAllOrders,
          {
            limit: 5000, // Fetch 5000 per batch to stay under Convex's 8MB limit
            daysBack: 36500, // 100 years back = all historical data
            lastId: lastId, // Pass cursor for next batch
          },
        );

        if (!result || result.length === 0) {
          console.log(`[Bootstrap] Batch ${batchNum} returned 0 orders, pagination complete`);
          break;
        }

        allOrders = allOrders.concat(result);
        console.log(
          `[Bootstrap] Batch ${batchNum}: ${result.length} orders (total: ${allOrders.length})`,
        );

        // Set cursor to last order's ID for next batch
        lastId = result[result.length - 1]?._id;

        // If we got fewer than 5000, means we reached the end
        if (result.length < 5000) {
          console.log(`[Bootstrap] Last batch had < 5000 orders, complete`);
          break;
        }
      }

      if (allOrders.length > 0) {
        console.log(`[Bootstrap] ✅ Total fetched: ${allOrders.length} orders`);
      } else {
        console.log("[Bootstrap] No orders found in Convex");
      }
    } catch (error) {
      console.error(`[Bootstrap] Error fetching orders:`, error);
    }

    if (allOrders.length === 0) {
      console.log("[Bootstrap] No historical orders found in Convex");
    } else {
      // Cache all orders to SQLite
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sqliteDB.cacheOrdersBatch(allOrders as any);
      console.log(
        `[Bootstrap] ✅ Cached ${allOrders.length} orders to SQLite`,
      );

      // Update timestamp
      localStorage.setItem(ALL_ORDERS_CACHE_TS_KEY, String(Date.now()));
    }
  } catch (error) {
    console.error("[Bootstrap] Failed to bootstrap all orders:", error);
  }
}

/**
 * Incremental sync - fetch only new/updated orders since last sync
 * This is used by ConvexSyncService for periodic updates
 */
export async function syncNewOrdersSinceLastCache(
  convex: ConvexReactClient,
): Promise<number> {
  const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;
  if (!isDesktop) return 0;

  const sqliteDB = getSqliteDB();
  if (!sqliteDB) return 0;

  try {
    const lastTimestamp = await sqliteDB.getLastCachedOrderTimestamp();
    const sinceTimestamp = lastTimestamp || Date.now() - 7 * 24 * 60 * 60 * 1000; // Default: last 7 days

    console.log(
      `[Bootstrap] Syncing orders since ${new Date(sinceTimestamp).toISOString()}...`,
    );

    // Fetch recent orders since timestamp
    const result = await convex.query(
      api.orders.getAllOrders,
      {
        limit: 5000,
        daysBack: Math.ceil((Date.now() - sinceTimestamp) / (24 * 60 * 60 * 1000)),
      },
    );

    if (!result || result.length === 0) {
      console.log("[Bootstrap] No new orders to sync");
      return 0;
    }

    // Filter to only orders after sinceTimestamp
    const newOrders = (result as Array<{ createdAt?: number; [key: string]: unknown }>).filter((o) => (o.createdAt || 0) >= sinceTimestamp);

    if (newOrders.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sqliteDB.cacheOrdersBatch(newOrders as any);
    }

    console.log(`[Bootstrap] Synced ${newOrders.length} new orders`);
    return newOrders.length;
  } catch (error) {
    console.error("[Bootstrap] Failed to sync new orders:", error);
    return 0;
  }
}

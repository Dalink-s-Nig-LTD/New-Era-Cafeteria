// Convex sync service: handles periodic order syncing and reference data refresh
// Runs in the background on Tauri desktop, pushing orders and pulling fresh data

import { ConvexReactClient } from "convex/react";
import { api } from "@/lib/convexApi";
import { sqliteDB } from "@/lib/sqlite";
import { Order, CartItem } from "@/types/cafeteria";
import { syncNewOrdersSinceLastCache } from "@/lib/bootstrapAllOrders";

const ORDER_SYNC_INTERVAL_MS = 30 * 1000; // Sync pending orders every 30s
const REF_DATA_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // Refresh reference data every 6 hours
const ALL_ORDERS_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // Sync all orders every 12 hours

const REF_CACHE_TS_KEY = "referenceCacheLastSyncAt";

interface SyncStats {
  ordersSynced: number;
  ordersFailed: number;
  refDataRefreshed: boolean;
  lastSyncAt: number;
}

export class ConvexSyncService {
  private convexClient: ConvexReactClient;
  private orderSyncTimer: ReturnType<typeof setInterval> | null = null;
  private refDataSyncTimer: ReturnType<typeof setInterval> | null = null;
  private allOrdersSyncTimer: ReturnType<typeof setInterval> | null = null;
  private isOrderSyncing = false;
  private isRefDataSyncing = false;
  private isAllOrdersSyncing = false;
  private syncStats: SyncStats = {
    ordersSynced: 0,
    ordersFailed: 0,
    refDataRefreshed: false,
    lastSyncAt: 0,
  };

  constructor(convexClient: ConvexReactClient) {
    this.convexClient = convexClient;
  }

  /**
   * Start background sync services.
   * Call this once when app initializes.
   */
  start() {
    if (!sqliteDB) {
      console.log("[ConvexSync] SQLite not available, skipping sync service");
      return;
    }

    console.log("[ConvexSync] Starting background sync service...");

    // Sync orders immediately, then every 30s
    this.syncOrders().catch(console.error);
    this.orderSyncTimer = setInterval(
      () => this.syncOrders().catch(console.error),
      ORDER_SYNC_INTERVAL_MS,
    );

    // Refresh reference data immediately, then every 6 hours
    this.refreshReferenceData().catch(console.error);
    this.refDataSyncTimer = setInterval(
      () => this.refreshReferenceData().catch(console.error),
      REF_DATA_SYNC_INTERVAL_MS,
    );

    // Sync all orders every 12 hours (after slight delay to not clog startup)
    this.allOrdersSyncTimer = setInterval(
      () => this.syncAllOrders().catch(console.error),
      ALL_ORDERS_SYNC_INTERVAL_MS,
    );
  }

  /**
   * Stop all background sync services.
   */
  stop() {
    if (this.orderSyncTimer) {
      clearInterval(this.orderSyncTimer);
      this.orderSyncTimer = null;
    }
    if (this.refDataSyncTimer) {
      clearInterval(this.refDataSyncTimer);
      this.refDataSyncTimer = null;
    }
    if (this.allOrdersSyncTimer) {
      clearInterval(this.allOrdersSyncTimer);
      this.allOrdersSyncTimer = null;
    }
    console.log("[ConvexSync] Stopped background sync service");
  }

  /**
   * Sync pending orders from SQLite to Convex.
   */
  private async syncOrders() {
    if (!sqliteDB || this.isOrderSyncing) return;

    try {
      this.isOrderSyncing = true;
      const pending = await sqliteDB.getAllPendingOrders();

      if (pending.length === 0) {
        return; // Nothing to sync
      }

      console.log(`[ConvexSync] Syncing ${pending.length} pending orders...`);

      let synced = 0;
      let failed = 0;

      for (const queuedOrder of pending) {
        try {
          await sqliteDB.updateStatus(queuedOrder.id, "syncing");

          // Map cart items to ConvexOrderItem format
          const mappedItems = queuedOrder.order.items.map((item) => {
            // Check if this is a custom item (id starts with 'custom-' or has isCustom flag)
            const isCustom = item.id.toString().startsWith("custom-") || (item as { isCustom?: boolean }).isCustom;
            const result: Record<string, boolean | string | number | undefined> = {
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              category: item.category,
              isCustom: isCustom || undefined,
            };
            // Only add menuItemId if not custom
            if (!isCustom) {
              result.menuItemId = item.id;
            }
            return result;
          });

          // Call Convex API to create the order
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result: any = await this.convexClient.mutation(api.orders.createOrder, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: mappedItems as any,
            total: queuedOrder.order.total,
            paymentMethod: queuedOrder.order.paymentMethod || "cash",
            status: "completed",
            orderType: queuedOrder.order.orderType || "regular",
            cashierCode: queuedOrder.order.cashierCode || "system",
            clientOrderId: queuedOrder.clientOrderId,
            createdAt: queuedOrder.createdAt,
          });

          await sqliteDB.updateStatus(queuedOrder.id, "synced");
          synced++;
          console.log(`✅ Order ${queuedOrder.id} synced to Convex`);
        } catch (error) {
          failed++;
          await sqliteDB.incrementAttempt(queuedOrder.id);
          const attempts = (await sqliteDB.getOrder(queuedOrder.id))?.attempts || 0;

          // Fail after 5 attempts
          if (attempts > 5) {
            await sqliteDB.updateStatus(
              queuedOrder.id,
              "failed",
              `Failed after ${attempts} attempts: ${String(error)}`,
            );
            console.error(`❌ Order ${queuedOrder.id} failed permanently:`, error);
          } else {
            console.warn(
              `⚠️ Order ${queuedOrder.id} sync attempt ${attempts}, will retry`,
              error,
            );
          }
        }
      }

      this.syncStats.ordersSynced += synced;
      this.syncStats.ordersFailed += failed;
      this.syncStats.lastSyncAt = Date.now();

      console.log(
        `[ConvexSync] Order sync complete: ${synced} synced, ${failed} failed`,
      );
    } catch (error) {
      console.error("[ConvexSync] Error syncing orders:", error);
    } finally {
      this.isOrderSyncing = false;
    }
  }

  /**
   * Refresh reference data (menu items, access codes, customers) from Convex.
   */
  private async refreshReferenceData() {
    if (!sqliteDB || this.isRefDataSyncing) return;

    try {
      this.isRefDataSyncing = true;

      const lastSyncRaw = localStorage.getItem(REF_CACHE_TS_KEY);
      const lastSyncAt = lastSyncRaw ? Number(lastSyncRaw) : 0;
      const isFresh =
        Number.isFinite(lastSyncAt) &&
        Date.now() - lastSyncAt < REF_DATA_SYNC_INTERVAL_MS;

      if (isFresh) {
        console.log("[ConvexSync] Reference data still fresh, skipping refresh");
        return;
      }

      console.log("[ConvexSync] Refreshing reference data from Convex...");

      try {
        const [menuItems, accessCodes, customers, shiftSettings] = await Promise.all([
          this.convexClient.query(api.menuItems.getAllMenuItems, {}),
          this.convexClient.query(api.accessCodes.listAccessCodes, {}),
          this.convexClient.query(api.customers.getAllCustomers, {}),
          this.convexClient.query(api.shiftSettings.getEnabledShifts, {}),
        ]);

        interface MenuItemData { _id: string; name: string; category: string; price: number; image?: string; available?: boolean }
        interface AccessCodeData { code: string; shift?: "morning" | "afternoon" | "evening"; isActive?: boolean }
        interface CustomerData { _id: string; customerId: string; barcodeData: string; firstName: string; lastName: string; department: string; classLevel: string; photo?: string; balance?: number; isActive?: boolean; expiryDate?: number; createdAt: number; updatedAt: number }

        await Promise.all([
          sqliteDB.cacheMenuItems(
            (menuItems as MenuItemData[] || []).map((item) => ({
              _id: String(item._id),
              name: item.name,
              category: item.category,
              price: item.price,
              image: item.image,
              available: !!item.available,
            })),
          ),
          sqliteDB.cacheAccessCodes(
            (accessCodes as AccessCodeData[] || []).map((code) => ({
              code: code.code,
              shift: code.shift as "morning" | "afternoon" | "evening" | undefined,
              isActive: !!code.isActive,
            })),
          ),
          sqliteDB.cacheCustomers(
            (customers as CustomerData[] || []).map((customer) => ({
              _id: String(customer._id),
              customerId: customer.customerId,
              barcodeData: customer.barcodeData,
              firstName: customer.firstName,
              lastName: customer.lastName,
              department: customer.department,
              classLevel: customer.classLevel,
              photo: customer.photo,
              balance: customer.balance || 0,
              isActive: !!customer.isActive,
              expiryDate: customer.expiryDate,
              createdAt: customer.createdAt,
              updatedAt: customer.updatedAt,
            })),
          ),
          sqliteDB.cacheShiftSettings((shiftSettings || []) as string[]),
        ]);

        console.log(
          `[ConvexSync] Reference data refreshed (menu: ${(menuItems || []).length}, codes: ${(accessCodes || []).length}, customers: ${(customers || []).length}, shifts: ${(shiftSettings || []).length})`,
        );
        localStorage.setItem(REF_CACHE_TS_KEY, String(Date.now()));
        this.syncStats.refDataRefreshed = true;
      } catch (error) {
        console.error("[ConvexSync] Failed to refresh reference data:", error);
      }
    } finally {
      this.isRefDataSyncing = false;
    }
  }

  /**
   * Get current sync statistics.
   */
  getStats(): SyncStats {
    return { ...this.syncStats };
  }

  /**
   * Manually trigger order sync (for testing or forced sync).
   */
  async syncNow() {
    return this.syncOrders();
  }

  /**
   * Cache a single order to SQLite (called when order is created)
   */
  async cacheNewOrder(order: any): Promise<void> {
    if (!sqliteDB) return;
    
    try {
      await sqliteDB.cacheOrdersBatch([order]);
      console.log(`[ConvexSync] Cached new order to SQLite:`, order._id);
    } catch (error) {
      console.error("[ConvexSync] Failed to cache new order:", error);
    }
  }

  /**
   * Manually trigger reference data refresh.
   */
  async refreshNow() {
    localStorage.removeItem(REF_CACHE_TS_KEY); // Force refresh by clearing timestamp
    return this.refreshReferenceData();
  }

  /**
   * Sync all historical orders from Convex (incremental - only new/updated orders)
   */
  private async syncAllOrders() {
    if (!sqliteDB || this.isAllOrdersSyncing) return;

    try {
      this.isAllOrdersSyncing = true;
      console.log("[ConvexSync] Starting incremental all-orders sync...");

      const newOrdersCount = await syncNewOrdersSinceLastCache(this.convexClient);
      console.log(
        `[ConvexSync] All-orders sync complete: ${newOrdersCount} new orders synced`,
      );
    } catch (error) {
      console.error("[ConvexSync] Error syncing all orders:", error);
    } finally {
      this.isAllOrdersSyncing = false;
    }
  }
}

// Singleton instance
let syncService: ConvexSyncService | null = null;

export function getConvexSyncService(
  convexClient: ConvexReactClient,
): ConvexSyncService {
  if (!syncService) {
    syncService = new ConvexSyncService(convexClient);
  }
  return syncService;
}

export function initConvexSync(convexClient: ConvexReactClient) {
  const service = getConvexSyncService(convexClient);
  service.start();
  return service;
}

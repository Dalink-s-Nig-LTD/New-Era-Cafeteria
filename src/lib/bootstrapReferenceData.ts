import { ConvexReactClient } from "convex/react";
import { api } from "@/lib/convexApi";
import { sqliteDB } from "@/lib/sqlite";

const REF_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REF_CACHE_TS_KEY = "referenceCacheLastSyncAt";

export async function bootstrapReferenceData(
  convexClient: ConvexReactClient,
): Promise<void> {
  if (!sqliteDB) return;

  const lastSyncRaw = localStorage.getItem(REF_CACHE_TS_KEY);
  const lastSyncAt = lastSyncRaw ? Number(lastSyncRaw) : 0;
  const isFresh = Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < REF_CACHE_TTL_MS;

  // Check if cache is empty (not just TTL expiry)
  const cachedMenuItems = await sqliteDB.getCachedMenuItems();
  const cacheIsEmpty = cachedMenuItems.length === 0;

  if (isFresh && !cacheIsEmpty) {
    console.log("[Bootstrap] Reference cache still fresh, skipping refresh");
    return;
  }

  if (cacheIsEmpty) {
    console.log("[Bootstrap] Empty reference cache detected, fetching from Convex (new PC or fresh install)...");
  } else {
    console.log("[Bootstrap] Reference cache expired, refreshing from Convex...");
  }

  try {
    const [menuItems, accessCodes, customers] = await Promise.all([
      convexClient.query(api.menuItems.getAllMenuItems, {}),
      convexClient.query(api.accessCodes.listAccessCodes, {}),
      convexClient.query(api.customers.getAllCustomers, {}),
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
    ]);

    console.log(
      `[Bootstrap] Reference cache refreshed (menu: ${(menuItems || []).length}, codes: ${(accessCodes || []).length}, customers: ${(customers || []).length})`,
    );
    localStorage.setItem(REF_CACHE_TS_KEY, String(Date.now()));
  } catch (error) {
    console.error("[Bootstrap] Failed to refresh reference cache:", error);
  }
}

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

  if (isFresh) {
    console.log("[Bootstrap] Reference cache still fresh, skipping refresh");
    return;
  }

  try {
    const [menuItems, accessCodes, customers] = await Promise.all([
      convexClient.query(api.menuItems.getAllMenuItems, {}),
      convexClient.query(api.accessCodes.listAccessCodes, {}),
      convexClient.query(api.customers.getAllCustomers, {}),
    ]);

    await Promise.all([
      sqliteDB.cacheMenuItems(
        (menuItems || []).map((item: any) => ({
          _id: String(item._id),
          name: item.name,
          category: item.category,
          price: item.price,
          image: item.image,
          available: !!item.available,
        })),
      ),
      sqliteDB.cacheAccessCodes(
        (accessCodes || []).map((code: any) => ({
          code: code.code,
          shift: code.shift,
          isActive: !!code.isActive,
        })),
      ),
      sqliteDB.cacheCustomers(
        (customers || []).map((customer: any) => ({
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

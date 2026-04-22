// Convex fallback layer for SQLite cache misses
// If local SQLite doesn't have data (new PC), fetch from Convex and cache it

import { ConvexReactClient } from "convex/react";
import { api } from "@/lib/convexApi";
import { sqliteDB } from "@/lib/sqlite";
import { ValidateCodeResponse } from "@/types/cafeteria";

interface MenuItemData { _id: string; name: string; category: string; price: number; image?: string; available?: boolean }
interface AccessCodeData { code: string; shift?: "morning" | "afternoon" | "evening"; isActive?: boolean }
interface CustomerData { _id: string; customerId: string; barcodeData: string; firstName: string; lastName: string; department: string; classLevel: string; photo?: string; balance?: number; isActive?: boolean; expiryDate?: number; createdAt: number; updatedAt: number }

/**
 * Fallback for menu item lookup - checks SQLite first, then Convex
 * If found in Convex but not SQLite, caches it automatically
 */
export async function getMenuItemWithFallback(
  convexClient: ConvexReactClient,
  name: string,
): Promise<{ _id: string; name: string; category: string; price: number; image?: string; available: boolean } | null> {
  if (!sqliteDB) return null;

  try {
    // Try SQLite first
    const cached = await sqliteDB.getMenuItemByName(name);
    if (cached) {
      console.log(`[Fallback] Menu item "${name}" found in SQLite cache`);
      return cached;
    }

    // Fallback to Convex if not in cache
    console.log(`[Fallback] Menu item "${name}" not in SQLite, fetching from Convex...`);
    const items = await convexClient.query(api.menuItems.getAllMenuItems, {});
    const found = (items as MenuItemData[] || []).find(i => i.name === name);

    if (found) {
      // Cache it for next time
      await sqliteDB.cacheMenuItems([{
        _id: String(found._id),
        name: found.name,
        category: found.category,
        price: found.price,
        image: found.image,
        available: !!found.available,
      }]);
      console.log(`[Fallback] Cached menu item "${name}" to SQLite`);
      return {
        _id: String(found._id),
        name: found.name,
        category: found.category,
        price: found.price,
        image: found.image,
        available: !!found.available,
      };
    }

    return null;
  } catch (error) {
    console.error("[Fallback] Error fetching menu item with fallback:", error);
    return null;
  }
}

/**
 * Fallback for customer lookup - checks SQLite first, then Convex
 */
export async function getCustomerWithFallback(
  convexClient: ConvexReactClient,
  barcode: string,
): Promise<{
  _id: string;
  customerId: string;
  barcodeData: string;
  firstName: string;
  lastName: string;
  department: string;
  classLevel: string;
  photo?: string;
  balance: number;
  isActive: boolean;
  expiryDate?: number;
  createdAt: number;
  updatedAt: number;
} | null> {
  if (!sqliteDB) return null;

  try {
    // Try SQLite first
    const cached = await sqliteDB.getCachedCustomerByBarcode(barcode);
    if (cached) {
      console.log(`[Fallback] Customer barcode "${barcode}" found in SQLite cache`);
      return cached;
    }

    // Fallback to Convex if not in cache
    console.log(`[Fallback] Customer barcode "${barcode}" not in SQLite, fetching from Convex...`);
    const customer = await convexClient.query(api.customers.getCustomerByBarcode, {
      barcodeData: barcode,
    });

    if (customer) {
      // Cache it for next time
      await sqliteDB.cacheCustomers([{
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
      }]);
      console.log(`[Fallback] Cached customer barcode "${barcode}" to SQLite`);
      return {
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
      };
    }

    return null;
  } catch (error) {
    console.error("[Fallback] Error fetching customer with fallback:", error);
    return null;
  }
}

/**
 * Fallback for PIN validation - checks local cache first, then Convex
 */
export async function validatePinWithFallback(
  convexClient: ConvexReactClient,
  code: string,
): Promise<boolean> {
  if (!sqliteDB) {
    // Not on desktop, use Convex directly
    const result = await convexClient.query(api.accessCodes.validateCode, { code });
    return result?.valid || false;
  }

  try {
    // Try SQLite first
    const isValid = await sqliteDB.validateAccessCode(code);
    if (isValid) {
      console.log(`[Fallback] PIN validated from SQLite cache`);
      return true;
    }

    // Fallback to Convex if not in cache or invalid locally
    console.log(`[Fallback] PIN not found in SQLite, validating from Convex...`);
    const result: ValidateCodeResponse = await convexClient.query(api.accessCodes.validateCode, { code });
    if (result?.valid) {
      // Cache it for next time
      await sqliteDB.cacheAccessCodes([{
        code: code,
        shift: result.shift,
        isActive: true,
      }]);
      console.log(`[Fallback] Cached valid PIN to SQLite`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("[Fallback] Error validating PIN with fallback:", error);
    return false;
  }
}

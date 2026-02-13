/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessCodes from "../accessCodes.js";
import type * as activityLogs from "../activityLogs.js";
import type * as adminAuth from "../adminAuth.js";
import type * as adminuser from "../adminuser.js";
import type * as auth from "../auth.js";
import type * as calculateEveningTotal from "../calculateEveningTotal.js";
import type * as checkAllTodayOrders from "../checkAllTodayOrders.js";
import type * as checkBetweenShiftOrders from "../checkBetweenShiftOrders.js";
import type * as checkDuplicates from "../checkDuplicates.js";
import type * as checkMorningShift from "../checkMorningShift.js";
import type * as checkOrdersByDate from "../checkOrdersByDate.js";
import type * as clearDemoCodes from "../clearDemoCodes.js";
import type * as debugEveningCalculation from "../debugEveningCalculation.js";
import type * as debugFrontendCalculation from "../debugFrontendCalculation.js";
import type * as fixManualEntries from "../fixManualEntries.js";
import type * as getAllEveningOrders from "../getAllEveningOrders.js";
import type * as getAllTimeSales from "../getAllTimeSales.js";
import type * as getFullDaySales from "../getFullDaySales.js";
import type * as getMorningShiftTotal from "../getMorningShiftTotal.js";
import type * as getRevenueUpToDate from "../getRevenueUpToDate.js";
import type * as getShiftSales from "../getShiftSales.js";
import type * as http from "../http.js";
import type * as manualEntries from "../manualEntries.js";
import type * as markAllAsSpecialOrders from "../markAllAsSpecialOrders.js";
import type * as markSpecialOrders from "../markSpecialOrders.js";
import type * as menuItems from "../menuItems.js";
import type * as migrateAdminUsers from "../migrateAdminUsers.js";
import type * as orders from "../orders.js";
import type * as seedAccessCodes from "../seedAccessCodes.js";
import type * as seedCustomPlaceholder from "../seedCustomPlaceholder.js";
import type * as seedSpecialOrderItems from "../seedSpecialOrderItems.js";
import type * as seedSpecialOrders from "../seedSpecialOrders.js";
import type * as setMorningAndYesterdayOrders from "../setMorningAndYesterdayOrders.js";
import type * as specialOrders from "../specialOrders.js";
import type * as updateAccessCodesShift from "../updateAccessCodesShift.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessCodes: typeof accessCodes;
  activityLogs: typeof activityLogs;
  adminAuth: typeof adminAuth;
  adminuser: typeof adminuser;
  auth: typeof auth;
  calculateEveningTotal: typeof calculateEveningTotal;
  checkAllTodayOrders: typeof checkAllTodayOrders;
  checkBetweenShiftOrders: typeof checkBetweenShiftOrders;
  checkDuplicates: typeof checkDuplicates;
  checkMorningShift: typeof checkMorningShift;
  checkOrdersByDate: typeof checkOrdersByDate;
  clearDemoCodes: typeof clearDemoCodes;
  debugEveningCalculation: typeof debugEveningCalculation;
  debugFrontendCalculation: typeof debugFrontendCalculation;
  fixManualEntries: typeof fixManualEntries;
  getAllEveningOrders: typeof getAllEveningOrders;
  getAllTimeSales: typeof getAllTimeSales;
  getFullDaySales: typeof getFullDaySales;
  getMorningShiftTotal: typeof getMorningShiftTotal;
  getRevenueUpToDate: typeof getRevenueUpToDate;
  getShiftSales: typeof getShiftSales;
  http: typeof http;
  manualEntries: typeof manualEntries;
  markAllAsSpecialOrders: typeof markAllAsSpecialOrders;
  markSpecialOrders: typeof markSpecialOrders;
  menuItems: typeof menuItems;
  migrateAdminUsers: typeof migrateAdminUsers;
  orders: typeof orders;
  seedAccessCodes: typeof seedAccessCodes;
  seedCustomPlaceholder: typeof seedCustomPlaceholder;
  seedSpecialOrderItems: typeof seedSpecialOrderItems;
  seedSpecialOrders: typeof seedSpecialOrders;
  setMorningAndYesterdayOrders: typeof setMorningAndYesterdayOrders;
  specialOrders: typeof specialOrders;
  updateAccessCodesShift: typeof updateAccessCodesShift;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

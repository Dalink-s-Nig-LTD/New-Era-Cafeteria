import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@/lib/convexApi";
import { api } from "../../convex/_generated/api";
import { orderQueue } from "@/lib/orderQueue";
import { getSqliteDB } from "@/lib/sqlite";
import type { Order } from "@/types/cafeteria";
import { useAuth } from "@/contexts/AuthContext";

interface ShiftData {
  totalSales: number;
  orderCount: number;
  byAccessCode: Record<string, { totalSales: number; orderCount: number }>;
}

interface ShiftSalesData {
  morning: ShiftData;
  afternoon: ShiftData;
  evening: ShiftData;
  unassigned: ShiftData;
  fullDay: ShiftData;
}

const emptyShift: ShiftData = { totalSales: 0, orderCount: 0, byAccessCode: {} };

type AccessCodeLite = {
  code: string;
  shift?: "morning" | "afternoon" | "evening";
  isActive: boolean;
};

/**
 * Hook that provides shift sales data.
 * - Tauri (desktop): reads from local SQLite, filtered to current cashier only.
 * - Web (browser): reads from Convex getShiftSales query.
 */
export function useShiftSalesWithLocal(enabled = true) {
  const isTauri = "__TAURI__" in window;
  const { code: currentCode } = useAuth();

  // Convex query — only used on web
  const shiftSales = useQuery(
    api.getShiftSales.getShiftSales,
    enabled && currentCode ? { cashierCode: currentCode } : "skip"
  );
  const enabledShifts = useQuery(
    api.shiftSettings.getEnabledShifts,
    isTauri ? {} : "skip"
  ) as string[] | undefined;

  const [localSales, setLocalSales] = useState<ShiftSalesData | null>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(isTauri);
  const [unsyncedLocalCount, setUnsyncedLocalCount] = useState(0);
  const [cachedAccessCodes, setCachedAccessCodes] = useState<AccessCodeLite[]>([]);

  useEffect(() => {
    if (!isTauri) return;

    const loadCachedCodes = async () => {
      try {
        const sqlite = getSqliteDB();
        if (!sqlite) return;
        const rows = await sqlite.getCachedAccessCodes();
        setCachedAccessCodes(rows);
      } catch (error) {
        console.error("Failed to load cached access codes:", error);
      }
    };

    loadCachedCodes();
  }, [isTauri]);

  const fetchLocalOrders = useCallback(async () => {
    if (!enabled || !isTauri) return;

    try {
      const allQueued = await orderQueue.getAllOrders();

      // Filter to today's orders only
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();

      const todaysQueued = allQueued
        .filter(
          (qo) =>
            qo.createdAt >= todayTimestamp &&
            (qo.order as Order & { orderType?: string; cashierCode?: string }).orderType !== "special" &&
            // Only this cashier's orders
            (qo.order as Order & { orderType?: string; cashierCode?: string }).cashierCode === currentCode
        );

      const unsyncedCount = todaysQueued.filter(
        (qo) => qo.status === "pending" || qo.status === "failed"
      ).length;

      const todaysOrders = todaysQueued.map((qo) => ({
          total: qo.order.total,
          cashierCode: (qo.order as Order & { cashierCode?: string }).cashierCode || "LOCAL",
          createdAt: qo.createdAt,
        }));

      // Build code-to-shift map from cached access codes
      const codeToShift: Record<string, "morning" | "afternoon" | "evening" | undefined> = {};
      cachedAccessCodes.forEach((ac) => {
        codeToShift[ac.code] = ac.shift;
      });

      // Group by shift — disabled shifts go to unassigned
      const isShiftEnabled = (s: string) => !enabledShifts || enabledShifts.includes(s);
      const morning = todaysOrders.filter((o) => codeToShift[o.cashierCode] === "morning" && isShiftEnabled("morning"));
      const afternoon = todaysOrders.filter((o) => codeToShift[o.cashierCode] === "afternoon" && isShiftEnabled("afternoon"));
      const evening = todaysOrders.filter((o) => codeToShift[o.cashierCode] === "evening" && isShiftEnabled("evening"));
      const unassigned = todaysOrders.filter((o) => {
        const shift = codeToShift[o.cashierCode];
        if (shift === undefined) return true;
        if (!isShiftEnabled(shift)) return true;
        return false;
      });

      const groupByCode = (orders: typeof todaysOrders) => {
        const grouped: Record<string, { totalSales: number; orderCount: number }> = {};
        orders.forEach((o) => {
          const code = o.cashierCode || "UNKNOWN";
          if (!grouped[code]) grouped[code] = { totalSales: 0, orderCount: 0 };
          grouped[code].totalSales += o.total;
          grouped[code].orderCount += 1;
        });
        return grouped;
      };

      setLocalSales({
        morning: {
          totalSales: morning.reduce((s, o) => s + o.total, 0),
          orderCount: morning.length,
          byAccessCode: groupByCode(morning),
        },
        afternoon: {
          totalSales: afternoon.reduce((s, o) => s + o.total, 0),
          orderCount: afternoon.length,
          byAccessCode: groupByCode(afternoon),
        },
        evening: {
          totalSales: evening.reduce((s, o) => s + o.total, 0),
          orderCount: evening.length,
          byAccessCode: groupByCode(evening),
        },
        unassigned: {
          totalSales: unassigned.reduce((s, o) => s + o.total, 0),
          orderCount: unassigned.length,
          byAccessCode: groupByCode(unassigned),
        },
        fullDay: {
          totalSales: todaysOrders.reduce((s, o) => s + o.total, 0),
          orderCount: todaysOrders.length,
          byAccessCode: groupByCode(todaysOrders),
        },
      });
      setUnsyncedLocalCount(unsyncedCount);
      setIsLocalLoading(false);
    } catch (error) {
      console.error("Failed to fetch local orders for sales report:", error);
      setIsLocalLoading(false);
    }
  }, [enabled, isTauri, currentCode, cachedAccessCodes, enabledShifts]);

  useEffect(() => {
    if (!enabled) return;
    fetchLocalOrders();
    const interval = setInterval(fetchLocalOrders, 10000);
    return () => clearInterval(interval);
  }, [enabled, fetchLocalOrders]);

  // Tauri: local-only, no merge. Web: Convex-only, filtered to current cashier.
  if (isTauri) {
    return {
      shiftSales: localSales,
      isLoading: isLocalLoading,
      hasLocalData: !!localSales,
      localOrderCount: localSales?.fullDay.orderCount || 0,
      unsyncedCount: unsyncedLocalCount,
    };
  }

  return {
    shiftSales: shiftSales ?? null,
    isLoading: enabled && shiftSales === undefined,
    hasLocalData: false,
    localOrderCount: 0,
    unsyncedCount: 0,
  };
}

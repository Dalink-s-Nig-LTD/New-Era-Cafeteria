import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@/lib/convexApi";
import { api } from "../../convex/_generated/api";
import { orderQueue } from "@/lib/orderQueue";
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

/**
 * Hook that provides shift sales data.
 * - Tauri (desktop): reads from local SQLite, filtered to current cashier only.
 * - Web (browser): reads from Convex getShiftSales query.
 */
export function useShiftSalesWithLocal() {
  const isTauri = "__TAURI__" in window;
  const { code: currentCode } = useAuth();

  // Convex query — only used on web
  const shiftSales = useQuery(api.getShiftSales.getShiftSales);
  const accessCodes = useQuery(api.accessCodes.listAccessCodes);

  const [localSales, setLocalSales] = useState<ShiftSalesData | null>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(isTauri);
  const [unsyncedLocalCount, setUnsyncedLocalCount] = useState(0);

  const fetchLocalOrders = useCallback(async () => {
    if (!isTauri) return;

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
            (qo.order as any).orderType !== "special" &&
            // Only this cashier's orders
            (qo.order as any).cashierCode === currentCode
        );

      const unsyncedCount = todaysQueued.filter(
        (qo) => qo.status === "pending" || qo.status === "failed"
      ).length;

      const todaysOrders = todaysQueued.map((qo) => ({
          total: qo.order.total,
          cashierCode: (qo.order as any).cashierCode || "LOCAL",
          createdAt: qo.createdAt,
        }));

      // Build code-to-shift map from cached access codes
      const codeToShift: Record<string, "morning" | "afternoon" | "evening" | undefined> = {};
      if (accessCodes) {
        accessCodes.forEach((ac) => {
          codeToShift[ac.code] = ac.shift;
        });
      }

      // Group by shift
      const morning = todaysOrders.filter((o) => codeToShift[o.cashierCode] === "morning");
      const afternoon = todaysOrders.filter((o) => codeToShift[o.cashierCode] === "afternoon");
      const evening = todaysOrders.filter((o) => codeToShift[o.cashierCode] === "evening");
      const unassigned = todaysOrders.filter((o) => codeToShift[o.cashierCode] === undefined);

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
  }, [isTauri, currentCode, accessCodes]);

  useEffect(() => {
    fetchLocalOrders();
    const interval = setInterval(fetchLocalOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchLocalOrders]);

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

  // Filter Convex data to current cashier only
  const filteredShiftSales = shiftSales && currentCode ? (() => {
    const filterShift = (shift: ShiftData): ShiftData => {
      const codeData = shift.byAccessCode[currentCode];
      if (!codeData) return { totalSales: 0, orderCount: 0, byAccessCode: {} };
      return {
        totalSales: codeData.totalSales,
        orderCount: codeData.orderCount,
        byAccessCode: { [currentCode]: codeData },
      };
    };
    return {
      morning: filterShift(shiftSales.morning),
      afternoon: filterShift(shiftSales.afternoon),
      evening: filterShift(shiftSales.evening),
      unassigned: filterShift(shiftSales.unassigned),
      fullDay: (() => {
        const codeData = shiftSales.fullDay.byAccessCode[currentCode];
        if (!codeData) return { totalSales: 0, orderCount: 0, byAccessCode: {} };
        return {
          totalSales: codeData.totalSales,
          orderCount: codeData.orderCount,
          byAccessCode: { [currentCode]: codeData },
        };
      })(),
    };
  })() : null;

  return {
    shiftSales: filteredShiftSales ?? null,
    isLoading: !shiftSales,
    hasLocalData: false,
    localOrderCount: 0,
    unsyncedCount: 0,
  };
}

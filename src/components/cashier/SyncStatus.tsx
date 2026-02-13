import React, { useEffect, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import {
  WifiOff,
  CloudOff,
  CheckCircle,
  AlertCircle,
  Database,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { orderQueue } from "@/lib/orderQueue";

export function SyncStatus() {
  const { isConnected, pendingOrdersCount } = useCart();
  const isTauri = "__TAURI__" in window;
  const [syncStats, setSyncStats] = useState<{
    pending: number;
    failed: number;
    synced: number;
  } | null>(null);

  // Periodically fetch sync stats on desktop
  useEffect(() => {
    if (!isTauri) return;

    const fetchStats = async () => {
      try {
        const stats = await orderQueue.getSyncStats();
        setSyncStats({
          pending: stats.pending,
          failed: stats.failed,
          synced: stats.synced,
        });
      } catch {
        // Ignore stats fetch errors
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [isTauri]);

  // Don't show on web app
  if (!isTauri) return null;

  const failedCount = syncStats?.failed || 0;
  const totalPending = pendingOrdersCount + failedCount;

  const getStatusInfo = () => {
    if (!isConnected && totalPending > 0) {
      return {
        icon: CloudOff,
        text: `Offline · ${totalPending} queued`,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
      };
    }

    if (!isConnected) {
      return {
        icon: WifiOff,
        text: "Offline mode",
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
      };
    }

    if (failedCount > 0) {
      return {
        icon: AlertCircle,
        text: `${failedCount} failed order${failedCount > 1 ? "s" : ""}`,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
      };
    }

    if (pendingOrdersCount > 0) {
      return {
        icon: Loader2,
        text: `Syncing ${pendingOrdersCount} order${pendingOrdersCount > 1 ? "s" : ""}...`,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        animate: true,
      };
    }

    return {
      icon: CheckCircle,
      text: "Synced",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        status.bgColor,
        status.borderColor,
      )}
    >
      {totalPending > 0 && <Database className={cn("w-3 h-3", status.color)} />}
      <Icon
        className={cn(
          "w-4 h-4",
          status.color,
          "animate" in status && status.animate ? "animate-spin" : "",
        )}
      />
      <span className={cn("text-sm font-medium", status.color)}>
        {status.text}
      </span>
    </div>
  );
}

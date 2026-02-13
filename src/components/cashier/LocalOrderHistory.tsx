import React, { useEffect, useState, useCallback } from "react";
import { orderQueue } from "@/lib/orderQueue";
import type { QueuedOrder } from "@/lib/sqlite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function LocalOrderHistory() {
  const [orders, setOrders] = useState<QueuedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize the order queue on mount
  useEffect(() => {
    const initQueue = async () => {
      try {
        console.log("[LocalOrderHistory] Initializing order queue...");
        await orderQueue.init();
        console.log("[LocalOrderHistory] Order queue initialized successfully");
        setInitialized(true);
      } catch (err) {
        console.error("[LocalOrderHistory] Failed to initialize order queue:", err);
        setError("Failed to initialize order storage");
        setLoading(false);
      }
    };
    
    initQueue();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!initialized) {
      console.log("[LocalOrderHistory] Skipping fetch - not initialized yet");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log("[LocalOrderHistory] Fetching orders...");
      // Fetch all orders (pending, failed, synced)
      const allOrders = await orderQueue.getAllOrders();
      console.log("[LocalOrderHistory] Fetched ALL local orders:", allOrders);
      console.log("[LocalOrderHistory] Local order count:", allOrders.length);
      
      // Sort by most recent first
      allOrders.sort((a, b) => b.createdAt - a.createdAt);
      setOrders(allOrders);
    } catch (err) {
      console.error("[LocalOrderHistory] Failed to fetch local orders:", err);
      setError("Could not load local orders.");
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  // Fetch orders when initialized
  useEffect(() => {
    if (initialized) {
      fetchOrders();
    }
  }, [initialized, fetchOrders]);

  // Auto-refresh every 10 seconds (only when initialized)
  useEffect(() => {
    if (!initialized) return;
    
    const interval = setInterval(() => {
      console.log("[LocalOrderHistory] Auto-refreshing orders...");
      fetchOrders();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [initialized, fetchOrders]);

  const statusConfig: Record<
    string,
    { icon: React.ElementType; color: string; label: string }
  > = {
    pending: { icon: Clock, color: "text-yellow-600", label: "Pending" },
    syncing: { icon: Loader2, color: "text-blue-600", label: "Syncing" },
    synced: { icon: CheckCircle, color: "text-green-600", label: "Synced" },
    failed: { icon: AlertCircle, color: "text-red-600", label: "Failed" },
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Group orders by date
  const grouped = orders.reduce<Record<string, QueuedOrder[]>>((acc, order) => {
    const key = formatDate(order.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">Local Orders</h2>
          <Badge variant="secondary" className="text-xs">
            {orders.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchOrders}
          disabled={loading || !initialized}
          className="gap-1"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {!initialized ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Initializing...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8 text-red-500 gap-2">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            Retry
          </Button>
        </div>
      ) : loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <ShoppingCart className="w-10 h-10 opacity-40" />
          <p className="text-sm">No local orders yet</p>
          <p className="text-xs">Orders will appear here when saved locally</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-3">
            {Object.entries(grouped).map(([dateLabel, dateOrders]) => (
              <div key={dateLabel}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {dateLabel}
                </p>
                <div className="space-y-2">
                  {dateOrders.map((qo) => {
                    const cfg = statusConfig[qo.status] || statusConfig.pending;
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={qo.id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <StatusIcon
                              className={cn(
                                "w-4 h-4",
                                cfg.color,
                                qo.status === "syncing" && "animate-spin",
                              )}
                            />
                            <span className="text-sm font-medium text-foreground">
                              ₦{qo.order.total.toLocaleString()}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                cfg.color,
                              )}
                            >
                              {cfg.label}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(qo.createdAt)}
                          </span>
                        </div>

                        {/* Items summary */}
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {qo.order.items.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="truncate max-w-[180px]">
                                {item.quantity}× {item.name}
                              </span>
                              <span>
                                ₦{(item.price * item.quantity).toLocaleString()}
                              </span>
                            </div>
                          ))}
                          {qo.order.items.length > 3 && (
                            <p className="text-muted-foreground/60 italic">
                              +{qo.order.items.length - 3} more items
                            </p>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50">
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {qo.order.paymentMethod}
                          </span>
                          {qo.attempts > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {qo.attempts} attempt{qo.attempts > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {qo.errorMessage && (
                          <p className="text-[10px] text-red-500 mt-1 truncate">
                            {qo.errorMessage}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

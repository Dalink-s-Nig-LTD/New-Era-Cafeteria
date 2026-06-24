import React, { useEffect, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  ShoppingBag,
  Wallet,
  PiggyBank,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { getSqliteDB } from "@/lib/sqlite";
import { format } from "date-fns";

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
  category?: string;
  isCustom?: boolean;
};

type OrderType = {
  _id: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  status: string;
  orderType?: string;
  cashierCode: string;
  cashierName?: string;
  clientOrderId?: string;
  createdAt: number;
};

export function SuperAdminOrders() {
  const convex = useConvex();
  const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;

  // React state
  const [sqliteStats, setSqliteStats] = useState({
    totalAmount: 0,
    totalOrders: 0,
    totalWalletAmount: 0,
  });
  const [cachedCount, setCachedCount] = useState(0);
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [page, setPage] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 25;

  // Convex Queries
  const customerStats = useQuery(api.customers.getCustomersStats);

  // Load stats and paginated orders from SQLite
  const loadLocalData = async () => {
    if (!isDesktop) return;

    try {
      const sqlite = getSqliteDB();
      if (!sqlite) return;

      const [stats, count, pageOrders] = await Promise.all([
        sqlite.getSuperAdminOrderStats(),
        sqlite.getCachedOrdersCount(),
        sqlite.getCachedOrdersPaginated(ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
      ]);

      setSqliteStats(stats);
      setCachedCount(count);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setOrders(pageOrders as any);
    } catch (err) {
      console.error("Error loading SQLite data:", err);
      setError("Failed to load local data from SQLite database.");
    }
  };

  useEffect(() => {
    loadLocalData();
  }, [page, isSyncing]);

  // Sync loop to fetch 1000 orders per batch and write them to SQLite
  const handleSync = async () => {
    if (!isDesktop) {
      setError("Synchronization is only supported on the desktop application.");
      return;
    }

    const sqlite = getSqliteDB();
    if (!sqlite) {
      setError("SQLite is not available.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatus("Checking local database...");
    setError(null);

    try {
      // Find the last cached order's timestamp to perform an incremental sync
      const lastTimestamp = await sqlite.getLastCachedOrderTimestamp();
      const sinceTimestamp = lastTimestamp || 0;

      let cursor: string | undefined = undefined;
      let batchNum = 0;
      let syncedNewCount = 0;
      let hasMore = true;

      if (sinceTimestamp > 0) {
        setSyncStatus(`Syncing new orders since ${format(new Date(sinceTimestamp), "PPpp")}...`);
      } else {
        setSyncStatus("Starting full sync from Convex...");
      }

      while (hasMore) {
        batchNum++;
        setSyncStatus(
          sinceTimestamp > 0
            ? `Syncing batch ${batchNum} of new orders...`
            : `Fetching batch ${batchNum} (1000 orders per batch)...`
        );

        const result = await convex.query(
          api.getAllOrdersPaginated.getAllOrdersPaginated,
          {
            batchSize: 1000,
            cursor: cursor,
            sinceTimestamp: sinceTimestamp,
          }
        );

        if (!result || result.orders.length === 0) {
          break;
        }

        // Cache all orders in this batch to SQLite
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await sqlite.cacheOrdersBatch(result.orders as any);
        syncedNewCount += result.orders.length;

        // Force a UI update after each batch is cached to show real-time stats & counts
        await loadLocalData();

        // Update cursor values for the next batch
        cursor = result.nextCursor || undefined;
        hasMore = result.hasMore;
      }

      setSyncStatus(`Successfully fetched ${syncedNewCount} new orders!`);
      setSyncProgress(100);
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
        setSyncStatus("");
      }, 3000);
    } catch (err: any) {
      console.error("Fetch failed:", err);
      setError(`Fetch failed: ${err.message || err}`);
      setIsSyncing(false);
    }
  };

  const handleClearCache = async () => {
    if (!isDesktop) return;

    const confirmClear = window.confirm("Are you sure you want to clear the local orders cache?");
    if (!confirmClear) return;

    try {
      const sqlite = getSqliteDB();
      if (!sqlite) return;

      await sqlite.clearAllCachedOrders();

      setSqliteStats({
        totalAmount: 0,
        totalOrders: 0,
        totalWalletAmount: 0,
      });
      setCachedCount(0);
      setOrders([]);
      setPage(0);
      setSyncStatus("Cache cleared successfully!");

      setTimeout(() => {
        setSyncStatus("");
      }, 3000);
    } catch (err) {
      console.error("Failed to clear cache:", err);
      setError("Failed to clear local cache.");
    }
  };

  const totalPages = Math.ceil(cachedCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground font-display">
            Order Administration (Super Admin)
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage, sync, and view all orders cached in local SQLite database.
          </p>
        </div>

        {isDesktop && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClearCache}
              disabled={isSyncing}
              className="gap-2 shadow-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Clear Cache
            </Button>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2 shadow-sm font-semibold"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : cachedCount > 0 ? "Sync New Orders" : "Fetch All Orders"}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 text-red-800 p-4 rounded-lg flex items-center gap-2">
          <span className="font-semibold">Error:</span> {error}
        </Card>
      )}

      {isSyncing && (
        <Card className="border-border shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 animate-pulse text-primary" />
              {syncStatus}
            </span>
          </div>
          <Progress value={undefined} className="h-2" />
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Amount */}
        <Card className="border-border shadow-card hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground">
                  ₦{sqliteStats.totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className="border-border shadow-card hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1 font-medium">Total Orders</p>
                <p className="text-2xl font-bold text-foreground">
                  {sqliteStats.totalOrders.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/20">
                <ShoppingBag className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Amount Wallet */}
        <Card className="border-border shadow-card hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1 font-medium">Total Wallet Purchases</p>
                <p className="text-2xl font-bold text-foreground">
                  ₦{sqliteStats.totalWalletAmount.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/10">
                <Wallet className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers Funds */}
        <Card className="border-border shadow-card hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1 font-medium">Total Customer Funds</p>
                <p className="text-2xl font-bold text-foreground">
                  {customerStats && cachedCount > 0 ? `₦${customerStats.totalFunds.toLocaleString()}` : "₦0"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-500/10">
                <PiggyBank className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync stats footer */}
      <div className="text-xs text-muted-foreground flex items-center justify-between px-1 bg-card/30 p-2 rounded-lg border border-border/50">
        <span>SQLite Cache status: {cachedCount.toLocaleString()} orders fetched locally.</span>
      </div>

      {/* Orders Table */}
      <Card className="border-border shadow-card overflow-hidden">
        <Table>
          <TableHeader className="bg-card">
            <TableRow>
              <TableHead className="font-semibold text-foreground">Order ID</TableHead>
              <TableHead className="font-semibold text-foreground">Date & Time</TableHead>
              <TableHead className="font-semibold text-foreground">Cashier Code</TableHead>
              <TableHead className="font-semibold text-foreground">Payment Method</TableHead>
              <TableHead className="font-semibold text-foreground">Items</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                  No orders found. Please run "Fetch All Orders" to download orders cache.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order._id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground font-medium">
                    {order._id}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {format(new Date(order.createdAt), "PPpp")}
                  </TableCell>
                  <TableCell className="text-sm font-medium font-mono text-primary">
                    {order.cashierCode}
                  </TableCell>
                  <TableCell className="text-sm capitalize font-medium">
                    {order.paymentMethod === "customer_balance" ? (
                      <span className="text-success inline-flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Wallet
                      </span>
                    ) : (
                      order.paymentMethod
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-medium">
                    {order.items.map((it) => `${it.name} (x${it.quantity})`).join(", ")}
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold text-foreground">
                    ₦{order.total.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-card">
            <span className="text-xs text-muted-foreground font-medium">
              Showing page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

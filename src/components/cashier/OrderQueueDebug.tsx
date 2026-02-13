import React, { useEffect, useState } from "react";
import { orderQueue } from "@/lib/orderQueue";
import { sqliteDB } from "@/lib/sqlite";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Debug component to help diagnose local order storage issues
 * Add this temporarily to your CashierDashboard to see what's happening
 */
export function OrderQueueDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const runDiagnostics = async () => {
    setLoading(true);
    const info: any = {};

    // Check environment
    info.isBrowser = typeof window !== 'undefined';
    info.isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    info.sqliteDBExists = sqliteDB !== null;
    
    // Check orderQueue
    try {
      info.orderQueueExists = orderQueue !== null;
      
      // Try to initialize
      console.log("[Debug] Attempting to initialize orderQueue...");
      await orderQueue.init();
      info.initSuccessful = true;
      console.log("[Debug] OrderQueue initialized successfully");
      
      // Try to get all orders
      console.log("[Debug] Attempting to fetch all orders...");
      const allOrders = await orderQueue.getAllOrders();
      info.totalOrders = allOrders.length;
      info.orders = allOrders.map(o => ({
        id: o.id,
        status: o.status,
        total: o.order.total,
        createdAt: new Date(o.createdAt).toLocaleString(),
      }));
      console.log("[Debug] Fetched orders:", allOrders);
      
      // Get stats
      const stats = await orderQueue.getSyncStats();
      info.stats = stats;
      
      // Get queue count
      const count = await orderQueue.getQueueCount();
      info.queueCount = count;
      
    } catch (error) {
      info.error = error instanceof Error ? error.message : String(error);
      info.errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[Debug] Error during diagnostics:", error);
    }

    // Check SQLite directly if in Tauri
    if (info.isTauri && sqliteDB) {
      try {
        console.log("[Debug] Testing SQLite directly...");
        await sqliteDB.init();
        const sqliteOrders = await sqliteDB.getAllOrders();
        info.sqliteDirectOrders = sqliteOrders.length;
        console.log("[Debug] SQLite direct query returned:", sqliteOrders.length, "orders");
      } catch (error) {
        info.sqliteError = error instanceof Error ? error.message : String(error);
        console.error("[Debug] SQLite direct error:", error);
      }
    }

    setDebugInfo(info);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <Card className="p-4 max-w-2xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Order Queue Debug Info</h3>
          <Button size="sm" onClick={runDiagnostics} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Environment:</span>
            <Badge variant={debugInfo.isTauri ? "default" : "secondary"}>
              {debugInfo.isTauri ? "Tauri Desktop" : "Web Browser"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">SQLite DB Instance:</span>
            <Badge variant={debugInfo.sqliteDBExists ? "default" : "destructive"}>
              {debugInfo.sqliteDBExists ? "Exists" : "Null"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">OrderQueue Instance:</span>
            <Badge variant={debugInfo.orderQueueExists ? "default" : "destructive"}>
              {debugInfo.orderQueueExists ? "Exists" : "Null"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">Initialization:</span>
            <Badge variant={debugInfo.initSuccessful ? "default" : "destructive"}>
              {debugInfo.initSuccessful ? "Success" : "Failed"}
            </Badge>
          </div>

          {debugInfo.error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">
              <div className="font-medium">Error:</div>
              <div className="text-xs mt-1">{debugInfo.error}</div>
              {debugInfo.errorStack && (
                <pre className="text-xs mt-2 overflow-x-auto">
                  {debugInfo.errorStack}
                </pre>
              )}
            </div>
          )}

          {debugInfo.sqliteError && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded text-orange-700">
              <div className="font-medium">SQLite Direct Error:</div>
              <div className="text-xs mt-1">{debugInfo.sqliteError}</div>
            </div>
          )}

          <div className="border-t pt-2 mt-2">
            <div className="font-medium mb-2">Order Statistics:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Total Orders: <span className="font-bold">{debugInfo.totalOrders || 0}</span></div>
              <div>Queue Count: <span className="font-bold">{debugInfo.queueCount || 0}</span></div>
              {debugInfo.sqliteDirectOrders !== undefined && (
                <div>SQLite Direct: <span className="font-bold">{debugInfo.sqliteDirectOrders}</span></div>
              )}
            </div>
          </div>

          {debugInfo.stats && (
            <div className="border-t pt-2 mt-2">
              <div className="font-medium mb-2">Status Breakdown:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Pending: <span className="font-bold">{debugInfo.stats.pending}</span></div>
                <div>Syncing: <span className="font-bold">{debugInfo.stats.syncing}</span></div>
                <div>Synced: <span className="font-bold">{debugInfo.stats.synced}</span></div>
                <div>Failed: <span className="font-bold">{debugInfo.stats.failed}</span></div>
              </div>
            </div>
          )}

          {debugInfo.orders && debugInfo.orders.length > 0 && (
            <div className="border-t pt-2 mt-2">
              <div className="font-medium mb-2">Recent Orders:</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {debugInfo.orders.slice(0, 5).map((order: any, i: number) => (
                  <div key={i} className="text-xs p-2 bg-muted rounded flex justify-between">
                    <span className="truncate">{order.id}</span>
                    <Badge variant="outline" className="ml-2">{order.status}</Badge>
                    <span className="ml-2">₦{order.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-2 mt-3 text-xs text-muted-foreground">
          <strong>Instructions:</strong> Check the browser console (F12) for detailed logs.
          Look for messages starting with [Debug], [SQLiteDB], [OrderQueue], [CartContext], and [LocalOrderHistory].
        </div>
      </div>
    </Card>
  );
}

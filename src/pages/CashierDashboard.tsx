import React, { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { MenuGrid } from "@/components/cashier/MenuGrid";
import { Cart } from "@/components/cashier/Cart";
import {
  MobileCart,
  FloatingCartButton,
} from "@/components/cashier/MobileCart";
import { SyncStatus } from "@/components/cashier/SyncStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Calculator from "@/components/cashier/Calculator";
import { LocalOrderHistory } from "@/components/cashier/LocalOrderHistory";
import Modal from "@/components/ui/Modal";
import { useShiftSalesWithLocal } from "@/hooks/useShiftSalesWithLocal";


interface CashierDashboardProps {
  onLogout: () => void;
}

export function CashierDashboard({ onLogout }: CashierDashboardProps) {
  const isMobile = useIsMobile();
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [salesReportOpen, setSalesReportOpen] = useState(false);
  const { syncPendingOrders } = useCart();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [localHistoryOpen, setLocalHistoryOpen] = useState(false);
  
  const isTauri = "__TAURI__" in window;

  const { shiftSales, isLoading, hasLocalData, localOrderCount, unsyncedCount } = useShiftSalesWithLocal();

  // Access code breakdown is now directly from backend (already filtered by shift assignment)

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingOrders();
      if (result.total === 0) {
        toast({
          title: "No orders to sync",
          description: "All orders are already synced.",
        });
      } else {
        toast({
          title: "Sync complete",
          description: `${result.synced} orders synced, ${result.failed} failed out of ${result.total} total.`,
          variant: result.failed > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to sync orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleShiftClick = (shift: string) => {
    setSelectedShift(shift);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardHeader onLogout={onLogout}>
        <div className="flex items-center gap-3">
          <SyncStatus />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sync Orders
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCalculatorOpen((prev) => !prev)}
            className="gap-2"
          >
            Calculator
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSalesReportOpen((prev) => !prev)}
            className="gap-2"
          >
            Sales Report
          </Button>
          {isTauri && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocalHistoryOpen((prev) => !prev)}
              className="gap-2"
            >
              <Database className="w-4 h-4" />
              Local Orders
            </Button>
          )}
        </div>
      </DashboardHeader>

      <main className="flex-1 flex flex-row">
        {/* Menu Area */}
        <div className="flex-1 overflow-hidden p-4 sm:p-6">
          <MenuGrid />
        </div>

        {/* Current Order Sidebar */}
        {!isMobile && (
          <div className="w-80 lg:w-96 border-l border-border p-6 bg-card/50 hidden md:block">
            <Cart />
          </div>
        )}
      </main>

      {/* Calculator Modal */}
      <Modal isOpen={calculatorOpen} onClose={() => setCalculatorOpen(false)}>
        <Calculator />
      </Modal>

      {/* Sales Report Modal */}
      <Modal isOpen={salesReportOpen} onClose={() => setSalesReportOpen(false)}>
        <div className="p-6 bg-card rounded-lg shadow-lg w-full max-w-3xl mx-auto max-h-[80vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 text-center text-foreground">
            Sales Report
          </h2>
          {isLoading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-4">
              {/* Local data indicator */}
              {hasLocalData && (
                unsyncedCount > 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
                    <Database className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Includes <strong>{unsyncedCount}</strong> unsynced local order{unsyncedCount !== 1 ? "s" : ""} from SQLite
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      All <strong>{localOrderCount}</strong> local order{localOrderCount !== 1 ? "s" : ""} synced successfully
                    </span>
                  </div>
                )
              )}
              {/* Morning Shift - only show if has orders */}
              {shiftSales?.morning && shiftSales.morning.orderCount > 0 && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-xl text-foreground mb-2">
                  Morning Shift
                </h3>
                <p className="text-muted-foreground">
                  Total Sales:{" "}
                  <span className="font-bold text-foreground">
                    ₦{shiftSales.morning.totalSales?.toLocaleString() || 0}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Orders:{" "}
                  <span className="font-bold text-foreground">
                    {shiftSales.morning.orderCount || 0}
                  </span>
                </p>
                {shiftSales.morning.byAccessCode &&
                  Object.keys(shiftSales.morning.byAccessCode).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        By Access Code:
                      </p>
                      <div className="space-y-1">
                        {Object.entries(shiftSales.morning.byAccessCode).map(
                          ([code, data]) => (
                            <div
                              key={code}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-muted-foreground">{code}</span>
                              <span className="text-foreground font-medium">
                                ₦{data.totalSales.toLocaleString()} (
                                {data.orderCount} orders)
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
              )}

              {/* Afternoon Shift - only show if has orders */}
              {shiftSales?.afternoon && shiftSales.afternoon.orderCount > 0 && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-xl text-foreground mb-2">
                  Afternoon Shift
                </h3>
                <p className="text-muted-foreground">
                  Total Sales:{" "}
                  <span className="font-bold text-foreground">
                    ₦{shiftSales.afternoon.totalSales?.toLocaleString() || 0}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Orders:{" "}
                  <span className="font-bold text-foreground">
                    {shiftSales.afternoon.orderCount || 0}
                  </span>
                </p>
                {shiftSales.afternoon.byAccessCode &&
                  Object.keys(shiftSales.afternoon.byAccessCode).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        By Access Code:
                      </p>
                      <div className="space-y-1">
                        {Object.entries(shiftSales.afternoon.byAccessCode).map(
                          ([code, data]) => (
                            <div
                              key={code}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-muted-foreground">{code}</span>
                              <span className="text-foreground font-medium">
                                ₦{data.totalSales.toLocaleString()} (
                                {data.orderCount} orders)
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
              )}

              {/* Evening Shift - only show if has orders */}
              {shiftSales?.evening && shiftSales.evening.orderCount > 0 && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-xl text-foreground mb-2">
                  Evening Shift
                </h3>
                <p className="text-muted-foreground">
                  Total Sales:{" "}
                  <span className="font-bold text-foreground">
                    ₦{shiftSales.evening.totalSales?.toLocaleString() || 0}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Orders:{" "}
                  <span className="font-bold text-foreground">
                    {shiftSales.evening.orderCount || 0}
                  </span>
                </p>
                {shiftSales.evening.byAccessCode &&
                  Object.keys(shiftSales.evening.byAccessCode).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        By Access Code:
                      </p>
                      <div className="space-y-1">
                        {Object.entries(shiftSales.evening.byAccessCode).map(
                          ([code, data]) => (
                            <div
                              key={code}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-muted-foreground">{code}</span>
                              <span className="text-foreground font-medium">
                                ₦{data.totalSales.toLocaleString()} (
                                {data.orderCount} orders)
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
              )}

              {/* Unassigned (codes without shift) */}
              {shiftSales?.unassigned &&
                shiftSales.unassigned.orderCount > 0 && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h3 className="font-semibold text-xl text-foreground mb-2">
                      Unassigned Shift
                    </h3>
                    <p className="text-muted-foreground">
                      Total Sales:{" "}
                      <span className="font-bold text-foreground">
                        ₦{shiftSales.unassigned.totalSales?.toLocaleString() || 0}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Orders:{" "}
                      <span className="font-bold text-foreground">
                        {shiftSales.unassigned.orderCount || 0}
                      </span>
                    </p>
                    {Object.keys(shiftSales.unassigned.byAccessCode).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          By Access Code:
                        </p>
                        <div className="space-y-1">
                          {Object.entries(shiftSales.unassigned.byAccessCode).map(
                            ([code, data]) => (
                              <div
                                key={code}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-muted-foreground">{code}</span>
                                <span className="text-foreground font-medium">
                                  ₦{data.totalSales.toLocaleString()} (
                                  {data.orderCount} orders)
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </Modal>


      {/* Local Order History Modal */}
      <Modal isOpen={localHistoryOpen} onClose={() => setLocalHistoryOpen(false)}>
        <div className="p-6 bg-card rounded-lg shadow-lg w-full max-w-lg mx-auto">
          <LocalOrderHistory />
        </div>
      </Modal>

      {/* Mobile Cart */}
      {isMobile && (
        <>
          <FloatingCartButton onClick={() => setMobileCartOpen(true)} />
          <MobileCart
            isOpen={mobileCartOpen}
            onOpenChange={setMobileCartOpen}
          />
        </>
      )}
    </div>
  );
}

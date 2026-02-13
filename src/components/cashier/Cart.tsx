import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  FileDown,
  Loader2,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { ReceiptModal } from "./ReceiptModal";
import { SpecialOrderReceipt } from "./SpecialOrderReceipt";
import { Order } from "@/types/cafeteria";

export function Cart() {
  const {
    items,
    total,
    itemCount,
    updateQuantity,
    removeItem,
    clearCart,
    completeOrder,
    addItem,
    downloadDailySalesPDF,
    isProcessingOrder,
  } = useCart();
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  // Special order checkout state
  const [specialOrderCheckout, setSpecialOrderCheckout] = useState(false);
  const [specialOrderPaymentMethod, setSpecialOrderPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");

  // State for custom entry
  const [customCategory, setCustomCategory] = useState<"food" | "drinks" | "">(
    "",
  );
  const [customAmount, setCustomAmount] = useState("");
  const [customName, setCustomName] = useState("");

  const handleAddCustom = () => {
    if (!customCategory || !customAmount || isNaN(Number(customAmount))) return;
    addItem({
      id: `custom-${Date.now()}`,
      name:
        customName ||
        (customCategory === "food" ? "Custom Food" : "Custom Drink"),
      price: Number(customAmount),
      category: customCategory,
      available: true,
    });
    setCustomAmount("");
    setCustomName("");
    setCustomCategory("");
  };

  const handlePayment = (method: "cash" | "card" | "transfer") => {
    if (isProcessingOrder) return;

    // Check if any cart items are special orders
    const hasSpecialItems = items.some(
      (item) => item.category === "Special Orders"
    );

    if (hasSpecialItems) {
      // Redirect to SpecialOrderReceipt instead of normal checkout
      setSpecialOrderPaymentMethod(method);
      setSpecialOrderCheckout(true);
      return;
    }

    const order = completeOrder(method);
    if (order) {
      setLastOrder(order);
      setShowReceipt(true);
    }
  };

  const handleSpecialOrderCompleted = () => {
    setSpecialOrderCheckout(false);
  };

  return (
    <>
      <Card
        className="h-full flex flex-col border-border shadow-card bg-white"
        style={{ minWidth: 340, maxWidth: 400, margin: "0 auto" }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-display">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Current Order
            {itemCount > 0 && (
              <span className="ml-auto bg-primary text-primary-foreground text-xs font-sans font-semibold px-2 py-1 rounded-full">
                {itemCount} items
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 pt-0">
          {/* Daily Reports Section */}
          <div className="mb-4">
            <div className="text-xs font-semibold mb-2 text-muted-foreground">
              Daily Report
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Button
                onClick={() => downloadDailySalesPDF("morning")}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Morning
              </Button>
              <Button
                onClick={() => downloadDailySalesPDF("afternoon")}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Afternoon
              </Button>
              <Button
                onClick={() => downloadDailySalesPDF("evening")}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Evening
              </Button>
              <Button
                onClick={() => downloadDailySalesPDF("all")}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Full Day
              </Button>
            </div>
          </div>

          {/* Custom Amount Entry */}
          <div className="mb-4 p-3 border rounded-lg bg-secondary/30">
            <div className="mb-2 font-semibold">Add Custom Item</div>
            <div className="flex flex-col gap-2 mb-2">
              <select
                value={customCategory}
                onChange={(e) =>
                  setCustomCategory(e.target.value as "food" | "drinks" | "")
                }
                className="border rounded px-3 py-2 w-full"
                autoFocus={false}
              >
                <option value="">Select Category</option>
                <option value="food">Food (Custom)</option>
                <option value="drinks">Drinks (Custom)</option>
              </select>
              <input
                type="number"
                placeholder="Price"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                min="0"
                autoFocus={false}
              />
              <Button
                className="w-full"
                onClick={handleAddCustom}
                disabled={!customCategory || !customAmount}
              >
                Add to Order
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              You can add custom food or drink amounts for quick entry.
            </div>
          </div>
          {/* Cart items */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Tap items to add them</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-sm text-primary font-semibold">
                          ₦{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                        >
                          <Minus className="w-3 h-3" />
                        </Button>

                        <span className="w-6 text-center font-semibold text-sm">
                          {item.quantity}
                        </span>

                        <Button
                          variant="outline"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                        >
                          <Plus className="w-3 h-3" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">
                    ₦{total.toLocaleString()}
                  </span>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-lg">Total</span>
                  <span className="font-bold text-xl text-primary">
                    ₦{total.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2">
                  {items.some((item) => item.category === "Special Orders") ? (
                    <Button
                      onClick={() => {
                        setSpecialOrderPaymentMethod("cash");
                        setSpecialOrderCheckout(true);
                      }}
                      className="w-full h-auto py-3 bg-primary hover:bg-primary/90"
                      disabled={isProcessingOrder}
                    >
                      {isProcessingOrder ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Receipt className="w-5 h-5 mr-2" />
                      )}
                      <span>Checkout Special Order</span>
                    </Button>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        onClick={() => handlePayment("cash")}
                        className="flex-col h-auto py-3 bg-success hover:bg-success/90"
                        disabled={isProcessingOrder}
                      >
                        {isProcessingOrder ? (
                          <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                        ) : (
                          <Banknote className="w-5 h-5 mb-1" />
                        )}
                        <span className="text-xs">Cash</span>
                      </Button>
                      <Button
                        onClick={() => handlePayment("card")}
                        className="flex-col h-auto py-3"
                        disabled={isProcessingOrder}
                      >
                        {isProcessingOrder ? (
                          <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                        ) : (
                          <CreditCard className="w-5 h-5 mb-1" />
                        )}
                        <span className="text-xs">Card</span>
                      </Button>
                      <Button
                        onClick={() => handlePayment("transfer")}
                        variant="secondary"
                        className="flex-col h-auto py-3"
                        disabled={isProcessingOrder}
                      >
                        {isProcessingOrder ? (
                          <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                        ) : (
                          <Smartphone className="w-5 h-5 mb-1" />
                        )}
                        <span className="text-xs">Transfer</span>
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={clearCart}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Cart
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ReceiptModal
        order={lastOrder}
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
      />

      <SpecialOrderReceipt
        isOpen={specialOrderCheckout}
        onClose={() => setSpecialOrderCheckout(false)}
        cartItems={items.filter((item) => item.category === "Special Orders")}
        cartTotal={total}
        paymentMethod={specialOrderPaymentMethod}
        onOrderCompleted={handleSpecialOrderCompleted}
      />
    </>
  );
}

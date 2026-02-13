import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, X } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { ReceiptModal } from './ReceiptModal';
import { Order } from '@/types/cafeteria';

interface MobileCartProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileCart({ isOpen, onOpenChange }: MobileCartProps) {
  const { items, total, itemCount, updateQuantity, removeItem, clearCart, completeOrder } = useCart();
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const handlePayment = (method: 'cash' | 'card' | 'transfer') => {
    const order = completeOrder(method);
    setLastOrder(order);
    setShowReceipt(true);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
          <SheetHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-lg font-display">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Current Order
                {itemCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-sans font-semibold px-2 py-1 rounded-full">
                    {itemCount}
                  </span>
                )}
              </SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex flex-col h-full p-4 pt-2">
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Cart is empty</p>
                <p className="text-sm">Tap items to add them</p>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 -mx-4 px-4">
                  <div className="space-y-3 pb-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {item.name}
                          </p>
                          <p className="text-primary font-semibold">
                            ₦{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-10 h-10"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          
                          <span className="w-8 text-center font-semibold text-lg">
                            {item.quantity}
                          </span>
                          
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-10 h-10"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-10 h-10 text-destructive hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="pt-4 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="font-bold text-2xl text-primary">
                      ₦{total.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      onClick={() => handlePayment('cash')}
                      className="flex-col h-auto py-4 bg-success hover:bg-success/90"
                    >
                      <Banknote className="w-6 h-6 mb-1" />
                      <span>Cash</span>
                    </Button>
                    <Button
                      onClick={() => handlePayment('card')}
                      className="flex-col h-auto py-4"
                    >
                      <CreditCard className="w-6 h-6 mb-1" />
                      <span>Card</span>
                    </Button>
                    <Button
                      onClick={() => handlePayment('transfer')}
                      variant="secondary"
                      className="flex-col h-auto py-4"
                    >
                      <Smartphone className="w-6 h-6 mb-1" />
                      <span>Transfer</span>
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={clearCart}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Cart
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ReceiptModal
        order={lastOrder}
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
      />
    </>
  );
}

// Floating Cart Button for Mobile
export function FloatingCartButton({ onClick }: { onClick: () => void }) {
  const { itemCount, total } = useCart();

  if (itemCount === 0) return null;

  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 h-14 px-6 rounded-full shadow-lg gap-3 z-50"
    >
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {itemCount}
        </span>
      </div>
      <span className="font-semibold">₦{total.toLocaleString()}</span>
    </Button>
  );
}

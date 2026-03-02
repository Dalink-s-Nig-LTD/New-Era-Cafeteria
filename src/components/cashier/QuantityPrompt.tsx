import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MenuItem } from "@/types/cafeteria";

interface QuantityPromptProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: MenuItem, quantity: number) => void;
}

export function QuantityPrompt({ item, isOpen, onClose, onConfirm }: QuantityPromptProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (item && quantity > 0) {
      onConfirm(item, quantity);
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" aria-describedby="qty-desc">
        <DialogHeader>
          <DialogTitle>How many packs?</DialogTitle>
        </DialogHeader>
        <span id="qty-desc" className="sr-only">Enter quantity for {item.name}</span>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <p className="font-semibold text-lg">{item.name}</p>
            <p className="text-muted-foreground">₦{item.price.toLocaleString()} per pack</p>
          </div>
          <div>
            <Label htmlFor="qty">Quantity (packs)</Label>
            <Input
              ref={inputRef}
              id="qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="p-3 rounded-lg bg-muted text-center">
            <span className="text-sm text-muted-foreground">Total: </span>
            <span className="text-lg font-bold">₦{(item.price * quantity).toLocaleString()}</span>
          </div>
          <Button type="submit" className="w-full" disabled={quantity < 1}>
            Add to Cart
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Id } from "../../../convex/_generated/dataModel";

interface FundTopUpProps {
  customer: {
    _id: Id<"customers">;
    firstName: string;
    lastName: string;
    balance: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESETS = [500, 1000, 2000, 5000];

export function FundTopUp({ customer, open, onOpenChange }: FundTopUpProps) {
  const { toast } = useToast();
  const { code: authCode } = useAuth();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Fund top-up by manager");
  const [loading, setLoading] = useState(false);
  const addFunds = useMutation(api.customerFunds.addFunds);

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async () => {
    if (numAmount <= 0) return;
    setLoading(true);
    try {
      const result = await addFunds({
        customerId: customer._id,
        amount: numAmount,
        description,
        addedBy: authCode || "manager",
      });
      toast({
        title: "Funds added",
        description: `New balance: ₦${result.balanceAfter.toLocaleString()}`,
      });
      onOpenChange(false);
      setAmount("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add Funds — {customer.firstName} {customer.lastName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            Current Balance:{" "}
            <span className="font-bold text-foreground">
              ₦{customer.balance.toLocaleString()}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                onClick={() => setAmount(String(p))}
              >
                ₦{p.toLocaleString()}
              </Button>
            ))}
          </div>

          <Input
            type="number"
            placeholder="Amount (₦)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            placeholder="Description / Reference"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {numAmount > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Before:</span>
                <span>₦{customer.balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-primary font-bold">
                <span>After:</span>
                <span>₦{(customer.balance + numAmount).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={numAmount <= 0 || loading}>
            {loading ? "Processing..." : `Add ₦${numAmount.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Wallet, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BalanceCard } from "./BalanceCard";
import type { CustomerRecord } from "@/types/cafeteria";

interface CustomerWalletProps {
  customer: CustomerRecord;
}

export function CustomerWallet({ customer }: CustomerWalletProps) {
  const presets = [500, 1000, 2000, 5000];

  return (
    <div className="flex flex-col items-center gap-6 pb-24 px-4">
      <div className="w-full max-w-xs">
        <BalanceCard customer={customer} />
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
            <Wallet className="w-5 h-5 text-primary" /> Top-Up Options
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {presets.map((amt) => (
              <button
                key={amt}
                className="rounded-xl border border-border bg-muted/50 py-3 text-center font-bold text-foreground hover:ring-2 ring-primary transition-all"
              >
                ₦{amt.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-2 bg-muted/60 rounded-lg p-3">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              To top up your balance, please visit the cafeteria counter or contact a manager. Online top-ups are coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

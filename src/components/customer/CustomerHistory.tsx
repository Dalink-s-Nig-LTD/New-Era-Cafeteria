import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BalanceCard } from "./BalanceCard";
import type { CustomerRecord } from "@/types/cafeteria";

interface CustomerHistoryProps {
  customer: CustomerRecord;
}

export function CustomerHistory({ customer }: CustomerHistoryProps) {
  const transactions = useQuery(api.customerFunds.getTransactionHistory, {
    customerId: customer._id,
    limit: 50,
  });

  return (
    <div className="flex flex-col items-center gap-6 pb-24 px-4">
      <div className="w-full max-w-xs">
        <BalanceCard customer={customer} />
      </div>

      <div className="w-full max-w-sm">
        <h3 className="font-semibold text-foreground mb-3 text-base">Recent Transactions</h3>

        {transactions === undefined ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">No transactions yet.</p>
        ) : (
          <ScrollArea className="h-[50vh]">
            <div className="space-y-2 pr-2">
              {transactions.map((tx) => {
                const isCredit = tx.type === "credit";
                return (
                  <div
                    key={tx._id}
                    className="flex items-center gap-3 rounded-xl bg-card border border-border p-3"
                  >
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                        isCredit
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(tx.createdAt), "dd MMM yyyy, h:mm a")}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {isCredit ? "+" : "-"}₦{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Bal: ₦{tx.balanceAfter.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

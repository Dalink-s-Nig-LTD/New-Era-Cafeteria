import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, CreditCard, Banknote, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
  transfer: Smartphone,
};

export function RecentOrders() {
  const recentOrders = useQuery(api.orders.getRecentOrders, { limit: 5 });

  console.log("RecentOrders - Data:", recentOrders);

  if (!recentOrders) {
    return (
      <Card className="border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Clock className="w-5 h-5 text-primary" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentOrders.length === 0) {
    return (
      <Card className="border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Clock className="w-5 h-5 text-primary" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground text-sm">No orders yet</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clock className="w-5 h-5 text-primary" />
          Recent Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[480px] pr-4">
          <div className="space-y-3">
            {recentOrders.map((order) => {
              const PaymentIcon = paymentIcons[order.paymentMethod];

              return (
                <div
                  key={order._id}
                  className="p-4 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {order._id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(order.createdAt, {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 capitalize"
                    >
                      <PaymentIcon className="w-3 h-3" />
                      {order.paymentMethod}
                    </Badge>
                  </div>

                  <div className="space-y-1 mb-3">
                    {order.items.map((item, idx) => (
                      <p
                        key={`${item.menuItemId}-${idx}`}
                        className="text-xs text-muted-foreground"
                      >
                        {item.quantity}x {item.name}
                      </p>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="font-bold text-primary">
                      ₦{order.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

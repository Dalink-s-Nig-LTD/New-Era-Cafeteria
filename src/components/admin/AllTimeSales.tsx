import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingBag, DollarSign, Users } from "lucide-react";

export function AllTimeSales() {
  const data = useQuery((api as any).getAllTimeSales.getAllTimeSales);

  if (!data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border shadow-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-secondary rounded w-20 mb-2"></div>
                <div className="h-8 bg-secondary rounded w-24"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: "All-Time Revenue",
      value: `₦${data.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "primary",
    },
    {
      title: "All-Time Orders",
      value: data.totalOrders.toLocaleString(),
      icon: ShoppingBag,
      color: "accent",
    },
    {
      title: "Customers Served",
      value: data.totalCustomers.toLocaleString(),
      icon: Users,
      color: "navy",
    },
    {
      title: "Avg. Order Value",
      value: `₦${data.avgOrderValue.toLocaleString()}`,
      icon: TrendingUp,
      color: "success",
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">All-Time Sales Summary</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border shadow-card hover:shadow-card-hover transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      stat.color === "primary" ? "bg-primary/10" :
                      stat.color === "accent" ? "bg-accent/20" :
                      stat.color === "navy" ? "bg-navy/10" :
                      "bg-success/10"
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 ${
                        stat.color === "primary" ? "text-primary" :
                        stat.color === "accent" ? "text-accent" :
                        stat.color === "navy" ? "text-navy" :
                        "text-success"
                      }`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

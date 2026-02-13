import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ShoppingBag, DollarSign, Users } from "lucide-react";

export function StatsCards() {
  const stats = useQuery(api.orders.getOrdersStats);

  console.log("StatsCards - Data:", stats);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border shadow-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-secondary rounded w-20 mb-2"></div>
                <div className="h-8 bg-secondary rounded w-24 mb-1"></div>
                <div className="h-3 bg-secondary rounded w-16"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: "Weekly Revenue",
      value: `₦${stats.totalRevenue.toLocaleString()}`,
      change: stats.revenueChange,
      trend: "up",
      icon: DollarSign,
      color: "primary",
    },
    {
      title: "Weekly Orders",
      value: stats.totalOrders.toString(),
      change: stats.ordersChange,
      trend: "up",
      icon: ShoppingBag,
      color: "accent",
    },
    {
      title: "Avg. Order Value",
      value: `₦${stats.avgOrderValue.toLocaleString()}`,
      change: stats.avgChange,
      trend: "up",
      icon: TrendingUp,
      color: "success",
    },
    {
      title: "Daily Customers",
      value: stats.dailyCustomers.toString(),
      change: stats.dailyChange,
      trend: "up",
      icon: Users,
      color: "navy",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsData.map((stat) => {
        const Icon = stat.icon;

        return (
          <Card
            key={stat.title}
            className="border-border shadow-card hover:shadow-card-hover transition-shadow"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {stat.change} from last week
                  </p>
                </div>
                <div
                  className={`
                  w-12 h-12 rounded-xl flex items-center justify-center
                  ${stat.color === "primary" ? "bg-primary/10" : ""}
                  ${stat.color === "accent" ? "bg-accent/20" : ""}
                  ${stat.color === "success" ? "bg-success/10" : ""}
                  ${stat.color === "navy" ? "bg-navy/10" : ""}
                `}
                >
                  <Icon
                    className={`
                    w-6 h-6
                    ${stat.color === "primary" ? "text-primary" : ""}
                    ${stat.color === "accent" ? "text-accent" : ""}
                    ${stat.color === "success" ? "text-success" : ""}
                    ${stat.color === "navy" ? "text-navy" : ""}
                  `}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

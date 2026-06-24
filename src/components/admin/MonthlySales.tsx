import React, { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Calculator } from "lucide-react";
import { getSqliteDB } from "@/lib/sqlite";

type DaySales = {
  day: number;
  date: string;
  revenue: number;
  orders: number;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function MonthlySales() {
  const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;
  
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());
  
  const [localData, setLocalData] = useState<DaySales[] | null>(null);
  const [localLoading, setLocalLoading] = useState(isDesktop);

  // Convex Query
  const remoteData = useQuery(api.orders.getMonthlySales, {
    year,
    month,
  });

  useEffect(() => {
    if (!isDesktop) return;

    const loadLocalData = async () => {
      try {
        const sqlite = getSqliteDB();
        if (!sqlite) {
          setLocalLoading(false);
          return;
        }

        const orders = await sqlite.getCachedOrders();
        
        // Filter orders for the selected month and year
        const nonSpecialOrders = orders.filter((order) => {
          if ((order.orderType || "regular") === "special") return false;
          const date = new Date(order.createdAt);
          return date.getFullYear() === year && date.getMonth() === month;
        });

        // Group by day of month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const salesByDay: Record<number, { revenue: number; orders: number }> = {};
        for (let d = 1; d <= daysInMonth; d++) {
          salesByDay[d] = { revenue: 0, orders: 0 };
        }

        nonSpecialOrders.forEach((order) => {
          const day = new Date(order.createdAt).getDate();
          if (salesByDay[day]) {
            salesByDay[day].revenue += order.total;
            salesByDay[day].orders += 1;
          }
        });

        const result: DaySales[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          result.push({
            day: d,
            date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
            revenue: salesByDay[d].revenue,
            orders: salesByDay[d].orders,
          });
        }

        setLocalData(result);
      } catch (error) {
        console.error("Failed to load local monthly sales:", error);
      } finally {
        setLocalLoading(false);
      }
    };

    setLocalLoading(true);
    loadLocalData();
  }, [isDesktop, year, month]);

  const data = isDesktop
    ? (localData ?? remoteData ?? null)
    : (remoteData ?? null);

  const isLoading = isDesktop
    ? localLoading && remoteData === undefined && !localData
    : remoteData === undefined;

  // Calculate overall metrics
  const totalRevenue = data ? data.reduce((sum, item) => sum + item.revenue, 0) : 0;
  const totalOrders = data ? data.reduce((sum, item) => sum + item.orders, 0) : 0;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-semibold text-foreground font-display">Monthly Sales Overview</h3>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-secondary animate-pulse rounded-md"></div>
            <div className="h-10 w-24 bg-secondary animate-pulse rounded-md"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border shadow-card">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-secondary rounded w-20"></div>
                  <div className="h-8 bg-secondary rounded w-32"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-border shadow-card p-6 h-[400px] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading monthly data...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-xl font-semibold text-foreground font-display">
          Sales for {MONTHS[month]} {year}
        </h3>
        
        <div className="flex gap-2 items-center">
          <Select
            value={String(month)}
            onValueChange={(val) => setMonth(Number(val))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, idx) => (
                <SelectItem key={m} value={String(idx)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(year)}
            onValueChange={(val) => setYear(Number(val))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monthly Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border shadow-card hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1 font-medium">Monthly Revenue</p>
                <p className="text-3xl font-bold text-foreground">
                  ₦{totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-card hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1 font-medium">Monthly Orders</p>
                <p className="text-3xl font-bold text-foreground">
                  {totalOrders.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/20">
                <ShoppingBag className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-card hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1 font-medium">Avg. Order Value</p>
                <p className="text-3xl font-bold text-foreground">
                  ₦{avgOrderValue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/10">
                <Calculator className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Chart Card */}
      <Card className="border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
            <TrendingUp className="w-5 h-5 text-primary" />
            Daily Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorMonthlyRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(221, 83%, 53%)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(221, 83%, 53%)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(220, 13%, 91%)"
                />
                <XAxis
                  dataKey="day"
                  stroke="hsl(220, 9%, 46%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Day of Month', position: 'insideBottom', offset: -5, fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                />
                <YAxis
                  stroke="hsl(220, 9%, 46%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₦${value >= 1000 ? (value / 1000) + 'k' : value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  labelFormatter={(label) => `Day ${label}`}
                  formatter={(value: number) => [
                    `₦${value.toLocaleString()}`,
                    "Revenue",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMonthlyRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

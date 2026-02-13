import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { PieChartIcon } from "lucide-react";

const COLORS = [
  "hsl(221, 83%, 53%)", // Primary blue
  "hsl(43, 96%, 56%)", // Gold
  "hsl(142, 76%, 36%)", // Success green
  "hsl(0, 84%, 60%)", // Red
  "hsl(280, 65%, 60%)", // Purple
  "hsl(190, 80%, 45%)", // Cyan
];

export function CategoryChart() {
  const categorySales = useQuery(api.orders.getCategorySales);

  if (!categorySales || categorySales.length === 0) {
    return (
      <Card className="border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <PieChartIcon className="w-5 h-5 text-accent" />
            Sales by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground text-sm">
              {categorySales === undefined ? "Loading..." : "No sales data yet"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <PieChartIcon className="w-5 h-5 text-accent" />
          Sales by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categorySales}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="amount"
                nameKey="category"
              >
                {categorySales.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 13%, 91%)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [
                  `₦${value.toLocaleString()}`,
                  "Sales",
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

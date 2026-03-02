import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ShoppingCart, Utensils, Coffee, CalendarIcon, Sun } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function TodayOrders() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateStart = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  ).getTime();
  const dateEnd = dateStart + 24 * 60 * 60 * 1000;

  const data = useQuery((api as any).checkOrdersByDate.checkOrdersByDate, {
    dateStart,
    dateEnd,
  });

  const isToday =
    selectedDate.toDateString() === new Date().toDateString();

  const label = isToday ? "Today's Orders" : `Orders for ${format(selectedDate, "PPP")}`;

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-foreground">{label}</h3>
          <DatePicker date={selectedDate} onSelect={setSelectedDate} />
        </div>
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
      </div>
    );
  }

  const stats = [
    {
      title: isToday ? "Today's Total" : "Day Total",
      value: `₦${data.allDayTotal.toLocaleString()}`,
      subtitle: `${data.totalOrders} orders`,
      icon: CalendarDays,
      color: "primary",
      byAccessCode: (data as any).allDayByAccessCode || null,
    },
    {
      title: "Morning Shift",
      value: `₦${data.morningShift.grandTotal.toLocaleString()}`,
      subtitle: `${data.morningShift.count} orders`,
      icon: Coffee,
      color: "accent",
      byAccessCode: (data.morningShift as any).byAccessCode || null,
    },
    {
      title: "Afternoon Shift",
      value: `₦${data.afternoonShift.grandTotal.toLocaleString()}`,
      subtitle: `${data.afternoonShift.count} orders`,
      icon: Sun,
      color: "warning",
      byAccessCode: (data.afternoonShift as any).byAccessCode || null,
    },
    {
      title: "Evening Shift",
      value: `₦${data.eveningShift.grandTotal.toLocaleString()}`,
      subtitle: `${data.eveningShift.count} orders`,
      icon: Utensils,
      color: "success",
      byAccessCode: (data.eveningShift as any).byAccessCode || null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-foreground">{label}</h3>
        <DatePicker date={selectedDate} onSelect={setSelectedDate} />
      </div>
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
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      stat.color === "primary" ? "bg-primary/10" :
                      stat.color === "accent" ? "bg-accent/20" :
                      stat.color === "success" ? "bg-success/10" :
                      "bg-orange-500/10"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        stat.color === "primary" ? "text-primary" :
                        stat.color === "accent" ? "text-accent" :
                        stat.color === "success" ? "text-success" :
                        "text-orange-500"
                      }`}
                    />
                  </div>
                </div>
                {stat.byAccessCode && Object.keys(stat.byAccessCode).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    {Object.entries(stat.byAccessCode)
                      .sort(([, a], [, b]) => (b as any).total - (a as any).total)
                      .map(([code, info]) => {
                        const data = info as { total: number; orderCount: number };
                        return (
                          <div key={code} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">{code}</span>
                            <span className="text-foreground font-semibold">₦{data.total.toLocaleString()} <span className="text-muted-foreground font-normal">({data.orderCount})</span></span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DatePicker({ date, onSelect }: { date: Date; onSelect: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[200px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(date, "PPP")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onSelect(d)}
          disabled={(d) => d > new Date()}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

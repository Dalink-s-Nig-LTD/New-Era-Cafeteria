import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SpecialOrdersReport() {
  const [timeFilter, setTimeFilter] = useState<
    "today" | "week" | "month" | "all"
  >("today");

  const specialDeliveries = useQuery(api.specialOrders.getSpecialOrders);

  // Filter special deliveries based on time
  const getFilteredOrders = () => {
    if (!specialDeliveries) return [];

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return specialDeliveries.filter((order) => {
      if (timeFilter === "today") return order.createdAt >= oneDayAgo;
      if (timeFilter === "week") return order.createdAt >= oneWeekAgo;
      if (timeFilter === "month") return order.createdAt >= oneMonthAgo;
      return true;
    });
  };

  const specialOrders = getFilteredOrders();

  // Calculate stats
  const totalRevenue = specialOrders.reduce(
    (sum, order) => sum + order.total,
    0,
  );
  const totalOrders = specialOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Payment status stats from filtered orders
  const paidCount = specialOrders.filter((d) => d.paymentStatus === "paid").length;
  const pendingCount = specialOrders.filter((d) => d.paymentStatus === "pending").length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Special Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{Math.round(averageOrderValue).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-600" />
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Special Orders History
              </CardTitle>
              <CardDescription>
                View all special orders placed through the cashier system
              </CardDescription>
            </div>
            <Select
              value={timeFilter}
              onValueChange={(value) =>
                setTimeFilter(value as "today" | "week" | "month" | "all")
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specialOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No special orders found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  specialOrders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell className="font-mono text-xs">
                        {String(order._id).slice(-8).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{order.department}</TableCell>
                      <TableCell>{order.staffName}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.itemDescription}
                          <div className="text-xs text-muted-foreground">
                            Qty: {order.quantity} × ₦{order.pricePerPack.toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.paymentStatus === "paid" ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            Paid
                          </Badge>
                        ) : order.paymentStatus === "pending" ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="secondary">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {order.cashierCode}
                      </TableCell>
                      <TableCell className="font-bold">
                        ₦{order.total.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

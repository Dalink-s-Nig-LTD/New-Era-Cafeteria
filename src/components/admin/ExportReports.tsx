import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileText,
  Download,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  TrendingUp,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ReportType = "sales" | "orders" | "inventory" | "users";
type ExportFormat = "pdf" | "csv" | "excel";
type SalesFormat = "detailed" | "receipt";

interface ReportOption {
  id: ReportType;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const reportOptions: ReportOption[] = [
  {
    id: "sales",
    name: "Sales Report",
    description: "Revenue and transaction data",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    id: "orders",
    name: "Orders Report",
    description: "All orders with details",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "inventory",
    name: "Inventory Report",
    description: "Stock levels and menu items",
    icon: <FileSpreadsheet className="w-5 h-5" />,
  },
  {
    id: "users",
    name: "Users Report",
    description: "Staff and access logs",
    icon: <FileText className="w-5 h-5" />,
  },
];

export function ExportReports() {
  const ordersStats = useQuery(api.orders.getOrdersStats);
  const allOrders = useQuery(api.orders.getAllOrders, { limit: 500, daysBack: 90 });
  const menuItems = useQuery(api.menuItems.getAllMenuItems);
  const accessCodes = useQuery(api.accessCodes.listAccessCodes);
  const [selectedReport, setSelectedReport] = useState<ReportType>("sales");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [salesFormat, setSalesFormat] = useState<SalesFormat>("receipt");
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  const handlePrint = async () => {
    setIsPrinting(true);

    try {
      printReceiptStylePDF();
      toast({
        title: "Opening Print Dialog",
        description: "Your receipt is ready to print",
      });
    } catch (error) {
      toast({
        title: "Print Failed",
        description:
          "There was an error preparing the receipt. Please try again.",
        variant: "destructive",
      });
    }

    setIsPrinting(false);
  };

  const generateReceiptStylePDF = () => {
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    let y = 20;

    const filteredOrders =
      dateRange.from && dateRange.to && allOrders
        ? allOrders.filter((order) => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= dateRange.from! && orderDate <= dateRange.to!;
          })
        : allOrders || [];

    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("NEW ERA CAFETERIA", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text("Redeemers University, Ede", pageWidth / 2, y, {
      align: "center",
    });
    y += 5;
    doc.text("Osun State, Nigeria", pageWidth / 2, y, { align: "center" });
    y += 8;

    // Report period
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.text("SALES REPORT", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    const dateStr =
      dateRange.from && dateRange.to
        ? `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
        : `Generated: ${format(new Date(), "MMM dd, yyyy")}`;
    doc.text(dateStr, pageWidth / 2, y, { align: "center" });
    y += 3;

    // Separator line
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Group by day
    const ordersByDay = filteredOrders.reduce(
      (acc, order) => {
        const orderDate = new Date(order.createdAt);
        const dayKey = format(orderDate, "yyyy-MM-dd");
        if (!acc[dayKey]) {
          acc[dayKey] = [];
        }
        acc[dayKey].push(order);
        return acc;
      },
      {} as Record<string, typeof filteredOrders>,
    );

    const sortedDays = Object.keys(ordersByDay).sort();
    let grandTotal = 0;
    let totalOrders = 0;

    sortedDays.forEach((dayKey, dayIndex) => {
      const dayOrders = ordersByDay[dayKey];
      const dayDate = new Date(dayKey);
      const dayTotal = dayOrders.reduce((sum, order) => sum + order.total, 0);

      // Day header
      doc.setFontSize(9);
      doc.setFont(undefined, "bold");
      doc.text(`${format(dayDate, "EEEE, MMM dd, yyyy")}`, margin, y);
      y += 5;

      // Shift breakdown
      const morningOrders = dayOrders.filter((order) => {
        const date = new Date(order.createdAt);
        const timeInMinutes = date.getHours() * 60 + date.getMinutes();
        return timeInMinutes >= 450 && timeInMinutes < 870; // 7:30 AM - 2:30 PM
      });
      const eveningOrders = dayOrders.filter((order) => {
        const date = new Date(order.createdAt);
        const timeInMinutes = date.getHours() * 60 + date.getMinutes();
        return timeInMinutes >= 900 && timeInMinutes < 1320; // 3:00 PM - 10:00 PM
      });

      if (morningOrders.length > 0) {
        const morningTotal = morningOrders.reduce(
          (sum, order) => sum + order.total,
          0,
        );
        const morningCash = morningOrders.filter(
          (o) => o.paymentMethod === "cash",
        ).length;
        const morningTransfer = morningOrders.filter(
          (o) => o.paymentMethod === "transfer",
        ).length;

        doc.setFont(undefined, "normal");
        doc.setFontSize(8);
        doc.text(`  Morning Shift (7:30 AM - 2:30 PM)`, margin + 2, y);
        y += 4;
        doc.text(
          `  Orders: ${morningOrders.length} (Cash: ${morningCash}, Transfer: ${morningTransfer})`,
          margin + 4,
          y,
        );
        doc.text(`N${morningTotal.toLocaleString()}`, pageWidth - margin, y, {
          align: "right",
        });
        y += 5;
      }

      if (eveningOrders.length > 0) {
        const eveningTotal = eveningOrders.reduce(
          (sum, order) => sum + order.total,
          0,
        );
        const eveningCash = eveningOrders.filter(
          (o) => o.paymentMethod === "cash",
        ).length;
        const eveningTransfer = eveningOrders.filter(
          (o) => o.paymentMethod === "transfer",
        ).length;

        doc.setFont(undefined, "normal");
        doc.setFontSize(8);
        doc.text(`  Evening Shift (3:00 PM - 10:00 PM)`, margin + 2, y);
        y += 4;
        doc.text(
          `  Orders: ${eveningOrders.length} (Cash: ${eveningCash}, Transfer: ${eveningTransfer})`,
          margin + 4,
          y,
        );
        doc.text(`N${eveningTotal.toLocaleString()}`, pageWidth - margin, y, {
          align: "right",
        });
        y += 5;
      }

      // Day total
      const cashCount = dayOrders.filter(
        (o) => o.paymentMethod === "cash",
      ).length;
      const transferCount = dayOrders.filter(
        (o) => o.paymentMethod === "transfer",
      ).length;

      doc.setFont(undefined, "bold");
      doc.setFontSize(9);
      doc.text(`Day Total:`, margin, y);
      doc.text(`N${dayTotal.toLocaleString()}`, pageWidth - margin, y, {
        align: "right",
      });
      y += 4;
      doc.setFont(undefined, "normal");
      doc.setFontSize(7);
      doc.text(
        `(${dayOrders.length} orders: ${cashCount} Cash, ${transferCount} Transfer)`,
        margin,
        y,
      );
      y += 5;

      // Separator
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      grandTotal += dayTotal;
      totalOrders += dayOrders.length;

      // Check if we need a new page
      if (y > 270 && dayIndex < sortedDays.length - 1) {
        doc.addPage();
        y = 20;
      }
    });

    // Summary section
    y += 3;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("SUMMARY", pageWidth / 2, y, { align: "center" });
    y += 7;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Total Orders:`, margin, y);
    doc.text(totalOrders.toString(), pageWidth - margin, y, {
      align: "right",
    });
    y += 5;

    doc.text(`Total Days:`, margin, y);
    doc.text(sortedDays.length.toString(), pageWidth - margin, y, {
      align: "right",
    });
    y += 5;

    const totalCash = filteredOrders.filter(
      (o) => o.paymentMethod === "cash",
    ).length;
    const totalTransfer = filteredOrders.filter(
      (o) => o.paymentMethod === "transfer",
    ).length;

    doc.text(`Cash Payments:`, margin, y);
    doc.text(totalCash.toString(), pageWidth - margin, y, { align: "right" });
    y += 5;

    doc.text(`Transfer Payments:`, margin, y);
    doc.text(totalTransfer.toString(), pageWidth - margin, y, {
      align: "right",
    });
    y += 7;

    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(`TOTAL REVENUE:`, margin, y);
    doc.text(`N${grandTotal.toLocaleString()}`, pageWidth - margin, y, {
      align: "right",
    });
    y += 8;

    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Footer
    doc.setFontSize(7);
    doc.setFont(undefined, "normal");
    doc.text(
      `Printed: ${format(new Date(), "MMM dd, yyyy hh:mm a")}`,
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 4;
    doc.text("Thank you for your business!", pageWidth / 2, y, {
      align: "center",
    });

    const fileName = `sales_receipt_${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);
  };

  const printReceiptStylePDF = () => {
    const filteredOrders =
      dateRange.from && dateRange.to && allOrders
        ? allOrders.filter((order) => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= dateRange.from! && orderDate <= dateRange.to!;
          })
        : allOrders || [];

    // Create an iframe for printing
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "absolute";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);

    const printDoc =
      printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!printDoc) return;

    // Group by day
    const ordersByDay = filteredOrders.reduce(
      (acc, order) => {
        const orderDate = new Date(order.createdAt);
        const dayKey = format(orderDate, "yyyy-MM-dd");
        if (!acc[dayKey]) {
          acc[dayKey] = [];
        }
        acc[dayKey].push(order);
        return acc;
      },
      {} as Record<string, typeof filteredOrders>,
    );

    const sortedDays = Object.keys(ordersByDay).sort();
    let grandTotal = 0;
    let totalOrders = 0;
    const totalCash = filteredOrders.filter(
      (o) => o.paymentMethod === "cash",
    ).length;
    const totalTransfer = filteredOrders.filter(
      (o) => o.paymentMethod === "transfer",
    ).length;

    // Build plain text report (works reliably in WebView2)
    const W = 40;
    const SEP = '-'.repeat(W);
    const pad = (l: string, r: string) => l + ' '.repeat(Math.max(1, W - l.length - r.length)) + r;

    const periodStr = dateRange.from && dateRange.to
      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
      : format(new Date(), "dd/MM/yyyy");

    const center = (s: string) => {
      const spaces = Math.max(0, Math.floor((W - s.length) / 2));
      return ' '.repeat(spaces) + s;
    };

    const lines: string[] = [];
    lines.push(center('New Era Cafeteria'));
    lines.push(center('Redeemer\'s University, Ede'));
    lines.push(SEP);
    lines.push(center('SALES REPORT'));
    lines.push(center(periodStr));
    lines.push(SEP);

    sortedDays.forEach((dayKey) => {
      const dayOrders = ordersByDay[dayKey];
      const dayDate = new Date(dayKey);
      const dayTotal = dayOrders.reduce((sum, order) => sum + order.total, 0);
      grandTotal += dayTotal;
      totalOrders += dayOrders.length;

      lines.push('');
      lines.push(`  ${format(dayDate, "EEE, dd MMM yyyy")}`);

      const morningOrders = dayOrders.filter((order) => {
        const hour = new Date(order.createdAt).getHours();
        return hour >= 6 && hour < 18;
      });
      const nightOrders = dayOrders.filter((order) => {
        const hour = new Date(order.createdAt).getHours();
        return hour >= 18 || hour < 6;
      });

      if (morningOrders.length > 0) {
        const morningTotal = morningOrders.reduce((sum, order) => sum + order.total, 0);
        const mCash = morningOrders.filter(o => o.paymentMethod === "cash").length;
        const mTransfer = morningOrders.filter(o => o.paymentMethod === "transfer").length;
        lines.push(pad(`  Morning (${morningOrders.length} C:${mCash} T:${mTransfer})`, `N${morningTotal.toLocaleString()}`));
      }
      if (nightOrders.length > 0) {
        const nightTotal = nightOrders.reduce((sum, order) => sum + order.total, 0);
        const nCash = nightOrders.filter(o => o.paymentMethod === "cash").length;
        const nTransfer = nightOrders.filter(o => o.paymentMethod === "transfer").length;
        lines.push(pad(`  Night (${nightOrders.length} C:${nCash} T:${nTransfer})`, `N${nightTotal.toLocaleString()}`));
      }

      const cashCount = dayOrders.filter(o => o.paymentMethod === "cash").length;
      const transferCount = dayOrders.filter(o => o.paymentMethod === "transfer").length;
      lines.push(pad(`  Total (${dayOrders.length} C:${cashCount} T:${transferCount})`, `N${dayTotal.toLocaleString()}`));
    });

    lines.push(SEP);
    lines.push('        SUMMARY');
    lines.push(SEP);
    lines.push(pad('Total Orders:', `${totalOrders}`));
    lines.push(pad('Total Days:', `${sortedDays.length}`));
    lines.push(pad('Cash Payments:', `${totalCash}`));
    lines.push(pad('Transfer Payments:', `${totalTransfer}`));
    lines.push(SEP);
    lines.push(pad('TOTAL REVENUE:', `N${grandTotal.toLocaleString()}`));
    lines.push(SEP);
    lines.push('');
    lines.push(`  Printed: ${format(new Date(), "dd/MM/yyyy HH:mm")}`);
    lines.push('  Thank you for your business!');

    const reportText = lines.join('\n');

    printDoc.write(`<html><head><title>Sales Report</title><style>
      @page { size: 80mm auto; margin: 0; }
      * { margin:0; padding:0; }
      body { margin:0; padding:0; width:80mm; background:white; }
    </style></head><body><pre style="font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;margin:0;padding:2mm;white-space:pre;overflow:hidden;">${reportText}</pre></body></html>`);
    printDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 100);
    }, 300);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.width;

    // Title
    doc.setFontSize(18);
    doc.text("New Era Cafeteria", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(14);
    const reportTitle =
      reportOptions.find((r) => r.id === selectedReport)?.name || "Report";
    doc.text(reportTitle, pageWidth / 2, 30, { align: "center" });

    doc.setFontSize(10);
    const dateStr =
      dateRange.from && dateRange.to
        ? `${format(dateRange.from, "PP")} - ${format(dateRange.to, "PP")}`
        : `Generated: ${format(new Date(), "PPP")}`;
    doc.text(dateStr, pageWidth / 2, 38, { align: "center" });

    let startY = 48;

    if (selectedReport === "sales" && allOrders) {
      const filteredOrders =
        dateRange.from && dateRange.to
          ? allOrders.filter((order) => {
              const orderDate = new Date(order.createdAt);
              return orderDate >= dateRange.from! && orderDate <= dateRange.to!;
            })
          : allOrders;

      // Group orders by day
      const ordersByDay = filteredOrders.reduce(
        (acc, order) => {
          const orderDate = new Date(order.createdAt);
          const dayKey = format(orderDate, "yyyy-MM-dd");
          if (!acc[dayKey]) {
            acc[dayKey] = [];
          }
          acc[dayKey].push(order);
          return acc;
        },
        {} as Record<string, typeof filteredOrders>,
      );

      const tableData: any[] = [];
      let totalRevenue = 0;

      // Sort days chronologically
      const sortedDays = Object.keys(ordersByDay).sort();

      sortedDays.forEach((dayKey, dayIndex) => {
        const dayOrders = ordersByDay[dayKey];
        const dayDate = new Date(dayKey);

        // Separate orders by shift (Morning: 6 AM - 5:59 PM, Night: 6 PM - 5:59 AM)
        const morningOrders = dayOrders.filter((order) => {
          const hour = new Date(order.createdAt).getHours();
          return hour >= 6 && hour < 18;
        });
        const nightOrders = dayOrders.filter((order) => {
          const hour = new Date(order.createdAt).getHours();
          return hour >= 18 || hour < 6;
        });

        const dayTotal = dayOrders.reduce((sum, order) => sum + order.total, 0);

        // Day header
        tableData.push([
          {
            content: `${format(dayDate, "EEEE, MMMM dd, yyyy")} - ${dayOrders.length} orders`,
            colSpan: 5,
            styles: {
              fontStyle: "bold",
              fillColor: [220, 220, 220],
              fontSize: 11,
            },
          },
        ]);

        // Morning Shift
        if (morningOrders.length > 0) {
          const morningTotal = morningOrders.reduce(
            (sum, order) => sum + order.total,
            0,
          );
          const morningCash = morningOrders.filter(
            (o) => o.paymentMethod === "cash",
          ).length;
          const morningTransfer = morningOrders.filter(
            (o) => o.paymentMethod === "transfer",
          ).length;

          tableData.push([
            {
              content: `☀️ Morning Shift (6 AM - 6 PM) - ${morningOrders.length} orders`,
              colSpan: 5,
              styles: {
                fontStyle: "bold",
                fillColor: [255, 248, 220],
                fontSize: 10,
              },
            },
          ]);

          morningOrders.forEach((order) => {
            const orderTime = new Date(order.createdAt);
            tableData.push([
              format(orderTime, "hh:mm a"),
              "Morning",
              order.paymentMethod,
              order.items.length.toString(),
              `N${order.total.toLocaleString()}`,
            ]);
          });

          tableData.push([
            {
              content: `Morning Total (Cash: ${morningCash}, Transfer: ${morningTransfer}):`,
              colSpan: 4,
              styles: {
                fontStyle: "bold",
                halign: "right",
                fillColor: [255, 253, 240],
              },
            },
            {
              content: `N${morningTotal.toLocaleString()}`,
              styles: {
                fontStyle: "bold",
                fillColor: [255, 253, 240],
              },
            },
          ]);
        }

        // Night Shift
        if (nightOrders.length > 0) {
          const nightTotal = nightOrders.reduce(
            (sum, order) => sum + order.total,
            0,
          );
          const nightCash = nightOrders.filter(
            (o) => o.paymentMethod === "cash",
          ).length;
          const nightTransfer = nightOrders.filter(
            (o) => o.paymentMethod === "transfer",
          ).length;

          tableData.push([
            {
              content: `🌙 Night Shift (6 PM - 6 AM) - ${nightOrders.length} orders`,
              colSpan: 5,
              styles: {
                fontStyle: "bold",
                fillColor: [230, 230, 250],
                fontSize: 10,
              },
            },
          ]);

          nightOrders.forEach((order) => {
            const orderTime = new Date(order.createdAt);
            tableData.push([
              format(orderTime, "hh:mm a"),
              "Night",
              order.paymentMethod,
              order.items.length.toString(),
              `N${order.total.toLocaleString()}`,
            ]);
          });

          tableData.push([
            {
              content: `Night Total (Cash: ${nightCash}, Transfer: ${nightTransfer}):`,
              colSpan: 4,
              styles: {
                fontStyle: "bold",
                halign: "right",
                fillColor: [240, 240, 255],
              },
            },
            {
              content: `N${nightTotal.toLocaleString()}`,
              styles: {
                fontStyle: "bold",
                fillColor: [240, 240, 255],
              },
            },
          ]);
        }

        // Day subtotal
        const cashCount = dayOrders.filter(
          (o) => o.paymentMethod === "cash",
        ).length;
        const transferCount = dayOrders.filter(
          (o) => o.paymentMethod === "transfer",
        ).length;

        tableData.push([
          {
            content: `Day Total (Cash: ${cashCount}, Transfer: ${transferCount}):`,
            colSpan: 4,
            styles: {
              fontStyle: "bold",
              halign: "right",
              fillColor: [245, 245, 245],
            },
          },
          {
            content: `N${dayTotal.toLocaleString()}`,
            styles: {
              fontStyle: "bold",
              fillColor: [245, 245, 245],
            },
          },
        ]);

        totalRevenue += dayTotal;

        // Add spacing between days
        if (dayIndex < sortedDays.length - 1) {
          tableData.push([
            { content: "", colSpan: 5, styles: { minCellHeight: 3 } },
          ]);
        }
      });

      autoTable(doc, {
        startY: startY,
        head: [["Time", "Shift", "Payment", "Items", "Amount"]],
        body: tableData,
        foot: [
          ["", "", "", "Grand Total:", `N${totalRevenue.toLocaleString()}`],
        ],
        theme: "grid",
        headStyles: {
          fillColor: [66, 139, 202],
          fontStyle: "bold",
          fontSize: 11,
          textColor: [255, 255, 255],
        },
        footStyles: {
          fillColor: [240, 240, 240],
          fontStyle: "bold",
          fontSize: 11,
          textColor: [0, 0, 0],
        },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 28, halign: "center" },
          2: { cellWidth: 28, halign: "center" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 34, halign: "right" },
        },
      });
    } else if (selectedReport === "orders" && allOrders) {
      const filteredOrders =
        dateRange.from && dateRange.to
          ? allOrders.filter((order) => {
              const orderDate = new Date(order.createdAt);
              return orderDate >= dateRange.from! && orderDate <= dateRange.to!;
            })
          : allOrders;

      const tableData: any[] = [];
      let grandTotal = 0;

      filteredOrders.forEach((order, idx) => {
        const orderDate = new Date(order.createdAt);
        const orderHeader = `Order #${idx + 1} - ${format(orderDate, "MM/dd/yyyy HH:mm")} - ${order.paymentMethod}`;

        tableData.push([
          {
            content: orderHeader,
            colSpan: 4,
            styles: { fontStyle: "bold", fillColor: [220, 220, 220] },
          },
        ]);

        order.items.forEach((item) => {
          const itemTotal = item.price * item.quantity;
          tableData.push([
            item.name,
            item.quantity.toString(),
            `N${item.price.toLocaleString()}`,
            `N${itemTotal.toLocaleString()}`,
          ]);
        });

        tableData.push([
          {
            content: "Order Total:",
            colSpan: 3,
            styles: { fontStyle: "bold", halign: "right" },
          },
          {
            content: `N${order.total.toLocaleString()}`,
            styles: { fontStyle: "bold" },
          },
        ]);

        grandTotal += order.total;

        if (idx < filteredOrders.length - 1) {
          tableData.push([
            { content: "", colSpan: 4, styles: { minCellHeight: 2 } },
          ]);
        }
      });

      autoTable(doc, {
        startY: startY,
        head: [["Item", "Qty", "Price", "Total"]],
        body: tableData,
        foot: [["", "", "Grand Total:", `N${grandTotal.toLocaleString()}`]],
        theme: "grid",
        headStyles: {
          fillColor: [66, 139, 202],
          fontStyle: "bold",
          fontSize: 11,
          textColor: [255, 255, 255],
        },
        footStyles: {
          fillColor: [240, 240, 240],
          fontStyle: "bold",
          fontSize: 11,
          textColor: [0, 0, 0],
        },
        styles: {
          fontSize: 10,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 40, halign: "right" },
          3: { cellWidth: 40, halign: "right" },
        },
      });
    } else if (selectedReport === "inventory" && menuItems) {
      const tableData = menuItems.map((item) => [
        item.name,
        item.category,
        `N${item.price.toLocaleString()}`,
        item.available ? "Available" : "Out of Stock",
      ]);

      const totalValue = menuItems.reduce((sum, item) => sum + item.price, 0);
      const availableCount = menuItems.filter((i) => i.available).length;

      autoTable(doc, {
        startY: startY,
        head: [["Item Name", "Category", "Price", "Status"]],
        body: tableData,
        foot: [
          ["", "", "", ""],
          [
            `Total Items: ${menuItems.length}`,
            `Available: ${availableCount}`,
            "Total Value:",
            `N${totalValue.toLocaleString()}`,
          ],
        ],
        theme: "grid",
        headStyles: {
          fillColor: [66, 139, 202],
          fontStyle: "bold",
          fontSize: 11,
          textColor: [255, 255, 255],
        },
        footStyles: {
          fillColor: [240, 240, 240],
          fontStyle: "bold",
          fontSize: 11,
          textColor: [0, 0, 0],
        },
        styles: {
          fontSize: 10,
          cellPadding: 3,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35, halign: "right" },
          3: { cellWidth: 35, halign: "center" },
        },
      });
    } else if (selectedReport === "users" && accessCodes) {
      const tableData = accessCodes.map((code) => {
        const createdDate = new Date(code.createdAt);
        const expiresDate = code.expiresAt ? new Date(code.expiresAt) : null;
        const statusText = !code.isActive
          ? "Deactivated"
          : expiresDate && expiresDate < new Date()
            ? "Expired"
            : "Active";

        return [
          code.code,
          code.role.charAt(0).toUpperCase() + code.role.slice(1),
          code.shift
            ? code.shift.charAt(0).toUpperCase() + code.shift.slice(1)
            : "N/A",
          code.usedCount.toString(),
          format(createdDate, "MM/dd/yyyy"),
          expiresDate ? format(expiresDate, "MM/dd/yyyy") : "No Expiry",
          statusText,
        ];
      });

      const activeCount = accessCodes.filter((c) => c.isActive).length;
      const totalUsage = accessCodes.reduce(
        (sum, code) => sum + code.usedCount,
        0,
      );

      autoTable(doc, {
        startY: startY,
        head: [
          ["Code", "Role", "Shift", "Uses", "Created", "Expires", "Status"],
        ],
        body: tableData,
        foot: [
          ["", "", "", "", "", "", ""],
          [
            `Total Codes: ${accessCodes.length}`,
            `Active: ${activeCount}`,
            "",
            `Total Uses: ${totalUsage}`,
            "",
            "",
            "",
          ],
        ],
        theme: "grid",
        headStyles: {
          fillColor: [66, 139, 202],
          fontStyle: "bold",
          fontSize: 10,
          textColor: [255, 255, 255],
        },
        footStyles: {
          fillColor: [240, 240, 240],
          fontStyle: "bold",
          fontSize: 10,
          textColor: [0, 0, 0],
        },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        columnStyles: {
          0: { cellWidth: 25, halign: "center" },
          1: { cellWidth: 25, halign: "center" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 30, halign: "center" },
          5: { cellWidth: 30, halign: "center" },
          6: { cellWidth: 25, halign: "center" },
        },
      });
    } else {
      doc.setFontSize(10);
      doc.text("No data available for this report type.", 15, startY);
    }

    const fileName = `${selectedReport}_report_${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      if (exportFormat === "pdf") {
        if (selectedReport === "sales" && salesFormat === "receipt") {
          generateReceiptStylePDF();
        } else {
          generatePDFReport();
        }
        toast({
          title: "Report Downloaded",
          description: `Your ${selectedReport} report has been downloaded as PDF`,
        });
      } else {
        // For CSV/Excel, show not implemented message
        toast({
          title: "Format Not Available",
          description: `${exportFormat.toUpperCase()} export is coming soon. Please use PDF format.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description:
          "There was an error generating the report. Please try again.",
        variant: "destructive",
      });
    }

    setIsExporting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-display">
            <Download className="w-5 h-5 text-primary" />
            Export Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Report Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reportOptions.map((report) => (
                <Card
                  key={report.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all hover:border-primary/50",
                    selectedReport === report.id &&
                      "border-primary bg-primary/5",
                  )}
                  onClick={() => setSelectedReport(report.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        selectedReport === report.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary",
                      )}
                    >
                      {report.icon}
                    </div>
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Date Range</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal flex-1",
                      !dateRange.from && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from
                      ? format(dateRange.from, "PPP")
                      : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) =>
                      setDateRange((prev) => ({ ...prev, from: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal flex-1",
                      !dateRange.to && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "PPP") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) =>
                      setDateRange((prev) => ({ ...prev, to: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Date Presets */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Today", days: 0 },
                { label: "Last 7 days", days: 7 },
                { label: "Last 30 days", days: 30 },
                { label: "This month", days: -1 },
              ].map((preset) => (
                <Badge
                  key={preset.label}
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary"
                  onClick={() => {
                    const to = new Date();
                    let from: Date;
                    if (preset.days === -1) {
                      from = new Date(to.getFullYear(), to.getMonth(), 1);
                    } else if (preset.days === 0) {
                      from = new Date();
                    } else {
                      from = new Date(
                        Date.now() - preset.days * 24 * 60 * 60 * 1000,
                      );
                    }
                    setDateRange({ from, to });
                  }}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sales Format Selection - Only show for sales reports */}
          {selectedReport === "sales" && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Report Style</label>
              <Select
                value={salesFormat}
                onValueChange={(v) => setSalesFormat(v as SalesFormat)}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="detailed">Detailed Table View</SelectItem>
                  <SelectItem value="receipt">Receipt Style</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {salesFormat === "detailed"
                  ? "Complete breakdown with shift details and all transactions"
                  : "Compact receipt-style summary format"}
              </p>
            </div>
          )}

          {/* Export Format */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Export Format</label>
            <Select
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as ExportFormat)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Document</SelectItem>
                <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                <SelectItem value="excel">Excel Workbook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full sm:w-auto gap-2"
            >
              {isExporting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Report
                </>
              )}
            </Button>

            {/* Print Button - Only show for sales receipt format */}
            {selectedReport === "sales" && salesFormat === "receipt" && (
              <Button
                onClick={handlePrint}
                disabled={isPrinting}
                variant="outline"
                className="w-full sm:w-auto gap-2"
              >
                {isPrinting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

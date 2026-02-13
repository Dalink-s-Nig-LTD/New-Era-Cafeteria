import { invoke } from "@tauri-apps/api/core";

export interface PrinterInfo {
  port_name: string;
  port_type: string;
}

export interface ReceiptLine {
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  size?: "normal" | "large";
}

/**
 * Get list of available thermal printers
 */
export async function getThermalPrinters(): Promise<PrinterInfo[]> {
  try {
    const printers = await invoke<PrinterInfo[]>("get_printers");
    return printers;
  } catch (error) {
    console.error("Failed to get printers:", error);
    return [];
  }
}

/**
 * Print to thermal printer using ESC/POS commands
 */
export async function printToThermal(
  portName: string,
  content: string[]
): Promise<boolean> {
  try {
    await invoke("print_to_thermal", {
      portName,
      content,
    });
    return true;
  } catch (error) {
    console.error("Failed to print:", error);
    throw error;
  }
}

/**
 * Format receipt content for thermal printing
 */
export function formatReceiptContent(
  header: string[],
  items: Array<{ name: string; quantity: number; price: number }>,
  total: number,
  footer: string[]
): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  const width = 32; // Standard 80mm thermal printer width in characters

  // Helper to center text
  const center = (text: string): string => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  };

  // Helper to format line with price
  const formatLine = (name: string, price: string): string => {
    const maxNameLength = width - price.length - 1;
    const truncatedName = name.length > maxNameLength 
      ? name.substring(0, maxNameLength) 
      : name;
    const spaces = width - truncatedName.length - price.length;
    return truncatedName + " ".repeat(Math.max(1, spaces)) + price;
  };

  // Header
  header.forEach(line => lines.push({ text: center(line), bold: true, align: "center" }));
  lines.push({ text: "=".repeat(width), bold: true });
  lines.push({ text: "" });

  // Section Title
  lines.push({ text: "Morning Shift", bold: true, align: "center" });
  lines.push({ text: "-".repeat(width), bold: true });

  // Items
  items.forEach(item => {
    const itemLine = `${item.quantity}x ${item.name}`;
    const priceLine = `₦${item.price.toFixed(2)}`;
    lines.push({ text: formatLine(itemLine, priceLine) });
  });

  // Total
  lines.push({ text: "" });
  lines.push({ text: "-".repeat(width) });
  lines.push({ text: formatLine("GRAND TOTAL", `₦${total.toFixed(2)}`), bold: true });
  lines.push({ text: "=".repeat(width), bold: true });
  lines.push({ text: "" });

  // Footer
  footer.forEach(line => lines.push({ text: center(line), bold: false, align: "center" }));

  return lines;
}

/**
 * Get default printer from localStorage or first available
 */
export async function getDefaultPrinter(): Promise<string | null> {
  const saved = localStorage.getItem("default_thermal_printer");
  if (saved) return saved;

  const printers = await getThermalPrinters();
  return printers.length > 0 ? printers[0].port_name : null;
}

/**
 * Save default printer to localStorage
 */
export function setDefaultPrinter(portName: string): void {
  localStorage.setItem("default_thermal_printer", portName);
}

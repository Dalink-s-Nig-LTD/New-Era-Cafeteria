/**
 * Tauri Print Service for Xprinter M804 thermal printer
 * This module handles printing via Tauri's invoke system
 */

import { buildReceiptCommands, buildReportCommands, buildSpecialOrderReceiptCommands, type ReceiptData, type ReportData, type SpecialOrderReceiptData } from './escpos';
import type { Order, CartItem } from '@/types/cafeteria';
import { format } from 'date-fns';

export interface PrinterInfo {
  vendor_id: number;
  product_id: number;
  name: string;
  connected: boolean;
}

// Cache for default printer
let cachedDefaultPrinter: PrinterInfo | null = null;

// Check if we're running in Tauri
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Tauri v2 injects __TAURI__ global - this is the most reliable check
  if ('__TAURI__' in window) return true;
  
  // Fallback: check user agent (older Tauri versions)
  if (window.navigator.userAgent.includes('Tauri')) return true;
  
  // Additional check: Tauri v2 with withGlobalTauri might have __TAURI_INTERNALS__
  if ('__TAURI_INTERNALS__' in window) return true;
  
  return false;
}

// Get Tauri invoke function
async function getTauriInvoke(): Promise<((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null> {
  if (!isTauri()) return null;
  
  try {
    // Access Tauri's invoke from the global __TAURI__ object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tauriCore = (window as any).__TAURI__?.core;
    if (tauriCore?.invoke) {
      return tauriCore.invoke;
    }
    
    // Fallback: try the tauri object directly (older Tauri versions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tauriInvoke = (window as any).__TAURI__?.invoke;
    if (tauriInvoke) {
      return tauriInvoke;
    }
    
    console.warn('Tauri invoke not found in __TAURI__ global');
    return null;
  } catch (error) {
    console.error('Failed to get Tauri invoke:', error);
    return null;
  }
}

/**
 * Get list of available printers
 */
export async function listPrinters(): Promise<PrinterInfo[]> {
  const invoke = await getTauriInvoke();
  if (!invoke) return [];

  try {
    const printers = await invoke('get_printers') as PrinterInfo[];
    console.log('Available printers:', printers);
    return printers;
  } catch (error) {
    console.error('Failed to list printers:', error);
    return [];
  }
}

/**
 * Auto-detect and set default printer
 * Returns the selected printer or null if none found
 */
export async function autoSelectDefaultPrinter(): Promise<PrinterInfo | null> {
  // Return cached if available
  if (cachedDefaultPrinter) {
    console.log('Using cached default printer:', cachedDefaultPrinter.name);
    return cachedDefaultPrinter;
  }

  const printers = await listPrinters();
  
  if (printers.length === 0) {
    console.warn('No thermal printers detected');
    return null;
  }

  // Find a connected printer, prefer the first one
  const connectedPrinter = printers.find(p => p.connected) || printers[0];
  
  cachedDefaultPrinter = connectedPrinter;
  console.log('Auto-selected default printer:', connectedPrinter.name);
  
  return connectedPrinter;
}

/**
 * Get the current default printer (cached)
 */
export function getDefaultPrinter(): PrinterInfo | null {
  return cachedDefaultPrinter;
}

/**
 * Clear the cached default printer (for re-detection)
 */
export function clearPrinterCache(): void {
  cachedDefaultPrinter = null;
}

/**
 * Format order number for receipt
 */
function formatOrderNumber(order: Order): string {
  if (/^\d{2}-\d{2}-\d{5}$/.test(order.id)) return order.id;
  
  const date = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const num = order.id.replace(/\D/g, '').slice(-5).padStart(5, '0');
  return `${day}-${month}-${num}`;
}

/**
 * Categorize items into food and drinks
 */
function categorizeItems(items: CartItem[]): { food: CartItem[]; drinks: CartItem[] } {
  const food: CartItem[] = [];
  const drinks: CartItem[] = [];
  
  items.forEach(item => {
    const category = item.category?.toLowerCase();
    if (category === 'drink' || category === 'drinks') {
      drinks.push(item);
    } else {
      food.push(item);
    }
  });
  
  return { food, drinks };
}

/**
 * Print plain text silently to system default printer (fallback when no thermal printer)
 */
export async function printTextSilent(text: string): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    console.warn('Tauri not available');
    return false;
  }

  try {
    await invoke('print_text_silent', { text });
    console.log('Text printed to system printer successfully');
    return true;
  } catch (error) {
    console.error('Failed to print to system printer:', error);
    return false;
  }
}

/**
 * Generate receipt text for system printer (plain text format)
 */
function generateReceiptText(order: Order, type?: 'food' | 'drinks'): string {
  const { food, drinks } = categorizeItems(order.items);
  const items = type === 'food' ? food : type === 'drinks' ? drinks : order.items;
  
  if (items.length === 0) return '';

  const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const lines: string[] = [];
  lines.push('================================');
  lines.push('       NEW ERA CAFETERIA        ');
  lines.push('  Redeemer\'s University, Ede   ');
  lines.push('================================');
  lines.push('');
  lines.push(`Order: ${formatOrderNumber(order)}`);
  lines.push(`Date: ${format(timestamp, 'dd/MM/yyyy HH:mm')}`);
  lines.push(`Payment: ${order.paymentMethod}`);
  if (type) lines.push(`Type: ${type.toUpperCase()}`);
  lines.push('--------------------------------');
  
  items.forEach(item => {
    const itemTotal = (item.price * item.quantity).toLocaleString();
    lines.push(`${item.quantity}x ${item.name}`);
    lines.push(`                    N${itemTotal}`);
  });
  
  lines.push('--------------------------------');
  lines.push(`TOTAL:              N${total.toLocaleString()}`);
  lines.push('================================');
  lines.push('    Thank you for your order!   ');
  lines.push('       Please come again        ');
  lines.push('');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Print a receipt via Tauri (direct to thermal printer, fallback to system printer)
 */
export async function printReceiptTauri(order: Order, type?: 'food' | 'drinks'): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    console.warn('Tauri not available, falling back to browser print');
    return false;
  }

  const { food, drinks } = categorizeItems(order.items);
  const items = type === 'food' ? food : type === 'drinks' ? drinks : order.items;
  
  if (items.length === 0) {
    console.warn('No items to print for type:', type);
    return false;
  }

  const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const receiptData: ReceiptData = {
    orderNumber: formatOrderNumber(order),
    date: format(timestamp, 'dd/MM/yyyy'),
    time: format(timestamp, 'HH:mm'),
    paymentMethod: order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1),
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    total,
    type,
  };

  const commands = buildReceiptCommands(receiptData);

  try {
    // Try thermal printer only - if it fails, return false so the UI can use styled browser print
    await invoke('print_escpos_cmd', { data: commands });
    console.log('Receipt printed successfully via thermal printer');
    return true;
  } catch (error) {
    console.warn('Thermal printer failed, returning false for styled browser fallback:', error);
    return false;
  }
}

/**
 * Generate report text for system printer (plain text format)
 */
function generateReportText(reportData: {
  shift: string;
  cashierCode: string;
  menuFoodTotal: number;
  menuDrinksTotal: number;
  customFoodTotal: number;
  customDrinksTotal: number;
  grandTotal: number;
}): string {
  const now = new Date();
  const lines: string[] = [];
  
  lines.push('================================');
  lines.push('       DAILY SALES REPORT       ');
  lines.push('       NEW ERA CAFETERIA        ');
  lines.push('================================');
  lines.push('');
  lines.push(`Shift: ${reportData.shift}`);
  lines.push(`Cashier: ${reportData.cashierCode}`);
  lines.push(`Date: ${format(now, 'dd/MM/yyyy')}`);
  lines.push(`Time: ${format(now, 'HH:mm')}`);
  lines.push('--------------------------------');
  lines.push('MENU ITEMS:');
  lines.push(`  Food:     N${reportData.menuFoodTotal.toLocaleString()}`);
  lines.push(`  Drinks:   N${reportData.menuDrinksTotal.toLocaleString()}`);
  lines.push('');
  lines.push('CUSTOM ITEMS:');
  lines.push(`  Food:     N${reportData.customFoodTotal.toLocaleString()}`);
  lines.push(`  Drinks:   N${reportData.customDrinksTotal.toLocaleString()}`);
  lines.push('--------------------------------');
  lines.push(`GRAND TOTAL: N${reportData.grandTotal.toLocaleString()}`);
  lines.push('================================');
  lines.push('');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Print daily sales report via Tauri (direct to thermal printer, fallback to system printer)
 */
export async function printReportTauri(reportData: {
  shift: 'morning' | 'afternoon' | 'evening' | 'all';
  cashierCode: string;
  menuFoodTotal: number;
  menuDrinksTotal: number;
  customFoodTotal: number;
  customDrinksTotal: number;
  grandTotal: number;
}): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    console.warn('Tauri not available, falling back to browser print');
    return false;
  }

  const now = new Date();
  const shiftLabel = reportData.shift === 'morning' 
    ? 'Morning Shift' 
    : reportData.shift === 'afternoon'
      ? 'Afternoon Shift'
      : reportData.shift === 'evening' 
        ? 'Evening Shift' 
        : 'Full Day';

  const data: ReportData = {
    shift: shiftLabel,
    cashierCode: reportData.cashierCode,
    date: format(now, 'dd/MM/yyyy'),
    time: format(now, 'HH:mm'),
    menuFoodTotal: reportData.menuFoodTotal,
    menuDrinksTotal: reportData.menuDrinksTotal,
    customFoodTotal: reportData.customFoodTotal,
    customDrinksTotal: reportData.customDrinksTotal,
    grandTotal: reportData.grandTotal,
  };

  const commands = buildReportCommands(data);

  try {
    // Try thermal printer only - if it fails, return false for styled browser fallback
    await invoke('print_escpos_cmd', { data: commands });
    console.log('Report printed successfully via thermal printer');
    return true;
  } catch (error) {
    console.warn('Thermal printer failed, returning false for styled browser fallback:', error);
    return false;
  }
}

/**
 * Open cash drawer via Tauri
 */
export async function openCashDrawerTauri(): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    console.warn('Tauri not available');
    return false;
  }

  try {
    await invoke('open_cash_drawer_cmd');
    console.log('Cash drawer opened successfully');
    return true;
  } catch (error) {
    console.error('Failed to open cash drawer:', error);
    return false;
  }
}

/**
 * Test printer connection via Tauri
 */
export async function testPrinterTauri(): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    console.warn('Tauri not available');
    return false;
  }

  try {
    const result = await invoke('test_printer_cmd');
    console.log('Printer test result:', result);
    return true;
  } catch (error) {
    console.error('Printer test failed:', error);
    return false;
  }
}

/**
 * Print special order delivery receipt via Tauri thermal printer
 */
export async function printSpecialOrderReceiptTauri(data: SpecialOrderReceiptData): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    console.warn('Tauri not available, falling back to browser print');
    return false;
  }

  const commands = buildSpecialOrderReceiptCommands(data);

  try {
    await invoke('print_escpos_cmd', { data: commands });
    console.log('Special order receipt printed successfully via thermal printer');
    return true;
  } catch (error) {
    console.warn('Thermal printer failed for special order receipt:', error);
    return false;
  }
}

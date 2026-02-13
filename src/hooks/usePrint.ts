/**
 * usePrint hook - Handles printing for both web and Tauri environments
 * Uses direct ESC/POS printing in Tauri (no dialog), falls back to browser print on web
 */

import { useCallback, useEffect, useState } from 'react';
import { isTauri, printReceiptTauri, printReportTauri, autoSelectDefaultPrinter } from '@/lib/tauriPrint';
import type { Order } from '@/types/cafeteria';

export function usePrint() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [printerReady, setPrinterReady] = useState(false);
  
  useEffect(() => {
    const checkDesktop = isTauri();
    setIsDesktop(checkDesktop);
    
    // Auto-detect printer on desktop
    if (checkDesktop) {
      autoSelectDefaultPrinter().then((printer) => {
        setPrinterReady(!!printer?.connected);
        if (printer) {
          console.log('Printer ready:', printer.name);
        }
      });
    }
  }, []);

  /**
   * Print receipt - uses Tauri ESC/POS on desktop (direct, no dialog), browser print on web
   */
  const printReceipt = useCallback(async (
    order: Order,
    type?: 'food' | 'drinks',
    fallbackPrintFn?: () => void
  ): Promise<boolean> => {
    if (isDesktop && printerReady) {
      // On desktop with printer ready, print directly to thermal printer
      const success = await printReceiptTauri(order, type);
      if (success) {
        console.log('Receipt printed directly to thermal printer');
        return true;
      }
    }
    
    // Fallback to browser print if thermal fails or no printer connected
    if (fallbackPrintFn) {
      console.log('Using browser print fallback');
      fallbackPrintFn();
      return true;
    }
    return false;
  }, [isDesktop, printerReady]);

  /**
   * Print daily sales report - uses Tauri ESC/POS on desktop (direct, no dialog), browser print on web
   */
  const printReport = useCallback(async (
    reportData: {
      shift: 'morning' | 'afternoon' | 'evening' | 'all';
      cashierCode: string;
      menuFoodTotal: number;
      menuDrinksTotal: number;
      customFoodTotal: number;
      customDrinksTotal: number;
      grandTotal: number;
    },
    fallbackPrintFn?: () => void
  ): Promise<boolean> => {
    if (isDesktop && printerReady) {
      // On desktop with printer ready, print directly to thermal printer
      const success = await printReportTauri(reportData);
      if (success) {
        console.log('Report printed directly to thermal printer');
        return true;
      }
    }
    
    // Fallback to browser print if thermal fails or no printer connected
    if (fallbackPrintFn) {
      console.log('Using browser print fallback');
      fallbackPrintFn();
      return true;
    }
    return false;
  }, [isDesktop, printerReady]);

  return {
    isDesktop,
    printerReady,
    printReceipt,
    printReport,
  };
}

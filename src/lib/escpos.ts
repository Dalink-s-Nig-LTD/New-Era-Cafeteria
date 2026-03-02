/**
 * ESC/POS Command Builder for Xprinter M804 (80mm thermal printer)
 * This generates raw ESC/POS commands as byte arrays
 */

// ESC/POS Commands
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Text alignment
const ALIGN_LEFT = 0x00;
const ALIGN_CENTER = 0x01;
const ALIGN_RIGHT = 0x02;

// Text emphasis
const EMPHASIS_ON = 0x01;
const EMPHASIS_OFF = 0x00;

// Text size (width x height multiplier: 0x00 = 1x, 0x10 = 2x width, 0x01 = 2x height, 0x11 = 2x both)
const TEXT_NORMAL = 0x00;
const TEXT_DOUBLE_HEIGHT = 0x01;
const TEXT_DOUBLE_WIDTH = 0x10;
const TEXT_DOUBLE = 0x11;

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReceiptData {
  orderNumber: string;
  date: string;
  time: string;
  paymentMethod: string;
  items: ReceiptItem[];
  total: number;
  type?: 'food' | 'drinks' | 'all';
}

export interface SpecialOrderReceiptData {
  department: string;
  staffName: string;
  quantity: number;
  itemDescription: string;
  pricePerPack: number;
  total: number;
  deliveredBy: string;
  date: string; // formatted date string
  paymentStatus?: "paid" | "pending";
}

export interface ReportData {
  shift: string;
  cashierCode: string;
  date: string;
  time: string;
  menuFoodTotal: number;
  menuDrinksTotal: number;
  customFoodTotal: number;
  customDrinksTotal: number;
  grandTotal: number;
}

class ESCPOSBuilder {
  private buffer: number[] = [];

  // Initialize printer
  init(): this {
    this.buffer.push(ESC, 0x40); // ESC @ - Initialize
    return this;
  }

  // Set text alignment
  align(alignment: 'left' | 'center' | 'right'): this {
    const alignCode = alignment === 'center' ? ALIGN_CENTER : alignment === 'right' ? ALIGN_RIGHT : ALIGN_LEFT;
    this.buffer.push(ESC, 0x61, alignCode); // ESC a n
    return this;
  }

  // Set bold text
  bold(on: boolean): this {
    this.buffer.push(ESC, 0x45, on ? EMPHASIS_ON : EMPHASIS_OFF); // ESC E n
    return this;
  }

  // Double-strike mode (prints each line twice for darker output)
  doubleStrike(on: boolean): this {
    this.buffer.push(ESC, 0x47, on ? 0x01 : 0x00); // ESC G n
    return this;
  }

  // Set print density (0-8, default ~4, 8 = darkest)
  printDensity(level: number = 8): this {
    const clamped = Math.max(0, Math.min(8, level));
    this.buffer.push(GS, 0x28, 0x4B, 0x02, 0x00, 0x31, clamped); // GS ( K 2 0 49 n
    return this;
  }

  // Set text size
  textSize(width: 1 | 2 = 1, height: 1 | 2 = 1): this {
    const size = ((width - 1) << 4) | (height - 1);
    this.buffer.push(GS, 0x21, size); // GS ! n
    return this;
  }

  // Print text
  text(str: string): this {
    // Convert string to bytes (ASCII/Latin-1)
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      // Handle Naira symbol (₦) - replace with 'N' for basic printers
      if (charCode === 0x20A6) {
        this.buffer.push(0x4E); // 'N'
      } else if (charCode > 255) {
        // Replace unsupported characters with ?
        this.buffer.push(0x3F);
      } else {
        this.buffer.push(charCode);
      }
    }
    return this;
  }

  // New line
  newLine(count: number = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  // Print dashed line (for 80mm paper, ~48 chars)
  dashedLine(): this {
    this.text('-'.repeat(48));
    this.newLine();
    return this;
  }

  // Print a line with left and right text
  lineLeftRight(left: string, right: string, width: number = 48): this {
    const spaces = width - left.length - right.length;
    if (spaces > 0) {
      this.text(left + ' '.repeat(spaces) + right);
    } else {
      this.text(left.substring(0, width - right.length - 1) + ' ' + right);
    }
    this.newLine();
    return this;
  }

  // Feed paper and cut
  cut(): this {
    this.newLine(3);
    this.buffer.push(GS, 0x56, 0x00); // GS V 0 - Full cut
    return this;
  }

  // Partial cut
  partialCut(): this {
    this.newLine(3);
    this.buffer.push(GS, 0x56, 0x01); // GS V 1 - Partial cut
    return this;
  }

  // Open cash drawer
  openCashDrawer(): this {
    this.buffer.push(ESC, 0x70, 0x00, 0x19, 0xFA); // ESC p 0 25 250
    return this;
  }

  // Get the buffer as Uint8Array
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  // Get buffer as array (for JSON serialization to Tauri)
  toArray(): number[] {
    return [...this.buffer];
  }
}

/**
 * Format a number as currency (without symbol for ESC/POS)
 */
function formatCurrency(amount: number): string {
  return 'N' + Math.round(amount).toLocaleString();
}

/**
 * Build receipt ESC/POS commands
 */
export function buildReceiptCommands(data: ReceiptData): number[] {
  const builder = new ESCPOSBuilder();
  
  builder
    .init()
    .doubleStrike(true)
    .printDensity(8)
    // Header
    .align('center')
    .bold(true)
    .textSize(2, 2)
    .text('New Era Cafeteria')
    .newLine()
    .textSize(1, 1)
    .bold(false)
    .text("Redeemer's University, Ede")
    .newLine()
    .text('Osun State, Nigeria')
    .newLine(2)
    
    // Order info
    .align('left')
    .dashedLine()
    .lineLeftRight('Order No:', data.orderNumber)
    .lineLeftRight('Date:', data.date)
    .lineLeftRight('Time:', data.time)
    .lineLeftRight('Payment:', data.paymentMethod)
    .dashedLine()
    
    // Items header
    .bold(true)
    .lineLeftRight('ITEM', 'AMOUNT')
    .bold(false)
    .dashedLine();
  
  // Items
  data.items.forEach(item => {
    const itemText = `${item.quantity}x ${item.name}`;
    const priceText = formatCurrency(item.price * item.quantity);
    builder.lineLeftRight(itemText, priceText);
  });
  
  builder
    .dashedLine()
    // Total
    .bold(true)
    .textSize(1, 2)
    .lineLeftRight('TOTAL', formatCurrency(data.total))
    .textSize(1, 1)
    .bold(false)
    .dashedLine()
    
    // Footer
    .align('center')
    .newLine()
    .bold(true)
    .text('Thank you for your patronage!')
    .newLine()
    .bold(false)
    .text('Please come again')
    .newLine(2)
    
    // Cut
    .partialCut();
  
  return builder.toArray();
}

/**
 * Build daily sales report ESC/POS commands
 */
export function buildReportCommands(data: ReportData): number[] {
  const builder = new ESCPOSBuilder();
  
  builder
    .init()
    .doubleStrike(true)
    .printDensity(8)
    // Header
    .align('center')
    .bold(true)
    .textSize(2, 2)
    .text('NEW ERA CAFETERIA')
    .newLine()
    .textSize(1, 1)
    .text('DAILY SALES REPORT')
    .newLine(2)
    
    // Shift info
    .bold(true)
    .text(data.shift)
    .newLine()
    .bold(false)
    .text(`(${data.cashierCode})`)
    .newLine()
    .text(`${data.date} ${data.time}`)
    .newLine(2)
    
    // Summary
    .align('left')
    .dashedLine()
    .bold(true)
    .align('center')
    .text('SALES SUMMARY')
    .newLine()
    .align('left')
    .dashedLine()
    .bold(false)
    
    .lineLeftRight('Menu Foods:', formatCurrency(data.menuFoodTotal))
    .lineLeftRight('Menu Drinks:', formatCurrency(data.menuDrinksTotal))
    .dashedLine()
    .lineLeftRight('Custom Drinks:', formatCurrency(data.customDrinksTotal))
    .lineLeftRight('Custom Foods:', formatCurrency(data.customFoodTotal))
    .dashedLine()
    
    // Grand total
    .bold(true)
    .textSize(1, 2)
    .lineLeftRight('GRAND TOTAL:', formatCurrency(data.grandTotal))
    .textSize(1, 1)
    .bold(false)
    .dashedLine()
    
    // Footer
    .align('center')
    .newLine()
    .text("Redeemer's University, Ede")
    .newLine()
    .text('Thank you for your business!')
    .newLine(2)
    
    // Cut
    .cut();
  
  return builder.toArray();
}

/**
 * Build special order delivery receipt ESC/POS commands
 */
export function buildSpecialOrderReceiptCommands(data: SpecialOrderReceiptData): number[] {
  const builder = new ESCPOSBuilder();
  
  builder
    .init()
    .doubleStrike(true)
    .printDensity(8)
    // Header
    .align('center')
    .bold(true)
    .textSize(2, 2)
    .text('New Era Cafeteria')
    .newLine()
    .textSize(1, 1)
    .bold(false)
    .text("Redeemer's University, Ede,")
    .newLine()
    .text('Osun State, Nigeria')
    .newLine()
    .dashedLine()
    .bold(true)
    .align('center')
    .text('SPECIAL ORDER DELIVERY RECEIPT')
    .newLine()
    .bold(false)
    .align('left')
    .dashedLine()
    .lineLeftRight('Department:', data.department)
    .lineLeftRight('Staff In Charge:', data.staffName)
    .dashedLine()
    .lineLeftRight('Quantity:', `${data.quantity} packs`)
    .lineLeftRight('Item:', data.itemDescription)
    .lineLeftRight('Price Per Pack:', formatCurrency(data.pricePerPack))
    .dashedLine()
    .bold(true)
    .textSize(1, 2)
    .lineLeftRight('TOTAL:', formatCurrency(data.total))
    .textSize(1, 1)
    .bold(false)
    .dashedLine()
    .lineLeftRight('Delivered By:', data.deliveredBy)
    .text('                    (New Era Cafeteria)')
    .newLine()
    .dashedLine()
    .newLine()
    .text('Received By: ________________________')
    .newLine()
    .lineLeftRight('Name:', data.staffName)
    .lineLeftRight('Date:', data.date)
    .newLine(2)
    .text('Delivered By: ________________________')
    .newLine()
    .lineLeftRight('Name:', data.deliveredBy)
    .lineLeftRight('Date:', data.date)
    .newLine()
    .dashedLine()
    .align('center')
    .bold(true)
    .text('Thank you for your business!')
    .bold(false)
    .newLine(2)
    .cut();
  
  return builder.toArray();
}

export { ESCPOSBuilder };

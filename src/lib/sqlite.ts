// SQLite database layer for Tauri desktop app
// Uses @tauri-apps/plugin-sql for native SQLite access

// Dynamic import to prevent bundling issues in production
let Database: any = null;
const loadDatabase = async () => {
  if (!Database) {
    const mod = await import("@tauri-apps/plugin-sql");
    Database = mod.default;
  }
  return Database;
};
import { Order } from "@/types/cafeteria";

export interface QueuedOrder {
  id: string;
  order: Order;
  status: "pending" | "syncing" | "synced" | "failed";
  attempts: number;
  lastAttempt?: number;
  createdAt: number;
  syncedAt?: number;
  errorMessage?: string;
  clientOrderId?: string;
}

interface OrderQueueRow {
  id: string;
  order_data: string;
  status: "pending" | "syncing" | "synced" | "failed";
  attempts: number;
  last_attempt?: number | null;
  created_at: number;
  synced_at?: number | null;
  error_message?: string | null;
  client_order_id?: string | null;
}

class SQLiteOrderDB {
  private db: any = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) {
      console.log("[SQLiteDB] Already initialized, skipping");
      return;
    }
    if (this.initPromise) {
      console.log("[SQLiteDB] Initialization in progress, waiting...");
      return this.initPromise;
    }

    console.log("[SQLiteDB] Starting initialization...");
    this.initPromise = (async () => {
      try {
        console.log("[SQLiteDB] Loading database: sqlite:orders.db");
        const DB = await loadDatabase();
        this.db = await DB.load("sqlite:orders.db");
        console.log("[SQLiteDB] Database loaded successfully");
        
        console.log("[SQLiteDB] Creating order_queue table if not exists...");
        await this.db.execute(`CREATE TABLE IF NOT EXISTS order_queue (
          id TEXT PRIMARY KEY,
          order_data TEXT,
          status TEXT,
          attempts INTEGER,
          created_at INTEGER,
          last_attempt INTEGER,
          synced_at INTEGER,
          error_message TEXT,
          client_order_id TEXT
        )`);
        console.log("✅ SQLite database and order_queue table initialized");

        // Migration: add client_order_id column to existing databases
        try {
          await this.db.execute(`ALTER TABLE order_queue ADD COLUMN client_order_id TEXT`);
          console.log("[SQLiteDB] Migration: client_order_id column added");
        } catch {
          // Column already exists — safe to ignore
        }

        // Create special_order_queue table
        await this.db.execute(`CREATE TABLE IF NOT EXISTS special_order_queue (
          id TEXT PRIMARY KEY,
          order_data TEXT,
          status TEXT,
          attempts INTEGER,
          created_at INTEGER,
          last_attempt INTEGER,
          synced_at INTEGER,
          error_message TEXT
        )`);
        console.log("✅ special_order_queue table initialized");

        // Create customer_orders table for self-order kiosk
        await this.db.execute(`CREATE TABLE IF NOT EXISTS customer_orders (
          id TEXT PRIMARY KEY,
          barcode TEXT NOT NULL,
          customer_name TEXT,
          items TEXT NOT NULL,
          total REAL NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'customer_balance',
          payment_status TEXT NOT NULL DEFAULT 'paid',
          created_at INTEGER NOT NULL,
          synced INTEGER NOT NULL DEFAULT 1
        )`);
        console.log("✅ customer_orders table initialized");
      } catch (error) {
        console.error("❌ Failed to initialize SQLite:", error);
        this.initPromise = null;
        this.db = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  private async ensureDB(): Promise<any> {
    if (!this.db) {
      console.log("[SQLiteDB] Database not initialized, initializing now...");
      await this.init();
    }
    if (!this.db) {
      throw new Error("SQLite database not initialized");
    }
    return this.db;
  }

  async addOrder(order: Order): Promise<string> {
    const db = await this.ensureDB();

    // Use the order's own createdAt to ensure timestamp consistency with backend calls
    const createdAt = (order as any).createdAt || Date.now();
    const clientOrderId: string | undefined = (order as any).clientOrderId;

    // Dedup: if this clientOrderId is already in the queue, return the existing entry
    if (clientOrderId) {
      const existing: OrderQueueRow[] = await db.select(
        `SELECT id FROM order_queue WHERE client_order_id = $1 LIMIT 1`,
        [clientOrderId]
      );
      if (existing.length > 0) {
        console.log(`[SQLiteDB] Dedup: order with clientOrderId ${clientOrderId} already queued as ${existing[0].id}`);
        return existing[0].id;
      }
    }

    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[SQLiteDB] Adding order ${queueId} to queue (createdAt: ${createdAt}, clientOrderId: ${clientOrderId ?? 'none'})`);
    await db.execute(
      `INSERT INTO order_queue (id, order_data, status, attempts, created_at, client_order_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [queueId, JSON.stringify(order), "pending", 0, createdAt, clientOrderId ?? null]
    );

    console.log(`📦 Order ${queueId} saved to SQLite`);
    return queueId;
  }

  async getAllPendingOrders(): Promise<QueuedOrder[]> {
    const db = await this.ensureDB();
    console.log("[SQLiteDB] Fetching all pending orders...");
    const rows: OrderQueueRow[] = await db.select(
      `SELECT * FROM order_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`
    );

    console.log(`[SQLiteDB] Found ${rows.length} pending orders`);
    return rows.map(this.rowToQueuedOrder);
  }

  async getAllOrders(): Promise<QueuedOrder[]> {
    const db = await this.ensureDB();
    console.log("[SQLiteDB] Fetching all orders...");
    const rows: OrderQueueRow[] = await db.select(
      `SELECT * FROM order_queue ORDER BY created_at DESC`
    );

    console.log(`[SQLiteDB] Found ${rows.length} total orders`);
    return rows.map(this.rowToQueuedOrder);
  }

  async getOrder(queueId: string): Promise<QueuedOrder | null> {
    const db = await this.ensureDB();
    const rows: OrderQueueRow[] = await db.select(
      `SELECT * FROM order_queue WHERE id = $1`,
      [queueId]
    );

    return rows.length > 0 ? this.rowToQueuedOrder(rows[0]) : null;
  }

  async updateStatus(
    queueId: string,
    status: QueuedOrder["status"],
    errorMessage?: string
  ): Promise<void> {
    const db = await this.ensureDB();
    console.log(`[SQLiteDB] Updating order ${queueId} status to: ${status}`);
    await db.execute(
      `UPDATE order_queue SET status = $1, last_attempt = $2, error_message = $3, 
       synced_at = CASE WHEN $1 = 'synced' THEN $2 ELSE synced_at END
       WHERE id = $4`,
      [status, Date.now(), errorMessage || null, queueId]
    );
  }

  async incrementAttempt(queueId: string): Promise<void> {
    const db = await this.ensureDB();
    await db.execute(
      `UPDATE order_queue SET attempts = attempts + 1, last_attempt = $1 WHERE id = $2`,
      [Date.now(), queueId]
    );
  }

  async removeOrder(queueId: string): Promise<void> {
    const db = await this.ensureDB();
    await db.execute(`DELETE FROM order_queue WHERE id = $1`, [queueId]);
  }

  async removeSyncedOrders(): Promise<number> {
    const db = await this.ensureDB();
    const result = await db.execute(
      `DELETE FROM order_queue WHERE status = 'synced'`
    );
    return result.rowsAffected;
  }

  async getQueueCount(): Promise<number> {
    const db = await this.ensureDB();
    const rows: { count: number }[] = await db.select(
      `SELECT COUNT(*) as count FROM order_queue WHERE status IN ('pending', 'failed')`
    );
    const count = rows[0]?.count || 0;
    console.log(`[SQLiteDB] Queue count: ${count}`);
    return count;
  }

  async getSyncStats(): Promise<{
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    total: number;
  }> {
    const db = await this.ensureDB();
    const rows: { status: string; count: number }[] = await db.select(
      `SELECT status, COUNT(*) as count FROM order_queue GROUP BY status`
    );

    const stats = { pending: 0, syncing: 0, synced: 0, failed: 0, total: 0 };
    rows.forEach((row) => {
      const status = row.status as keyof typeof stats;
      if (status in stats) {
        stats[status] = row.count;
      }
      stats.total += row.count;
    });
    
    console.log("[SQLiteDB] Sync stats:", stats);
    return stats;
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    console.log("[SQLiteDB] Clearing all orders from queue");
    await db.execute(`DELETE FROM order_queue`);
  }

  // Special order queue methods
  async addSpecialOrder(data: Record<string, unknown>): Promise<string> {
    const db = await this.ensureDB();
    const queueId = `special_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.execute(
      `INSERT INTO special_order_queue (id, order_data, status, attempts, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [queueId, JSON.stringify(data), "pending", 0, Date.now()]
    );
    console.log(`📦 Special order ${queueId} saved to SQLite`);
    return queueId;
  }

  async getAllPendingSpecialOrders(): Promise<{ id: string; data: Record<string, unknown>; status: string }[]> {
    const db = await this.ensureDB();
    const rows: OrderQueueRow[] = await db.select(
      `SELECT * FROM special_order_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`
    );
    return rows.map(row => ({
      id: row.id,
      data: JSON.parse(row.order_data),
      status: row.status,
    }));
  }

  async updateSpecialOrderStatus(queueId: string, status: string, errorMessage?: string): Promise<void> {
    const db = await this.ensureDB();
    await db.execute(
      `UPDATE special_order_queue SET status = $1, last_attempt = $2, error_message = $3,
       synced_at = CASE WHEN $1 = 'synced' THEN $2 ELSE synced_at END
       WHERE id = $4`,
      [status, Date.now(), errorMessage || null, queueId]
    );
  }

  // ---- Customer order methods ----

  async addCustomerOrder(order: {
    id: string;
    barcode: string;
    customerName: string;
    items: { name: string; price: number; quantity: number; category?: string }[];
    total: number;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: number;
  }): Promise<void> {
    const db = await this.ensureDB();
    await db.execute(
      `INSERT INTO customer_orders (id, barcode, customer_name, items, total, payment_method, payment_status, created_at, synced) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [order.id, order.barcode, order.customerName, JSON.stringify(order.items), order.total, order.paymentMethod, order.paymentStatus, order.createdAt, 1]
    );
    console.log(`📦 Customer order ${order.id} saved to SQLite`);
  }

  async getCustomerOrders(barcode?: string): Promise<{
    id: string;
    barcode: string;
    customerName: string;
    items: { name: string; price: number; quantity: number; category?: string }[];
    total: number;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: number;
  }[]> {
    const db = await this.ensureDB();
    const query = barcode
      ? `SELECT * FROM customer_orders WHERE barcode = $1 ORDER BY created_at DESC`
      : `SELECT * FROM customer_orders ORDER BY created_at DESC`;
    const params = barcode ? [barcode] : [];
    const rows: { id: string; barcode: string; customer_name: string; items: string; total: number; payment_method: string; payment_status: string; created_at: number }[] = await db.select(query, params);
    return rows.map(r => ({
      id: r.id,
      barcode: r.barcode,
      customerName: r.customer_name,
      items: JSON.parse(r.items),
      total: r.total,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      createdAt: r.created_at,
    }));
  }

  private rowToQueuedOrder(row: OrderQueueRow): QueuedOrder {
    return {
      id: row.id,
      order: JSON.parse(row.order_data),
      status: row.status,
      attempts: row.attempts,
      lastAttempt: row.last_attempt || undefined,
      createdAt: row.created_at,
      syncedAt: row.synced_at || undefined,
      errorMessage: row.error_message || undefined,
      clientOrderId: row.client_order_id || undefined,
    };
  }
}

// Function to check if running in Tauri
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Single lazy-initialized singleton instance
let _sqliteDB: SQLiteOrderDB | null = null;

export function getSqliteDB(): SQLiteOrderDB | null {
  if (!isTauriEnvironment()) return null;
  if (!_sqliteDB) {
    _sqliteDB = new SQLiteOrderDB();
  }
  return _sqliteDB;
}

// For backward compatibility - use lazy getter to avoid creating duplicate instances
export const sqliteDB: SQLiteOrderDB | null = isTauriEnvironment() ? (() => {
  return getSqliteDB();
})() : null;

console.log(`[SQLiteDB Module] Loaded. Tauri environment: ${isTauriEnvironment()}`);

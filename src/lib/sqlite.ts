// SQLite database layer for Tauri desktop app
// Uses @tauri-apps/plugin-sql for native SQLite access

// Dynamic import to prevent bundling issues in production
interface TauriSQLDatabase {
  load(dbName: string): Promise<TauriDB>;
}

interface TauriDB {
  execute(sql: string, params?: (string | number | null)[]): Promise<{ rowsAffected: number }>;
  select(sql: string, params?: (string | number | null)[]): Promise<Record<string, unknown>[]>;
}

let Database: TauriSQLDatabase | null = null;
const loadDatabase = async (): Promise<TauriSQLDatabase> => {
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

interface CachedMenuItemRow {
  _id: string;
  name: string;
  category: string;
  price: number;
  image?: string | null;
  available: number;
  cached_at: number;
}

interface CachedAccessCodeRow {
  code: string;
  shift?: "morning" | "afternoon" | "evening" | null;
  is_active: number;
  cached_at: number;
}

interface CachedCustomerRow {
  _id: string;
  customer_id: string;
  barcode: string;
  first_name: string;
  last_name: string;
  department: string;
  class_level: string;
  photo?: string | null;
  balance: number;
  is_active: number;
  expiry_date?: number | null;
  created_at: number;
  updated_at: number;
  cached_at: number;
}

interface CachedOrderRow {
  _id: string;
  order_data: string;
  created_at: number;
  cached_at: number;
}

class SQLiteOrderDB {
  private db: TauriDB | null = null;
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

        await this.db.execute(`CREATE TABLE IF NOT EXISTS menu_items_cache (
          _id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price REAL NOT NULL,
          image TEXT,
          available INTEGER NOT NULL DEFAULT 1,
          cached_at INTEGER NOT NULL
        )`);
        console.log("✅ menu_items_cache table initialized");

        await this.db.execute(`CREATE TABLE IF NOT EXISTS access_codes_cache (
          code TEXT PRIMARY KEY,
          shift TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          cached_at INTEGER NOT NULL
        )`);
        console.log("✅ access_codes_cache table initialized");

        await this.db.execute(`CREATE TABLE IF NOT EXISTS customers_cache (
          _id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          barcode TEXT UNIQUE NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          department TEXT NOT NULL,
          class_level TEXT NOT NULL,
          photo TEXT,
          balance REAL NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          expiry_date INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          cached_at INTEGER NOT NULL
        )`);
        console.log("✅ customers_cache table initialized");

        await this.db.execute(`CREATE TABLE IF NOT EXISTS orders_cache (
          _id TEXT PRIMARY KEY,
          order_data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          cached_at INTEGER NOT NULL
        )`);
        console.log("✅ orders_cache table initialized");

        await this.db.execute(`CREATE TABLE IF NOT EXISTS shift_settings_cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          cached_at INTEGER NOT NULL
        )`);
        console.log("✅ shift_settings_cache table initialized");

        await this.db.execute(`CREATE TABLE IF NOT EXISTS offline_sessions (
          session_id TEXT PRIMARY KEY,
          user_id TEXT,
          access_code TEXT,
          role TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          last_activity INTEGER NOT NULL
        )`);
        console.log("✅ offline_sessions table initialized");

        await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_offline_sessions_expires_at ON offline_sessions(expires_at)`);
        console.log("✅ offline_sessions index created");
      } catch (error) {
        console.error("❌ Failed to initialize SQLite:", error);
        this.initPromise = null;
        this.db = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  private async ensureDB(): Promise<TauriDB> {
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
    const createdAt = order.createdAt || Date.now();
    const clientOrderId = order.clientOrderId;

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

  async cacheMenuItems(
    items: Array<{
      _id: string;
      name: string;
      category: string;
      price: number;
      image?: string;
      available: boolean;
    }>,
  ): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    await db.execute(`DELETE FROM menu_items_cache`);
    for (const item of items) {
      await db.execute(
        `INSERT OR REPLACE INTO menu_items_cache (_id, name, category, price, image, available, cached_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item._id,
          item.name,
          item.category,
          item.price,
          item.image || null,
          item.available ? 1 : 0,
          now,
        ],
      );
    }
  }

  async getCachedMenuItems(): Promise<
    Array<{
      _id: string;
      name: string;
      category: string;
      price: number;
      image?: string;
      available: boolean;
    }>
  > {
    const db = await this.ensureDB();
    const rows: CachedMenuItemRow[] = await db.select(
      `SELECT _id, name, category, price, image, available, cached_at FROM menu_items_cache ORDER BY name ASC`,
    );
    return rows.map((row) => ({
      _id: row._id,
      name: row.name,
      category: row.category,
      price: row.price,
      image: row.image || undefined,
      available: !!row.available,
    }));
  }

  async cacheAccessCodes(
    codes: Array<{
      code: string;
      shift?: "morning" | "afternoon" | "evening";
      isActive: boolean;
    }>,
  ): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    await db.execute(`DELETE FROM access_codes_cache`);
    for (const code of codes) {
      await db.execute(
        `INSERT OR REPLACE INTO access_codes_cache (code, shift, is_active, cached_at) VALUES ($1, $2, $3, $4)`,
        [code.code, code.shift || null, code.isActive ? 1 : 0, now],
      );
    }
  }

  async getCachedAccessCodes(): Promise<
    Array<{
      code: string;
      shift?: "morning" | "afternoon" | "evening";
      isActive: boolean;
    }>
  > {
    const db = await this.ensureDB();
    const rows: CachedAccessCodeRow[] = await db.select(
      `SELECT code, shift, is_active, cached_at FROM access_codes_cache ORDER BY code ASC`,
    );
    return rows.map((row) => ({
      code: row.code,
      shift: row.shift || undefined,
      isActive: !!row.is_active,
    }));
  }

  async cacheCustomers(
    customers: Array<{
      _id: string;
      customerId: string;
      barcodeData: string;
      firstName: string;
      lastName: string;
      department: string;
      classLevel: string;
      photo?: string;
      balance: number;
      isActive: boolean;
      expiryDate?: number;
      createdAt: number;
      updatedAt: number;
    }>,
  ): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    await db.execute(`DELETE FROM customers_cache`);
    for (const customer of customers) {
      await db.execute(
        `INSERT OR REPLACE INTO customers_cache (_id, customer_id, barcode, first_name, last_name, department, class_level, photo, balance, is_active, expiry_date, created_at, updated_at, cached_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          customer._id,
          customer.customerId,
          customer.barcodeData,
          customer.firstName,
          customer.lastName,
          customer.department,
          customer.classLevel,
          customer.photo || null,
          customer.balance,
          customer.isActive ? 1 : 0,
          customer.expiryDate || null,
          customer.createdAt,
          customer.updatedAt,
          now,
        ],
      );
    }
  }

  async getCachedCustomers(): Promise<
    Array<{
      _id: string;
      customerId: string;
      barcodeData: string;
      firstName: string;
      lastName: string;
      department: string;
      classLevel: string;
      photo?: string;
      balance: number;
      isActive: boolean;
      expiryDate?: number;
      createdAt: number;
      updatedAt: number;
    }>
  > {
    const db = await this.ensureDB();
    const rows: CachedCustomerRow[] = await db.select(
      `SELECT _id, customer_id, barcode, first_name, last_name, department, class_level, photo, balance, is_active, expiry_date, created_at, updated_at, cached_at FROM customers_cache ORDER BY first_name ASC, last_name ASC`,
    );

    return rows.map((row) => ({
      _id: row._id,
      customerId: row.customer_id,
      barcodeData: row.barcode,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      classLevel: row.class_level,
      photo: row.photo || undefined,
      balance: row.balance,
      isActive: !!row.is_active,
      expiryDate: row.expiry_date || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getCachedCustomerByBarcode(barcodeData: string): Promise<{
    _id: string;
    customerId: string;
    barcodeData: string;
    firstName: string;
    lastName: string;
    department: string;
    classLevel: string;
    photo?: string;
    balance: number;
    isActive: boolean;
    expiryDate?: number;
    createdAt: number;
    updatedAt: number;
  } | null> {
    const db = await this.ensureDB();
    const rows: CachedCustomerRow[] = await db.select(
      `SELECT _id, customer_id, barcode, first_name, last_name, department, class_level, photo, balance, is_active, expiry_date, created_at, updated_at, cached_at FROM customers_cache WHERE barcode = $1 LIMIT 1`,
      [barcodeData],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      _id: row._id,
      customerId: row.customer_id,
      barcodeData: row.barcode,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      classLevel: row.class_level,
      photo: row.photo || undefined,
      balance: row.balance,
      isActive: !!row.is_active,
      expiryDate: row.expiry_date || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async cacheOrders(
    orders: Array<{
      _id: string;
      items: Array<{
        menuItemId?: string;
        name: string;
        price: number;
        quantity: number;
        category?: string;
        isCustom?: boolean;
      }>;
      total: number;
      paymentMethod: string;
      status: string;
      orderType?: string;
      cashierCode: string;
      cashierName?: string;
      clientOrderId?: string;
      createdAt: number;
    }>,
  ): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    await db.execute(`DELETE FROM orders_cache`);
    for (const order of orders) {
      await db.execute(
        `INSERT OR REPLACE INTO orders_cache (_id, order_data, created_at, cached_at) VALUES ($1, $2, $3, $4)`,
        [order._id, JSON.stringify(order), order.createdAt, now],
      );
    }
  }

  async getCachedOrders(): Promise<
    Array<{
      _id: string;
      items: Array<{
        menuItemId?: string;
        name: string;
        price: number;
        quantity: number;
        category?: string;
        isCustom?: boolean;
      }>;
      total: number;
      paymentMethod: string;
      status: string;
      orderType?: string;
      cashierCode: string;
      cashierName?: string;
      clientOrderId?: string;
      createdAt: number;
    }>
  > {
    const db = await this.ensureDB();
    const rows: CachedOrderRow[] = await db.select(
      `SELECT _id, order_data, created_at, cached_at FROM orders_cache ORDER BY created_at DESC`,
    );

    return rows.map((row) => JSON.parse(row.order_data));
  }

  async getCachedOrdersByRange(
    startDate: number,
    endDate: number,
  ): Promise<
    Array<{
      _id: string;
      items: Array<{
        menuItemId?: string;
        name: string;
        price: number;
        quantity: number;
        category?: string;
        isCustom?: boolean;
      }>;
      total: number;
      paymentMethod: string;
      status: string;
      orderType?: string;
      cashierCode: string;
      cashierName?: string;
      clientOrderId?: string;
      createdAt: number;
    }>
  > {
    const db = await this.ensureDB();
    const rows: CachedOrderRow[] = await db.select(
      `SELECT _id, order_data, created_at, cached_at FROM orders_cache WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC`,
      [startDate, endDate],
    );

    return rows.map((row) => JSON.parse(row.order_data));
  }

  // ---- Query / lookup methods ----

  async getMenuItemByName(name: string): Promise<{
    _id: string;
    name: string;
    category: string;
    price: number;
    image?: string;
    available: boolean;
  } | null> {
    const db = await this.ensureDB();
    const rows: CachedMenuItemRow[] = await db.select(
      `SELECT _id, name, category, price, image, available FROM menu_items_cache WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [name],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      _id: row._id,
      name: row.name,
      category: row.category,
      price: row.price,
      image: row.image || undefined,
      available: !!row.available,
    };
  }

  async getMenuItemsByCategory(category: string): Promise<
    Array<{
      _id: string;
      name: string;
      category: string;
      price: number;
      image?: string;
      available: boolean;
    }>
  > {
    const db = await this.ensureDB();
    const rows: CachedMenuItemRow[] = await db.select(
      `SELECT _id, name, category, price, image, available FROM menu_items_cache WHERE category = $1 ORDER BY name ASC`,
      [category],
    );
    return rows.map((row) => ({
      _id: row._id,
      name: row.name,
      category: row.category,
      price: row.price,
      image: row.image || undefined,
      available: !!row.available,
    }));
  }

  async getMenuCategories(): Promise<string[]> {
    const db = await this.ensureDB();
    const rows: { category: string }[] = await db.select(
      `SELECT DISTINCT category FROM menu_items_cache ORDER BY category ASC`,
    );
    return rows.map((row) => row.category);
  }

  async validateAccessCode(code: string): Promise<boolean> {
    const db = await this.ensureDB();
    const rows: CachedAccessCodeRow[] = await db.select(
      `SELECT code, is_active FROM access_codes_cache WHERE code = $1 LIMIT 1`,
      [code],
    );
    const row = rows[0];
    return row ? !!row.is_active : false;
  }

  async getAccessCodeShift(code: string): Promise<"morning" | "afternoon" | "evening" | null> {
    const db = await this.ensureDB();
    const rows: CachedAccessCodeRow[] = await db.select(
      `SELECT shift, is_active FROM access_codes_cache WHERE code = $1 AND is_active = 1 LIMIT 1`,
      [code],
    );
    const row = rows[0];
    if (!row) return null;
    return (row.shift as "morning" | "afternoon" | "evening") || null;
  }

  async getCustomerByCustomerId(customerId: string): Promise<{
    _id: string;
    customerId: string;
    barcodeData: string;
    firstName: string;
    lastName: string;
    department: string;
    classLevel: string;
    photo?: string;
    balance: number;
    isActive: boolean;
    expiryDate?: number;
    createdAt: number;
    updatedAt: number;
  } | null> {
    const db = await this.ensureDB();
    const rows: CachedCustomerRow[] = await db.select(
      `SELECT _id, customer_id, barcode, first_name, last_name, department, class_level, photo, balance, is_active, expiry_date, created_at, updated_at FROM customers_cache WHERE customer_id = $1 LIMIT 1`,
      [customerId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      _id: row._id,
      customerId: row.customer_id,
      barcodeData: row.barcode,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      classLevel: row.class_level,
      photo: row.photo || undefined,
      balance: row.balance,
      isActive: !!row.is_active,
      expiryDate: row.expiry_date || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async searchCustomers(query: string): Promise<
    Array<{
      _id: string;
      customerId: string;
      barcodeData: string;
      firstName: string;
      lastName: string;
      department: string;
      classLevel: string;
      photo?: string;
      balance: number;
      isActive: boolean;
      expiryDate?: number;
      createdAt: number;
      updatedAt: number;
    }>
  > {
    const db = await this.ensureDB();
    const searchTerm = `%${query}%`;
    const rows: CachedCustomerRow[] = await db.select(
      `SELECT _id, customer_id, barcode, first_name, last_name, department, class_level, photo, balance, is_active, expiry_date, created_at, updated_at 
       FROM customers_cache 
       WHERE LOWER(first_name) LIKE LOWER($1) OR LOWER(last_name) LIKE LOWER($1) OR LOWER(barcode) LIKE LOWER($1)
       ORDER BY first_name ASC, last_name ASC LIMIT 50`,
      [searchTerm],
    );
    return rows.map((row) => ({
      _id: row._id,
      customerId: row.customer_id,
      barcodeData: row.barcode,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      classLevel: row.class_level,
      photo: row.photo || undefined,
      balance: row.balance,
      isActive: !!row.is_active,
      expiryDate: row.expiry_date || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // ---- Shift settings cache ----

  async cacheShiftSettings(shifts: string[]): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();
    await db.execute(`DELETE FROM shift_settings_cache`);
    await db.execute(
      `INSERT OR REPLACE INTO shift_settings_cache (key, value, cached_at) VALUES ($1, $2, $3)`,
      ["enabled_shifts", JSON.stringify(shifts), now],
    );
    console.log(`[SQLiteDB] Cached shift settings: ${shifts.join(", ")}`);
  }

  async getCachedShiftSettings(): Promise<string[]> {
    const db = await this.ensureDB();
    const rows: { value: string }[] = await db.select(
      `SELECT value FROM shift_settings_cache WHERE key = $1`,
      ["enabled_shifts"],
    );
    if (rows.length === 0) return [];
    try {
      return JSON.parse(rows[0].value);
    } catch {
      return [];
    }
  }

  // ---- Comprehensive order caching for admin dashboard ----

  async getLastCachedOrderTimestamp(): Promise<number | null> {
    const db = await this.ensureDB();
    const rows: { created_at: number }[] = await db.select(
      `SELECT created_at FROM orders_cache ORDER BY created_at DESC LIMIT 1`,
    );
    return rows.length > 0 ? rows[0].created_at : null;
  }

  async getCachedOrdersCount(): Promise<number> {
    const db = await this.ensureDB();
    const rows: { count: number }[] = await db.select(
      `SELECT COUNT(*) as count FROM orders_cache`,
    );
    return rows[0]?.count || 0;
  }

  async clearAllCachedOrders(): Promise<void> {
    const db = await this.ensureDB();
    await db.execute(`DELETE FROM orders_cache`);
    console.log("[SQLiteDB] Cleared all cached orders");
  }

  async cacheOrdersBatch(
    orders: Array<{
      _id: string;
      items: Array<{
        menuItemId?: string;
        name: string;
        price: number;
        quantity: number;
        category?: string;
        isCustom?: boolean;
      }>;
      total: number;
      paymentMethod: string;
      status: string;
      orderType?: string;
      cashierCode: string;
      cashierName?: string;
      clientOrderId?: string;
      createdAt: number;
    }>,
  ): Promise<void> {
    if (orders.length === 0) return;
    const db = await this.ensureDB();
    const now = Date.now();

    // Check for existing orders and skip duplicates (by _id)
    const existingIds = new Set<string>();
    if (orders.length > 0) {
      const idList = orders.map((o) => `'${o._id}'`).join(",");
      const existing: { _id: string }[] = await db.select(
        `SELECT _id FROM orders_cache WHERE _id IN (${idList})`,
      );
      existing.forEach((e) => existingIds.add(e._id));
    }

    for (const order of orders) {
      if (!existingIds.has(order._id)) {
        await db.execute(
          `INSERT OR REPLACE INTO orders_cache (_id, order_data, created_at, cached_at) VALUES ($1, $2, $3, $4)`,
          [order._id, JSON.stringify(order), order.createdAt, now],
        );
      }
    }
    console.log(
      `[SQLiteDB] Cached ${orders.length - existingIds.size} new orders (${existingIds.size} duplicates skipped)`,
    );
  }

  async refreshAllCachedOrders(
    orders: Array<{
      _id: string;
      items: Array<{
        menuItemId?: string;
        name: string;
        price: number;
        quantity: number;
        category?: string;
        isCustom?: boolean;
      }>;
      total: number;
      paymentMethod: string;
      status: string;
      orderType?: string;
      cashierCode: string;
      cashierName?: string;
      clientOrderId?: string;
      createdAt: number;
    }>,
  ): Promise<void> {
    // This replaces all cached orders (atomic refresh)
    await this.cacheOrders(orders);
    console.log(`[SQLiteDB] Refreshed all cached orders (${orders.length} total)`);
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

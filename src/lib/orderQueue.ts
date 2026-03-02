// Order queue with SQLite backend for Tauri desktop, IndexedDB fallback for web
// Provides persistent storage for offline-first order management

import { Order } from "@/types/cafeteria";
import { sqliteDB, type QueuedOrder } from "@/lib/sqlite";

const DB_NAME = "NewEraCafeteriaDB";
const DB_VERSION = 1;
const STORE_NAME = "orderQueue";

// Re-export QueuedOrder type for backward compatibility
export type { QueuedOrder } from "@/lib/sqlite";

// IndexedDB fallback for web environment
class IndexedDBQueue {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("attempts", "attempts", { unique: false });
          store.createIndex("status", "status", { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("Failed to initialize IndexedDB");
    return this.db;
  }

  async addOrder(order: Order): Promise<string> {
    const db = await this.ensureDB();
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Use the order's existing createdAt/timestamp if provided, to keep timestamps consistent
    const orderCreatedAt = (order as any).createdAt || (order.timestamp instanceof Date ? order.timestamp.getTime() : Date.now());
    const queuedOrder: QueuedOrder = {
      id: queueId,
      order,
      status: "pending",
      attempts: 0,
      createdAt: orderCreatedAt,
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(queuedOrder);
      request.onsuccess = () => resolve(queueId);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllOrders(): Promise<QueuedOrder[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateStatus(queueId: string, status: QueuedOrder["status"], errorMessage?: string): Promise<void> {
    const db = await this.ensureDB();
    const order = await this.getOrder(queueId);
    if (!order) return;
    
    order.status = status;
    if (errorMessage) order.errorMessage = errorMessage;
    if (status === "synced") order.syncedAt = Date.now();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const request = tx.objectStore(STORE_NAME).put(order);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateAttempt(queueId: string): Promise<void> {
    const db = await this.ensureDB();
    const order = await this.getOrder(queueId);
    if (!order) return;
    order.attempts += 1;
    order.lastAttempt = Date.now();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const request = tx.objectStore(STORE_NAME).put(order);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getOrder(queueId: string): Promise<QueuedOrder | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readonly");
      const request = tx.objectStore(STORE_NAME).get(queueId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async removeOrder(queueId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const request = tx.objectStore(STORE_NAME).delete(queueId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getQueueCount(): Promise<number> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readonly");
      const request = tx.objectStore(STORE_NAME).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const request = tx.objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Unified order queue interface
class OrderQueue {
  private isTauri: boolean = false;
  private indexedDBFallback: IndexedDBQueue | null = null;
  private initialized: boolean = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Check if running in Tauri
    this.isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (this.isTauri && sqliteDB) {
      try {
        await sqliteDB.init();
        console.log("✅ Order queue using SQLite backend");
        this.initialized = true;
        return;
      } catch (error) {
        console.warn("⚠️ SQLite init failed, falling back to IndexedDB:", error);
      }
    }

    // Fallback to IndexedDB
    this.indexedDBFallback = new IndexedDBQueue();
    await this.indexedDBFallback.init();
    console.log("✅ Order queue using IndexedDB fallback");
    this.initialized = true;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  async addOrder(order: Order): Promise<string> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        return await sqliteDB.addOrder(order);
      } catch (error) {
        console.error("SQLite addOrder failed:", error);
        // Fallback
        if (!this.indexedDBFallback) {
          this.indexedDBFallback = new IndexedDBQueue();
          await this.indexedDBFallback.init();
        }
        return this.indexedDBFallback.addOrder(order);
      }
    }
    
    if (!this.indexedDBFallback) {
      this.indexedDBFallback = new IndexedDBQueue();
      await this.indexedDBFallback.init();
    }
    return this.indexedDBFallback.addOrder(order);
  }

  async getAllOrders(): Promise<QueuedOrder[]> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        const orders = await sqliteDB.getAllOrders();
        console.log("[OrderQueue] SQLite getAllOrders returned:", orders.length, "orders");
        return orders;
      } catch (error) {
        console.error("SQLite getAllOrders failed:", error);
      }
    }
    
    const orders = await this.indexedDBFallback?.getAllOrders() || [];
    console.log("[OrderQueue] IndexedDB getAllOrders returned:", orders.length, "orders");
    return orders;
  }

  async getPendingOrders(): Promise<QueuedOrder[]> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        return await sqliteDB.getAllPendingOrders();
      } catch (error) {
        console.error("SQLite getPendingOrders failed:", error);
      }
    }
    
    const allOrders = await this.indexedDBFallback?.getAllOrders() || [];
    return allOrders.filter(o => o.status === 'pending' || o.status === 'failed');
  }

  async updateStatus(queueId: string, status: QueuedOrder["status"], errorMessage?: string): Promise<void> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        await sqliteDB.updateStatus(queueId, status, errorMessage);
        return;
      } catch (error) {
        console.error("SQLite updateStatus failed:", error);
      }
    }
    
    return this.indexedDBFallback?.updateStatus(queueId, status, errorMessage);
  }

  async updateAttempt(queueId: string): Promise<void> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        await sqliteDB.incrementAttempt(queueId);
        return;
      } catch (error) {
        console.error("SQLite updateAttempt failed:", error);
      }
    }
    
    return this.indexedDBFallback?.updateAttempt(queueId);
  }

  async removeOrder(queueId: string): Promise<void> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        await sqliteDB.updateStatus(queueId, "synced");
        return;
      } catch (error) {
        console.error("SQLite removeOrder failed:", error);
      }
    }
    
    return this.indexedDBFallback?.removeOrder(queueId);
  }

  async getQueueCount(): Promise<number> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        return await sqliteDB.getQueueCount();
      } catch (error) {
        console.error("SQLite getQueueCount failed:", error);
      }
    }
    
    return this.indexedDBFallback?.getQueueCount() || 0;
  }

  async clearAll(): Promise<void> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        await sqliteDB.clearAll();
        return;
      } catch (error) {
        console.error("SQLite clearAll failed:", error);
      }
    }
    
    return this.indexedDBFallback?.clearAll();
  }

  async getSyncStats() {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        return await sqliteDB.getSyncStats();
      } catch (error) {
        console.error("SQLite getSyncStats failed:", error);
      }
    }
    
    const count = await this.getQueueCount();
    return { pending: count, syncing: 0, synced: 0, failed: 0, total: count };
  }

  // Special order queue methods
  async addSpecialOrder(data: Record<string, unknown>): Promise<string> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        return await sqliteDB.addSpecialOrder(data);
      } catch (error) {
        console.error("SQLite addSpecialOrder failed:", error);
      }
    }
    
    // IndexedDB fallback: store in localStorage
    const queueId = `special_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const existing = JSON.parse(localStorage.getItem('specialOrderQueue') || '[]');
    existing.push({ id: queueId, data, status: 'pending', createdAt: Date.now() });
    localStorage.setItem('specialOrderQueue', JSON.stringify(existing));
    return queueId;
  }

  async getPendingSpecialOrders(): Promise<{ id: string; data: Record<string, unknown>; status: string }[]> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        return await sqliteDB.getAllPendingSpecialOrders();
      } catch (error) {
        console.error("SQLite getPendingSpecialOrders failed:", error);
      }
    }
    
    const existing = JSON.parse(localStorage.getItem('specialOrderQueue') || '[]');
    return existing.filter((o: any) => o.status === 'pending' || o.status === 'failed');
  }

  async updateSpecialOrderStatus(queueId: string, status: string, errorMessage?: string): Promise<void> {
    await this.ensureInit();
    
    if (this.isTauri && sqliteDB) {
      try {
        await sqliteDB.updateSpecialOrderStatus(queueId, status, errorMessage);
        return;
      } catch (error) {
        console.error("SQLite updateSpecialOrderStatus failed:", error);
      }
    }
    
    const existing = JSON.parse(localStorage.getItem('specialOrderQueue') || '[]');
    const updated = existing.map((o: any) => o.id === queueId ? { ...o, status, errorMessage } : o);
    localStorage.setItem('specialOrderQueue', JSON.stringify(updated));
  }
}

export const orderQueue = new OrderQueue();

// Connection monitoring utility for desktop app
// Tracks both browser online/offline status and Convex connection state

type ConnectionCallback = (isConnected: boolean) => void;

class ConnectionMonitor {
  private isOnline: boolean = navigator.onLine;
  private callbacks: Set<ConnectionCallback> = new Set();
  private checkInterval: number | null = null;
  private lastConvexCheck: number = 0;

  constructor() {
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    this.startPeriodicCheck();
  }

  private handleOnline = () => {
    const wasOffline = !this.isOnline;
    this.isOnline = true;
    if (wasOffline) {
      console.log("Connection restored");
      this.notifyCallbacks(true);
    }
  };

  private handleOffline = () => {
    const wasOnline = this.isOnline;
    this.isOnline = false;
    if (wasOnline) {
      console.log("Connection lost");
      this.notifyCallbacks(false);
    }
  };

  private startPeriodicCheck() {
    this.checkInterval = window.setInterval(() => {
      this.checkConvexConnection();
    }, 5000);
  }

  private async checkConvexConnection() {
    if (!this.isOnline) return;

    try {
      const convexUrl = import.meta.env.VITE_CONVEX_URL;
      if (!convexUrl) return;

      const response = await fetch(convexUrl, {
        method: "HEAD",
        cache: "no-cache",
      });

      const isConnected = response.ok;
      const now = Date.now();

      if (now - this.lastConvexCheck > 2000) {
        this.lastConvexCheck = now;
        if (isConnected !== this.isOnline) {
          this.isOnline = isConnected;
          this.notifyCallbacks(isConnected);
        }
      }
    } catch (error) {
      if (this.isOnline) {
        this.isOnline = false;
        this.notifyCallbacks(false);
      }
    }
  }

  private notifyCallbacks(isConnected: boolean) {
    this.callbacks.forEach((callback) => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error("Error in connection callback:", error);
      }
    });
  }

  subscribe(callback: ConnectionCallback): () => void {
    this.callbacks.add(callback);
    callback(this.isOnline);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  destroy() {
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
    }
    this.callbacks.clear();
  }
}

// Lazy singleton - avoid instantiating at module load time which can fail
let _connectionMonitor: ConnectionMonitor | null = null;

export function getConnectionMonitor(): ConnectionMonitor | null {
  if (!("__TAURI__" in window)) return null;
  if (!_connectionMonitor) {
    _connectionMonitor = new ConnectionMonitor();
  }
  return _connectionMonitor;
}

// Backward compatibility - lazy getter
export const connectionMonitor: ConnectionMonitor | null = null;

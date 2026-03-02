declare module "@tauri-apps/api/tauri" {
  export * from "@tauri-apps/api";
}

interface Window {
  __TAURI__?: {
    sql?: {
      load: (db: string) => Promise<unknown>;
      [key: string]: unknown;
    };
    core?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      [key: string]: unknown;
    };
    invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    [key: string]: unknown;
  };
  __TAURI_INTERNALS__?: Record<string, unknown>;
  __splashProgress?: (v: number) => void;
  __removeSplash?: () => void;
}

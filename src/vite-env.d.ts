/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

// Extend ServiceWorkerRegistration for Background Sync API
interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistration {
  sync?: SyncManager;
  periodicSync?: PeriodicSyncManager;
}

// Extend SyncEvent for service worker
interface SyncEvent extends ExtendableEvent {
  tag: string;
  lastChance: boolean;
}

interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}

declare global {
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent;
    periodicsync: PeriodicSyncEvent;
  }
}

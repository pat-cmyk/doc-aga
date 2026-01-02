import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Service Worker Bridge', () => {
  let mockServiceWorker: any;

  beforeEach(() => {
    vi.resetModules();
    
    mockServiceWorker = {
      controller: {
        postMessage: vi.fn(),
      },
      ready: Promise.resolve({
        sync: {
          register: vi.fn().mockResolvedValue(undefined),
        },
        periodicSync: {
          register: vi.fn().mockResolvedValue(undefined),
        },
        active: {
          postMessage: vi.fn(),
        },
      }),
      register: vi.fn().mockResolvedValue({
        waiting: null,
        active: { postMessage: vi.fn() },
      }),
      getRegistration: vi.fn().mockResolvedValue({
        waiting: null,
        active: { postMessage: vi.fn() },
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    Object.defineProperty(global, 'navigator', {
      value: { serviceWorker: mockServiceWorker },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initServiceWorkerBridge', () => {
    it('should set up message listener', async () => {
      const { initServiceWorkerBridge } = await import('../swBridge');
      const onSync = vi.fn();

      initServiceWorkerBridge(onSync);

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should return cleanup function', async () => {
      const { initServiceWorkerBridge } = await import('../swBridge');
      const cleanup = initServiceWorkerBridge(vi.fn());

      expect(typeof cleanup).toBe('function');
    });
  });

  describe('requestBackgroundSync', () => {
    it('should register background sync when supported', async () => {
      const { requestBackgroundSync } = await import('../swBridge');
      
      const result = await requestBackgroundSync();
      
      expect(result).toBe(true);
    });

    it('should return false when service worker not available', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });
      
      const { requestBackgroundSync } = await import('../swBridge');
      const result = await requestBackgroundSync();
      
      expect(result).toBe(false);
    });
  });

  describe('triggerServiceWorkerSync', () => {
    it('should post QUEUE_SYNC message to service worker', async () => {
      const { triggerServiceWorkerSync } = await import('../swBridge');
      
      await triggerServiceWorkerSync();
      
      expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
        type: 'QUEUE_SYNC',
      });
    });
  });

  describe('skipWaiting', () => {
    it('should send SKIP_WAITING message when waiting worker exists', async () => {
      const waitingWorker = { postMessage: vi.fn() };
      mockServiceWorker.getRegistration = vi.fn().mockResolvedValue({
        waiting: waitingWorker,
        active: null,
      });

      const { skipWaiting } = await import('../swBridge');
      await skipWaiting();

      expect(waitingWorker.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
    });
  });
});

import { useCallback, useState } from 'react';
import { useQueryClient, QueryKey } from '@tanstack/react-query';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addToQueue, QueueItem } from '@/lib/offlineQueue';
import { syncQueue } from '@/lib/syncService';
import { useToast } from '@/hooks/use-toast';
import { hapticNotification } from '@/lib/haptics';

/**
 * Sync status for optimistic records
 */
export type OptimisticSyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';

/**
 * An optimistic record with sync status metadata
 */
export interface OptimisticRecord<T> {
  data: T;
  optimisticId: string;
  syncStatus: OptimisticSyncStatus;
  createdAt: number;
}

/**
 * Configuration for useOptimisticMutation hook
 */
export interface UseOptimisticMutationOptions<TData, TVariables> {
  /** Function to call when online (actual server mutation) */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** React Query cache key to update */
  cacheKey: QueryKey;
  /** Function to optimistically update cache */
  optimisticUpdate: (currentData: TData[] | undefined, variables: TVariables, optimisticId: string) => TData[];
  /** Queue type for offline storage */
  queueType: QueueItem['type'];
  /** Build payload for offline queue */
  buildPayload: (variables: TVariables) => QueueItem['payload'];
  /** Success message for toast */
  successMessage?: string;
  /** Offline success message for toast */
  offlineMessage?: string;
  /** Additional cache keys to invalidate on success */
  invalidateKeys?: QueryKey[];
}

/**
 * Hook for offline-first mutations with optimistic updates
 * 
 * Provides instant UI feedback by:
 * 1. Immediately updating React Query cache
 * 2. Queuing for background sync when offline
 * 3. Triggering sync when online
 * 4. Handling rollback on failure
 * 
 * @example
 * ```tsx
 * const { mutate, isPending, optimisticRecords } = useOptimisticMutation({
 *   mutationFn: async (data) => supabase.from('records').insert(data),
 *   cacheKey: ['records', farmId],
 *   optimisticUpdate: (current, data, id) => [...(current || []), { ...data, id }],
 *   queueType: 'bulk_milk',
 *   buildPayload: (data) => ({ farmId, milkRecords: data }),
 *   successMessage: 'Milk recorded',
 *   offlineMessage: 'Queued for sync',
 * });
 * ```
 */
export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  cacheKey,
  optimisticUpdate,
  queueType,
  buildPayload,
  successMessage = 'Saved successfully',
  offlineMessage = 'Queued for sync',
  invalidateKeys = [],
}: UseOptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [optimisticRecords, setOptimisticRecords] = useState<Map<string, OptimisticRecord<TData>>>(new Map());

  /**
   * Execute the mutation with optimistic update
   */
  const mutate = useCallback(async (
    variables: TVariables,
    options?: {
      onSuccess?: (data: TData) => void;
      onError?: (error: Error) => void;
    }
  ) => {
    const optimisticId = crypto.randomUUID();
    setIsPending(true);

    try {
      // Step 1: Optimistically update the cache
      queryClient.setQueryData<TData[]>(cacheKey, (currentData) => 
        optimisticUpdate(currentData, variables, optimisticId)
      );

      // Track optimistic record
      const optimisticRecord: OptimisticRecord<TData> = {
        data: {} as TData, // Will be populated by optimisticUpdate
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
        createdAt: Date.now(),
      };
      setOptimisticRecords(prev => new Map(prev).set(optimisticId, optimisticRecord));

      if (!isOnline) {
        // Step 2a: Queue for offline sync
        await addToQueue({
          id: `${queueType}_${Date.now()}`,
          type: queueType,
          payload: buildPayload(variables),
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: offlineMessage,
          description: 'Will sync when back online',
        });

        // Update status to pending
        setOptimisticRecords(prev => {
          const updated = new Map(prev);
          const record = updated.get(optimisticId);
          if (record) {
            updated.set(optimisticId, { ...record, syncStatus: 'pending' });
          }
          return updated;
        });

        options?.onSuccess?.({} as TData);
        return;
      }

      // Step 2b: Online - execute mutation directly
      const result = await mutationFn(variables);

      // Update optimistic record status to synced
      setOptimisticRecords(prev => {
        const updated = new Map(prev);
        const record = updated.get(optimisticId);
        if (record) {
          updated.set(optimisticId, { ...record, syncStatus: 'synced' });
        }
        return updated;
      });

      // Remove from optimistic records after delay (record is now real)
      setTimeout(() => {
        setOptimisticRecords(prev => {
          const updated = new Map(prev);
          updated.delete(optimisticId);
          return updated;
        });
      }, 2000);

      // Invalidate related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cacheKey }),
        ...invalidateKeys.map(key => queryClient.invalidateQueries({ queryKey: key })),
      ]);

      hapticNotification('success');
      toast({ title: successMessage });

      options?.onSuccess?.(result);
    } catch (error) {
      console.error('[OptimisticMutation] Error:', error);

      // Rollback: Remove optimistic update from cache
      queryClient.setQueryData<TData[]>(cacheKey, (currentData) => 
        (currentData || []).filter((item: any) => item.optimisticId !== optimisticId)
      );

      // Update status to error
      setOptimisticRecords(prev => {
        const updated = new Map(prev);
        const record = updated.get(optimisticId);
        if (record) {
          updated.set(optimisticId, { ...record, syncStatus: 'error' });
        }
        return updated;
      });

      hapticNotification('error');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      });

      options?.onError?.(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsPending(false);
    }
  }, [queryClient, cacheKey, optimisticUpdate, queueType, buildPayload, isOnline, toast, mutationFn, successMessage, offlineMessage, invalidateKeys]);

  /**
   * Retry a failed optimistic mutation
   */
  const retry = useCallback(async (optimisticId: string) => {
    if (!isOnline) {
      toast({
        title: 'Still offline',
        description: 'Will retry when back online',
      });
      return;
    }

    // Trigger sync
    await syncQueue();
  }, [isOnline, toast]);

  /**
   * Get sync status for a specific optimistic ID
   */
  const getSyncStatus = useCallback((optimisticId: string): OptimisticSyncStatus | null => {
    return optimisticRecords.get(optimisticId)?.syncStatus || null;
  }, [optimisticRecords]);

  return {
    mutate,
    isPending,
    optimisticRecords,
    getSyncStatus,
    retry,
    isOnline,
  };
}

/**
 * Generate a unique optimistic ID
 */
export function generateOptimisticId(): string {
  return crypto.randomUUID();
}

import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Clock, CheckCircle, XCircle, Mic, Beef } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAll, clearCompleted, removeItem, type QueueItem } from '@/lib/offlineQueue';
import { syncQueue } from '@/lib/syncService';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatDistanceToNow } from 'date-fns';

export const QueueStatus = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  const loadItems = async () => {
    const allItems = await getAll();
    setItems(allItems);
  };

  useEffect(() => {
    loadItems();
    const interval = setInterval(loadItems, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncQueue();
    await loadItems();
    setIsSyncing(false);
  };

  const handleClearCompleted = async () => {
    await clearCompleted();
    await loadItems();
  };

  const handleRemove = async (id: string) => {
    await removeItem(id);
    await loadItems();
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const processingCount = items.filter(i => i.status === 'processing').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  if (items.length === 0) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 right-6 rounded-full shadow-lg z-40 h-14 w-14 p-0"
          variant={failedCount > 0 ? "destructive" : "default"}
        >
          <RefreshCw className={`h-6 w-6 ${isSyncing ? 'animate-spin' : ''}`} />
          {(pendingCount + processingCount + failedCount) > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0"
              variant={failedCount > 0 ? "destructive" : "default"}
            >
              {pendingCount + processingCount + failedCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Sync Queue</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={handleManualSync} 
              disabled={!isOnline || isSyncing}
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            <Button 
              onClick={handleClearCompleted}
              variant="outline"
              disabled={items.filter(i => i.status === 'completed').length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Completed
            </Button>
          </div>

          {!isOnline && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-md text-sm">
              📡 Offline - Items will sync automatically when online
            </div>
          )}

          <ScrollArea className="h-[calc(80vh-200px)]">
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>All synced! ✅</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div 
                    key={item.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {item.type === 'voice_activity' ? (
                          <Mic className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Beef className="h-5 w-5 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">
                            {item.type === 'voice_activity' ? 'Voice Activity' : 'Animal Form'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        {item.status === 'processing' && (
                          <Badge variant="secondary">
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        {item.status === 'completed' && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {item.status === 'failed' && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                    </div>

                    {item.error && (
                      <p className="text-xs text-destructive">
                        Error: {item.error}
                      </p>
                    )}

                    {item.status === 'failed' && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleManualSync}
                          disabled={!isOnline}
                          className="flex-1"
                        >
                          Retry
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleRemove(item.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}

                    {item.retries > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Retry attempts: {item.retries}/3
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};

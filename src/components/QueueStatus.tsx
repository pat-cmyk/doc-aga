import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Trash2, Clock, CheckCircle, XCircle, Mic, Beef, Check, AlertCircle, Loader2, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAll, clearCompleted, removeItem, resetForRetry, confirmTranscription, updatePayload, type QueueItem } from '@/lib/offlineQueue';
import { syncQueue } from '@/lib/syncService';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

export const QueueStatus = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingTranscription, setEditingTranscription] = useState<Record<string, string>>({});
  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<Record<string, string>>({});
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const fetchAnimals = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from('farm_memberships')
        .select('farm_id')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) return;

      const farmIds = memberships.map(m => m.farm_id);
      const { data } = await supabase
        .from('animals')
        .select('id, ear_tag, name, current_weight_kg, farm_id')
        .in('farm_id', farmIds)
        .eq('is_deleted', false)
        .order('ear_tag');

      setAnimals(data || []);
    };

    fetchAnimals();
  }, []);

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

  const handleRetry = async (id: string) => {
    await resetForRetry(id);
    await handleManualSync();
  };

  const handleRetryAllFailed = async () => {
    const failedItems = items.filter(i => i.status === 'failed');
    for (const item of failedItems) {
      await resetForRetry(item.id);
    }
    await handleManualSync();
  };

  const handleConfirmTranscription = async (id: string) => {
    const text = editingTranscription[id];
    if (!text) return;
    
    await confirmTranscription(id, text);
    setEditingTranscription(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await handleManualSync();
  };

  const handleAnimalSelection = async (itemId: string, animalId: string) => {
    // Update queue item with selected animal
    await updatePayload(itemId, { animalId });
    setSelectedAnimal(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    // Retry processing
    await handleRetry(itemId);
  };

  const initializeEditingText = (item: QueueItem) => {
    if (item.payload.transcription && !editingTranscription[item.id]) {
      setEditingTranscription(prev => ({
        ...prev,
        [item.id]: item.payload.transcription!
      }));
    }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const processingCount = items.filter(i => i.status === 'processing').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const awaitingCount = items.filter(i => i.status === 'awaiting_confirmation').length;
  const completedCount = items.filter(i => i.status === 'completed').length;

  if (items.length === 0) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-24 sm:bottom-28 right-6 rounded-full shadow-lg z-40 h-14 w-14 p-0"
          variant={failedCount > 0 ? "destructive" : awaitingCount > 0 ? "outline" : "default"}
        >
          <RefreshCw className={`h-6 w-6 ${isSyncing ? 'animate-spin' : ''}`} />
          {(pendingCount + processingCount + failedCount + awaitingCount) > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0"
              variant={failedCount > 0 ? "destructive" : awaitingCount > 0 ? "outline" : "default"}
            >
              {pendingCount + processingCount + failedCount + awaitingCount}
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
            {failedCount > 0 && (
              <Button 
                onClick={handleRetryAllFailed}
                disabled={!isOnline || isSyncing}
                variant="outline"
              >
                Retry All Failed
              </Button>
            )}
            <Button 
              onClick={handleClearCompleted}
              variant="outline"
              disabled={completedCount === 0}
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

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{pendingCount} pending</span>
            </div>
            <div className="flex items-center gap-1">
              <Loader2 className="h-4 w-4" />
              <span>{processingCount} processing</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>{awaitingCount} awaiting confirmation</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-destructive" />
              <span>{failedCount} failed</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{completedCount} completed</span>
            </div>
          </div>

          <ScrollArea className="h-[calc(80vh-200px)]">
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>All synced! ✅</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  // Initialize editing text for awaiting confirmation items
                  if (item.status === 'awaiting_confirmation') {
                    initializeEditingText(item);
                  }
                  
                  return (
                    <div 
                      key={item.id}
                      className="border rounded-lg p-4 space-y-3"
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
                          {item.status === 'awaiting_confirmation' && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Awaiting Confirmation
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

                      {item.status === 'awaiting_confirmation' && item.payload.transcription && (
                        <div className="space-y-2 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                          <p className="text-xs text-muted-foreground font-medium">Please confirm or edit the transcription:</p>
                          <Textarea 
                            value={editingTranscription[item.id] || item.payload.transcription}
                            onChange={(e) => setEditingTranscription(prev => ({
                              ...prev,
                              [item.id]: e.target.value
                            }))}
                            className="min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleConfirmTranscription(item.id)}
                              disabled={!isOnline || isSyncing}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Confirm & Process
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleRemove(item.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}

                      {item.error?.includes('NEEDS_ANIMAL_SELECTION') && item.status === 'failed' && (
                        <div className="space-y-2 bg-blue-50 p-3 rounded-md border border-blue-200">
                          <p className="text-xs font-medium text-blue-900">This activity needs an animal:</p>
                          <Select 
                            value={selectedAnimal[item.id] || ''} 
                            onValueChange={(value) => setSelectedAnimal(prev => ({ ...prev, [item.id]: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an animal...">
                                {selectedAnimal[item.id] && (
                                  <span>
                                    {animals.find(a => a.id === selectedAnimal[item.id])?.ear_tag}
                                    {animals.find(a => a.id === selectedAnimal[item.id])?.name && 
                                      ` - ${animals.find(a => a.id === selectedAnimal[item.id])?.name}`}
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {animals
                                .filter(a => a.farm_id === item.payload.farmId)
                                .map((animal) => (
                                  <SelectItem key={animal.id} value={animal.id}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{animal.ear_tag}</span>
                                      {animal.name && (
                                        <span className="text-muted-foreground">- {animal.name}</span>
                                      )}
                                      {animal.current_weight_kg && (
                                        <span className="text-xs text-muted-foreground">
                                          ({animal.current_weight_kg} kg)
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            size="sm" 
                            onClick={() => handleAnimalSelection(item.id, selectedAnimal[item.id])}
                            disabled={!selectedAnimal[item.id] || !isOnline || isSyncing}
                            className="w-full"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Confirm Animal & Retry
                          </Button>
                        </div>
                      )}

                      {item.error?.startsWith('INVENTORY_REQUIRED:') && item.status === 'failed' && (() => {
                        const feedType = item.error.split(':')[1];
                        return (
                          <div className="space-y-2 bg-blue-50 p-3 rounded-md border border-blue-200">
                            <div className="flex items-start gap-2">
                              <Package className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-blue-900 mb-1">
                                  This feed type is not in your inventory:
                                </p>
                                <p className="text-sm font-semibold text-blue-700 mb-2">
                                  {feedType}
                                </p>
                                <p className="text-xs text-blue-800">
                                  Add it to your feed inventory first to record this activity.
                                </p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setIsOpen(false);
                                navigate(`/dashboard?tab=feed&prefillFeedType=${encodeURIComponent(feedType)}`);
                              }}
                              className="w-full"
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Add to Inventory
                            </Button>
                          </div>
                        );
                      })()}

                      {item.error && !item.error.includes('NEEDS_ANIMAL_SELECTION') && !item.error.startsWith('INVENTORY_REQUIRED:') && (
                        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                          Error: {item.error}
                        </p>
                      )}

                      {item.retries > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Retry attempts: {item.retries}/3
                        </p>
                      )}

                      {item.status === 'failed' && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRetry(item.id)}
                            disabled={!isOnline || isSyncing}
                            className="flex-1"
                          >
                            Retry
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleRemove(item.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      )}

                      {item.type === 'voice_activity' && 
                       item.status !== 'failed' && 
                       item.status !== 'awaiting_confirmation' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleRemove(item.id)}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};

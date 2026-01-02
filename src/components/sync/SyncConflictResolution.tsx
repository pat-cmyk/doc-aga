import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, GitMerge, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useFarm } from '@/contexts/FarmContext';
import { toast } from 'sonner';
import {
  getUnresolvedConflicts,
  resolveConflict,
  applyConflictResolution,
  getConflictCount,
  mergeRecords,
  type SyncConflict,
  type ResolutionStrategy,
} from '@/lib/conflictDetection';
import { formatDistanceToNow } from 'date-fns';

export const SyncConflictResolution = () => {
  const { farmId } = useFarm();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<Record<string, ResolutionStrategy>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadConflicts = async () => {
    if (!farmId) return;
    
    const [unresolvedConflicts, count] = await Promise.all([
      getUnresolvedConflicts(farmId),
      getConflictCount(farmId),
    ]);
    
    setConflicts(unresolvedConflicts);
    setConflictCount(count);
  };

  useEffect(() => {
    loadConflicts();
    const interval = setInterval(loadConflicts, 10000);
    return () => clearInterval(interval);
  }, [farmId]);

  const handleResolve = async (conflict: SyncConflict) => {
    const strategy = selectedResolution[conflict.id];
    if (!strategy) {
      toast.error('Please select a resolution strategy');
      return;
    }

    setResolvingId(conflict.id);
    setIsLoading(true);

    try {
      let resolvedData: Record<string, any> | undefined;
      
      if (strategy === 'merged') {
        resolvedData = mergeRecords(
          conflict.clientData,
          conflict.serverData,
          conflict.clientData.updated_at || conflict.createdAt,
          conflict.serverData.updated_at || conflict.createdAt
        );
      }

      const success = await resolveConflict(conflict.id, strategy, resolvedData);
      
      if (success) {
        const updatedConflict: SyncConflict = {
          ...conflict,
          resolution: strategy,
          resolvedData: resolvedData ?? null,
        };
        
        await applyConflictResolution(updatedConflict);
        toast.success('Conflict resolved successfully');
        await loadConflicts();
      } else {
        toast.error('Failed to resolve conflict');
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      toast.error('Error resolving conflict');
    } finally {
      setResolvingId(null);
      setIsLoading(false);
    }
  };

  const formatFieldName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const renderDataComparison = (client: Record<string, any>, server: Record<string, any>) => {
    const allKeys = new Set([...Object.keys(client), ...Object.keys(server)]);
    const differences: { key: string; clientValue: any; serverValue: any }[] = [];

    allKeys.forEach(key => {
      if (key === 'id' || key === 'created_at' || key === 'farm_id') return;
      
      const clientValue = client[key];
      const serverValue = server[key];
      
      if (JSON.stringify(clientValue) !== JSON.stringify(serverValue)) {
        differences.push({ key, clientValue, serverValue });
      }
    });

    if (differences.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">No differences found</p>
      );
    }

    return (
      <div className="space-y-2">
        {differences.map(({ key, clientValue, serverValue }) => (
          <div key={key} className="grid grid-cols-3 gap-2 text-sm">
            <div className="font-medium text-muted-foreground">
              {formatFieldName(key)}
            </div>
            <div className="bg-blue-50 p-1.5 rounded text-blue-900 text-xs">
              {clientValue === null ? <em>null</em> : String(clientValue)}
            </div>
            <div className="bg-green-50 p-1.5 rounded text-green-900 text-xs">
              {serverValue === null ? <em>null</em> : String(serverValue)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (conflictCount === 0) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="fixed bottom-56 sm:bottom-44 right-4 sm:right-6 rounded-full shadow-lg z-40 gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          <span>{conflictCount} Conflict{conflictCount !== 1 ? 's' : ''}</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Sync Conflicts
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(85vh-100px)] mt-4">
          <div className="space-y-4 pr-4">
            {conflicts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>No conflicts to resolve</p>
              </div>
            ) : (
              conflicts.map((conflict) => (
                <Card key={conflict.id} className="border-destructive/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base capitalize">
                          {conflict.tableName.replace(/_/g, ' ')}
                        </CardTitle>
                        <CardDescription>
                          {formatDistanceToNow(new Date(conflict.createdAt), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      <Badge variant="destructive">Conflict</Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Data Comparison Header */}
                    <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                      <div>Field</div>
                      <div className="flex items-center gap-1 text-blue-700">
                        <span>📱 Your Data</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-700">
                        <span>☁️ Server Data</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Data Comparison */}
                    {renderDataComparison(conflict.clientData, conflict.serverData)}

                    <Separator />

                    {/* Resolution Options */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Choose Resolution:</Label>
                      <RadioGroup
                        value={selectedResolution[conflict.id] || ''}
                        onValueChange={(value) => 
                          setSelectedResolution(prev => ({
                            ...prev,
                            [conflict.id]: value as ResolutionStrategy,
                          }))
                        }
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                          <RadioGroupItem value="client_wins" id={`client-${conflict.id}`} />
                          <Label 
                            htmlFor={`client-${conflict.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="font-medium">Use My Data</span>
                            <span className="block text-xs text-muted-foreground">
                              Override server with your local changes
                            </span>
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                          <RadioGroupItem value="server_wins" id={`server-${conflict.id}`} />
                          <Label 
                            htmlFor={`server-${conflict.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="font-medium">Use Server Data</span>
                            <span className="block text-xs text-muted-foreground">
                              Discard your local changes
                            </span>
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                          <RadioGroupItem value="merged" id={`merge-${conflict.id}`} />
                          <Label 
                            htmlFor={`merge-${conflict.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="font-medium flex items-center gap-1">
                              <GitMerge className="h-3 w-3" />
                              Auto-Merge
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Combine both versions (newer values preferred)
                            </span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Resolve Button */}
                    <Button
                      onClick={() => handleResolve(conflict)}
                      disabled={!selectedResolution[conflict.id] || resolvingId === conflict.id}
                      className="w-full"
                    >
                      {resolvingId === conflict.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Resolving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Apply Resolution
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

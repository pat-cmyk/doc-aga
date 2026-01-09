import { RecordBulkFeedDialog } from '@/components/feed-recording/RecordBulkFeedDialog';
import { RecordBulkMilkDialog } from '@/components/milk-recording/RecordBulkMilkDialog';

interface OperationDialogsProps {
  farmId: string;
  isRecordFeedOpen: boolean;
  onRecordFeedOpenChange: (open: boolean) => void;
  isRecordMilkOpen: boolean;
  onRecordMilkOpenChange: (open: boolean) => void;
}

export function OperationDialogs({
  farmId,
  isRecordFeedOpen,
  onRecordFeedOpenChange,
  isRecordMilkOpen,
  onRecordMilkOpenChange,
}: OperationDialogsProps) {
  return (
    <>
      <RecordBulkFeedDialog
        open={isRecordFeedOpen}
        onOpenChange={onRecordFeedOpenChange}
        farmId={farmId}
      />
      <RecordBulkMilkDialog
        open={isRecordMilkOpen}
        onOpenChange={onRecordMilkOpenChange}
        farmId={farmId}
      />
    </>
  );
}

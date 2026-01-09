import { useState, useCallback } from 'react';

interface UseOperationDialogsReturn {
  isRecordFeedOpen: boolean;
  isRecordMilkOpen: boolean;
  openFeedDialog: () => void;
  openMilkDialog: () => void;
  closeFeedDialog: () => void;
  closeMilkDialog: () => void;
  setRecordFeedOpen: (open: boolean) => void;
  setRecordMilkOpen: (open: boolean) => void;
}

export function useOperationDialogs(): UseOperationDialogsReturn {
  const [isRecordFeedOpen, setIsRecordFeedOpen] = useState(false);
  const [isRecordMilkOpen, setIsRecordMilkOpen] = useState(false);

  const openFeedDialog = useCallback(() => setIsRecordFeedOpen(true), []);
  const openMilkDialog = useCallback(() => setIsRecordMilkOpen(true), []);
  const closeFeedDialog = useCallback(() => setIsRecordFeedOpen(false), []);
  const closeMilkDialog = useCallback(() => setIsRecordMilkOpen(false), []);

  return {
    isRecordFeedOpen,
    isRecordMilkOpen,
    openFeedDialog,
    openMilkDialog,
    closeFeedDialog,
    closeMilkDialog,
    setRecordFeedOpen: setIsRecordFeedOpen,
    setRecordMilkOpen: setIsRecordMilkOpen,
  };
}

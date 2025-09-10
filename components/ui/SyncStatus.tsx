import React from 'react';
import { Check, Loader, AlertCircle } from 'lucide-react';

interface SyncStatusProps {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  isSyncing,
  lastSyncTime,
  syncError
}) => {
  if (syncError) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span>Sync failed</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader className="w-4 h-4 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (lastSyncTime) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="w-4 h-4" />
        <span>Saved</span>
      </div>
    );
  }

  return null;
}; 
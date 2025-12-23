"use client";

import React, { useState, useEffect } from 'react';
import { PowerUserStorage, PowerUserStorageStatus } from '@/lib/powerUserStorage';
import { GifQuotaManager } from '@/lib/gifQuotaManager';
import { HardDrive, Cloud, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const StorageStatus: React.FC = () => {
  const [status, setStatus] = useState<PowerUserStorageStatus | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [gifRecommendations, setGifRecommendations] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      try {
        const currentStatus = PowerUserStorage.getStorageStatus();
        const currentWarnings = PowerUserStorage.getStorageWarnings();
        const currentGifRecommendations = GifQuotaManager.getGifRecommendations();
        setStatus(currentStatus);
        setWarnings(currentWarnings);
        setGifRecommendations(currentGifRecommendations);
      } catch (error) {
        console.error('Failed to get storage status:', error);
      }
    };

    // Update immediately
    updateStatus();

    // Update every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const getStatusColor = () => {
    if (status.localStorage.percentage > 95) return 'text-red-400';
    if (status.localStorage.percentage > 80) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusIcon = () => {
    if (status.localStorage.percentage > 95) return <AlertTriangle className="w-4 h-4" />;
    if (status.localStorage.percentage > 80) return <Info className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-sm">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-slate-750 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Storage</span>
          <span className={`text-sm font-bold ${getStatusColor()}`}>
            {status.localStorage.percentage.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {status.cloudStorage.configured && (
            <Cloud className="w-4 h-4 text-blue-400" />
          )}
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 space-y-2">
          {/* Storage Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Used: {formatBytes(status.localStorage.used)}</span>
              <span>Available: {formatBytes(status.localStorage.available)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  status.localStorage.percentage > 95 ? 'bg-red-500' :
                  status.localStorage.percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(status.localStorage.percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Status Message */}
          {status.message && (
            <div className="text-xs text-gray-300 bg-slate-900 rounded p-2">
              {status.message}
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((warning, index) => (
                <div key={index} className="text-xs text-orange-300 bg-orange-900/30 rounded p-2">
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* GIF Recommendations */}
          {gifRecommendations.length > 0 && (
            <div className="space-y-1">
              {gifRecommendations.map((recommendation, index) => (
                <div key={index} className="text-xs text-blue-300 bg-blue-900/30 rounded p-2">
                  {recommendation}
                </div>
              ))}
            </div>
          )}

          {/* Cloud Storage Status */}
          <div className="flex items-center gap-2 text-xs">
            <Cloud className="w-3 h-3 text-gray-400" />
            <span className={status.cloudStorage.configured ? 'text-green-400' : 'text-gray-500'}>
              Cloud Storage: {status.cloudStorage.configured ? 'Available' : 'Not configured'}
            </span>
          </div>

          {/* Recommendation */}
          {status.recommendation !== 'continue' && (
            <div className="text-xs font-medium text-yellow-400">
              💡 {status.recommendation === 'upgrade-to-cloud' ? 'Consider cloud storage' :
                  status.recommendation === 'compress-more' ? 'Using higher compression' :
                  'Consider removing some items'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 
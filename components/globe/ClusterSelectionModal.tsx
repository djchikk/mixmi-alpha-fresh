"use client";

import React from 'react';
import { TrackNode } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ClusterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: TrackNode[];
  location?: string;
  onSelectNode: (node: TrackNode) => void;
}

export function ClusterSelectionModal({ 
  isOpen, 
  onClose, 
  nodes, 
  location,
  onSelectNode 
}: ClusterSelectionModalProps) {
  if (nodes.length === 0) return null;

  const handleSelectNode = (node: TrackNode) => {
    onSelectNode(node);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {nodes.length} tracks in {location || 'this location'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 pr-2">
          <div className="space-y-3">
            {nodes.map((node) => (
              <button
                key={node.id}
                onClick={() => handleSelectNode(node)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-cyan-400 hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-start space-x-3">
                  {node.imageUrl && (
                    <img 
                      src={node.imageUrl} 
                      alt={node.title}
                      className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {node.title}
                    </h3>
                    <p className="text-sm text-gray-600 truncate">
                      {node.artist}
                    </p>
                    {node.genre && (
                      <p className="text-xs text-gray-500 mt-1">
                        {node.genre}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
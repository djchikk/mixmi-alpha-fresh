"use client";

import { useState, useRef, useCallback } from "react";
import { useDrop } from "react-dnd";
import { Track } from "@/components/mixer/types";
import { Search, Sparkles } from "lucide-react";

interface AgentVibeMatcherProps {
  onWakeUp: (mode: 'vibe' | 'hunt', input: Track | string) => void;
  isSearching?: boolean;
}

export default function AgentVibeMatcher({ onWakeUp, isSearching = false }: AgentVibeMatcherProps) {
  const [droppedTrack, setDroppedTrack] = useState<Track | null>(null);
  const [huntText, setHuntText] = useState("");
  const [mode, setMode] = useState<'vibe' | 'hunt' | null>(null);

  // Track drop zone
  const [{ isOver, canDrop }, dropRef] = useDrop(() => ({
    accept: 'COLLECTION_TRACK',
    drop: (item: Track) => {
      setDroppedTrack(item);
      setMode('vibe');
      setHuntText(""); // Clear text when track dropped
      return { dropped: true };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHuntText(e.target.value);
    if (e.target.value.trim()) {
      setMode('hunt');
      setDroppedTrack(null); // Clear track when typing
    } else {
      setMode(droppedTrack ? 'vibe' : null);
    }
  };

  const handleWakeUp = () => {
    if (mode === 'vibe' && droppedTrack) {
      onWakeUp('vibe', droppedTrack);
    } else if (mode === 'hunt' && huntText.trim()) {
      onWakeUp('hunt', huntText.trim());
    }
  };

  const handleClear = () => {
    setDroppedTrack(null);
    setHuntText("");
    setMode(null);
  };

  const isActive = isOver && canDrop;
  const hasInput = droppedTrack || huntText.trim();

  return (
    <div className="space-y-4">
      {/* Drop Zone / Input Area */}
      <div
        ref={dropRef}
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200
          ${isActive
            ? 'border-[#81E4F2] bg-[#81E4F2]/10 scale-[1.02]'
            : canDrop
              ? 'border-[#81E4F2]/50 bg-[#0a0f1a]'
              : 'border-gray-600 bg-[#0a0f1a]'
          }
          ${droppedTrack ? 'border-solid border-[#81E4F2]/30' : ''}
        `}
      >
        {/* Dropped Track Display */}
        {droppedTrack ? (
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* Track thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700">
                <img
                  src={droppedTrack.cover_image_url || droppedTrack.imageUrl}
                  alt={droppedTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#81E4F2]" />
                  <span className="text-sm text-[#81E4F2]">Match this vibe</span>
                </div>
                <h4 className="text-white font-medium truncate">{droppedTrack.title}</h4>
                <p className="text-gray-400 text-sm truncate">{droppedTrack.artist}</p>
                {droppedTrack.bpm && (
                  <span className="text-xs text-gray-500 font-mono">{droppedTrack.bpm} BPM</span>
                )}
              </div>

              {/* Clear button */}
              <button
                onClick={handleClear}
                className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Drop instruction */}
            <div className="text-center mb-4">
              <div className="text-2xl mb-2">
                {isActive ? '🎯' : '🎵'}
              </div>
              <p className={`text-sm ${isActive ? 'text-[#81E4F2]' : 'text-gray-400'}`}>
                {isActive
                  ? 'Drop it!'
                  : 'Drop a track here to match its vibe'
                }
              </p>
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 border-t border-gray-700"></div>
              <span className="text-gray-500 text-xs uppercase">or describe what you want</span>
              <div className="flex-1 border-t border-gray-700"></div>
            </div>

            {/* Text input */}
            <textarea
              value={huntText}
              onChange={handleTextChange}
              placeholder="chill lo-fi, dusty vinyl feel, 85-95 BPM..."
              className="w-full bg-[#1E293B] border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 text-sm resize-none focus:border-[#81E4F2] focus:outline-none transition-colors"
              rows={2}
            />
          </div>
        )}
      </div>

      {/* Wake Up Button */}
      <button
        onClick={handleWakeUp}
        disabled={!hasInput || isSearching}
        className={`
          w-full py-3 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-2
          ${hasInput && !isSearching
            ? 'bg-[#81E4F2] text-slate-900 hover:bg-[#a3f3ff] cursor-pointer'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isSearching ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-900 border-t-transparent"></div>
            <span>Searching...</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            <span>Wake Up</span>
          </>
        )}
      </button>

      {/* Helper text */}
      {hasInput && !isSearching && (
        <p className="text-center text-xs text-gray-500">
          {mode === 'vibe'
            ? `Finding tracks similar to "${droppedTrack?.title}"`
            : 'Your agent will search for matching content'
          }
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface AgentVibeMatcherProps {
  onWakeUp: (mode: 'hunt', input: string) => void;
  isSearching?: boolean;
}

export default function AgentVibeMatcher({ onWakeUp, isSearching = false }: AgentVibeMatcherProps) {
  const [huntText, setHuntText] = useState("");

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHuntText(e.target.value);
  };

  const handleWakeUp = () => {
    if (huntText.trim()) {
      onWakeUp('hunt', huntText.trim());
    }
  };

  const hasInput = huntText.trim();

  return (
    <div className="space-y-4">
      {/* Input Area */}
      <div className="relative rounded-xl border border-gray-700 bg-[#0a0f1a]">
        <div className="p-4">
          <textarea
            value={huntText}
            onChange={handleTextChange}
            placeholder="chill lo-fi, dusty vinyl feel, 85-95 BPM..."
            className="w-full bg-[#1E293B] border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 text-sm resize-none focus:border-[#81E4F2] focus:outline-none transition-colors"
            rows={3}
          />
        </div>
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
          Your agent will search for matching content
        </p>
      )}
    </div>
  );
}

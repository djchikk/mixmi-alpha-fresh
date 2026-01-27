"use client";

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import AgentVibeMatcher from '@/components/agent/AgentVibeMatcher';
import { useMixer } from '@/contexts/MixerContext';

export default function AgentWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentSearching, setAgentSearching] = useState(false);
  const [agentResults, setAgentResults] = useState<{ count: number; message: string } | null>(null);

  const mixerContext = useMixer();
  const addTrackToCollection = mixerContext?.addTrackToCollection;

  // Load agent name from localStorage (default to "Bestie")
  useEffect(() => {
    const savedName = localStorage.getItem('agent-name');
    setAgentName(savedName || 'Bestie');
  }, []);

  // Expose openAgentWidget to window for Crate access
  useEffect(() => {
    (window as any).openAgentWidget = () => {
      setIsExpanded(true);
    };
    return () => {
      delete (window as any).openAgentWidget;
    };
  }, []);

  const handleClose = () => {
    setIsExpanded(false);
    setAgentResults(null);
  };

  const handleWakeUp = async (mode: 'hunt', input: string) => {
    setAgentSearching(true);
    setAgentResults(null);
    console.log('[Agent] Waking up in mode:', mode);
    console.log('[Agent] Input:', input);

    try {
      const response = await fetch('/api/agent/vibe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, input }),
      });

      const data = await response.json();

      if (data.success && data.tracks && data.tracks.length > 0) {
        console.log('[Agent] Found', data.tracks.length, 'tracks');

        // Add each track to the Crate with foundByAgent flag
        if (addTrackToCollection) {
          for (const track of data.tracks) {
            const ipTrack = {
              id: track.id,
              title: track.title,
              artist: track.artist,
              imageUrl: track.imageUrl || track.cover_image_url,
              cover_image_url: track.cover_image_url,
              audioUrl: track.audioUrl || track.stream_url, // API returns audioUrl (camelCase)
              audio_url: track.audioUrl || track.stream_url, // Some components expect snake_case
              stream_url: track.stream_url,
              bpm: track.bpm,
              content_type: track.content_type,
              video_url: track.video_url,
              price_stx: track.price_stx,
              price_usdc: track.price_usdc, // USDC price (primary pricing model)
              download_price_stx: track.download_price_stx,
              download_price_usdc: track.download_price_usdc, // USDC download price (primary)
              allow_downloads: track.allow_downloads,
              primary_uploader_wallet: track.primary_uploader_wallet,
              foundByAgent: true,
            };
            addTrackToCollection(ipTrack as any);
          }
        }

        const name = agentName || 'Your agent';
        setAgentResults({
          count: data.tracks.length,
          message: `${name} found ${data.tracks.length} track${data.tracks.length > 1 ? 's' : ''} and added to your Crate!`,
        });
      } else {
        setAgentResults({
          count: 0,
          message: 'No matching tracks found. Try different criteria.',
        });
      }
    } catch (error) {
      console.error('[Agent] Search error:', error);
      setAgentResults({
        count: 0,
        message: 'Search failed. Please try again.',
      });
    }

    setAgentSearching(false);
  };

  // Don't render anything if not expanded (trigger is in Crate)
  if (!isExpanded) {
    return null;
  }

  return (
    <div className="fixed left-6 z-[999]" style={{ top: '50%', transform: 'translateY(-50%)' }}>
      <div className="agent-widget-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {agentName || 'Agent'}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-xs mb-3">
          I'm still a baby! Try simple searches like "chill loops" or "radio from japan". I'll find matches and drop them into your crate.
        </p>

        {/* Vibe Matcher */}
        <AgentVibeMatcher
          onWakeUp={handleWakeUp}
          isSearching={agentSearching}
        />

        {/* Results message */}
        {agentResults && (
          <div className={`mt-3 p-2 rounded-lg text-xs ${
            agentResults.count > 0
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-gray-800 border border-gray-700 text-gray-400'
          }`}>
            <div className="flex items-center gap-2">
              <span>{agentResults.count > 0 ? '🤖' : '🔍'}</span>
              <span>{agentResults.message}</span>
            </div>
            {agentResults.count > 0 && (
              <p className="mt-1 text-[10px] text-gray-500">
                Check your Crate to see the tracks!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Widget Styles */}
      <style jsx>{`
        .agent-widget-container {
          position: relative;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border-radius: 0.75rem;
          width: 280px;
          padding: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(51, 65, 85, 0.5);
        }
      `}</style>
    </div>
  );
}

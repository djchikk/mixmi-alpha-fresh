"use client";

import React, { useState, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Track } from './types';
import { useMixer } from '@/contexts/MixerContext';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';

interface DeckCrateProps {
  deck: 'A' | 'B';
  currentTrack?: Track;
  loading?: boolean; // Hot-swap loading state
  className?: string;
}

interface DraggableTrackProps {
  track: Track;
  index: number;
  deck: 'A' | 'B';
  isCurrentTrack: boolean;
  showOverflow: boolean;
  crateLength: number;
  playingTrack: string | null;
  onTrackClick: (index: number) => void;
  onTrackRightClick: (e: React.MouseEvent, index: number) => void;
}

function DraggableTrack({
  track,
  index,
  deck,
  isCurrentTrack,
  showOverflow,
  crateLength,
  playingTrack,
  onTrackClick,
  onTrackRightClick
}: DraggableTrackProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CRATE_TRACK',
    item: () => {
      return {
        track,
        sourceDeck: deck,
        sourceIndex: index,
        sourceType: 'crate' // Mark as coming from crate
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag as any}
      className={`crate-track ${isDragging ? 'dragging' : ''} ${playingTrack === track.id ? 'audition-playing' : ''}`}
      onClick={(e) => {
        // Visual click feedback
        const element = e.currentTarget;
        element.style.transform = 'scale(0.95)';
        setTimeout(() => {
          element.style.transform = '';
        }, 100);
        onTrackClick(index);
      }}
      onContextMenu={(e) => onTrackRightClick(e, index)}
      title={`${track.title} by ${track.artist}\nLeft click: Audition (20s preview)\nRight click: Remove from crate\nDrag: Load to any deck`}
    >
      <div className="crate-track-content">
        <img
          src={getOptimizedTrackImage({ ...track, imageUrl: track.cover_image_url || track.imageUrl }, 128)}
          alt={track.title}
          className="crate-track-image"
          draggable={false} // Prevent native image drag
        />
        <div 
          className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-[10px] text-white/90 font-mono"
        >
          {track.bpm}
        </div>
      </div>
      
      {/* Show overflow indicator on the 4th track if there are more */}
      {showOverflow && (
        <div className="overflow-indicator">
          +{crateLength - 3}
        </div>
      )}
    </div>
  );
}

export default function DeckCrate({ deck, currentTrack, loading = false, className = "" }: DeckCrateProps) {
  const { deckACrate, deckBCrate, removeTrackFromCrate, addTrackToCrate } = useMixer();
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const crate = deck === 'A' ? deckACrate : deckBCrate;
  const maxVisible = 4;
  
  // Set up drop zone for the crate
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'DECK_TRACK'], // Accept deck tracks too!
    drop: (item: { track: Track; sourceDeck?: string; sourceIndex: number; sourceType?: string }) => {
      console.log(`📦 Crate ${deck} received drop:`, { sourceType: item.sourceType, sourceDeck: item.sourceDeck, track: item.track.title });

      // Only block drops from the same CRATE (not from deck)
      if (item.sourceType === 'crate' && item.sourceDeck === deck) {
        console.log(`🚫 Blocked: Can't drop track from crate ${deck} back onto same crate`);
        return;
      }

      console.log(`✅ Accepting drop from ${item.sourceType || 'unknown'} to crate ${deck}`);

      // Convert track format if needed - CRITICAL: Preserve cover_image_url for high-res
      const trackToAdd = {
        id: item.track.id,
        title: item.track.title,
        artist: item.track.artist,
        cover_image_url: item.track.cover_image_url || item.track.imageUrl, // Use original high-res URL
        audio_url: item.track.audioUrl,
        bpm: item.track.bpm,
        content_type: 'loop' as const
      };

      // Add to this crate (displacing last if full)
      addTrackToCrate(trackToAdd as any, deck);
    },
    canDrop: (item) => {
      console.log(`🔍 Crate ${deck} canDrop check:`, { type: item, accepts: ['CRATE_TRACK', 'COLLECTION_TRACK', 'DECK_TRACK'] });
      return true;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [deck, addTrackToCrate]);

  const handleTrackClick = (index: number) => {
    const track = crate[index];
    if (!track || !track.audioUrl) {
      return;
    }


    // If clicking the same track that's playing, pause it
    if (playingTrack === track.id && currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
      setPlayingTrack(null);
      setCurrentAudio(null);
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        setPreviewTimeout(null);
      }
      return;
    }

    // Stop any currently playing track
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
    }

    // Start new audition with MC Claude's robust audio system
    
    try {
      // Create completely fresh audio element each time (MC Claude's pattern)
      const audio = new Audio();
      
      // Set crossOrigin BEFORE setting src (critical order per MC Claude)
      audio.crossOrigin = 'anonymous';
      audio.volume = 0.7; // Slightly lower for audition
      audio.preload = 'auto';
      
      // Add timestamp to bypass caching completely (MC Claude's "nuclear option")
      const cacheBusterSrc = `${track.audioUrl}?t=${Date.now()}`;
      audio.src = cacheBusterSrc;

      audio.addEventListener('canplaythrough', () => {
        audio.play()
          .then(() => {
            setPlayingTrack(track.id);
            setCurrentAudio(audio);
            
            // 20-second preview timeout
            const timeout = setTimeout(() => {
              audio.pause();
              audio.remove();
              setPlayingTrack(null);
              setCurrentAudio(null);
              setPreviewTimeout(null);
            }, 20000);
            
            setPreviewTimeout(timeout);
          })
          .catch(error => {
            console.error('🚨 Audition playback failed:', error);
          });
      }, { once: true });

      audio.addEventListener('error', (e) => {
        console.error('🚨 Audition audio error:', e);
      }, { once: true });

    } catch (error) {
      console.error('🚨 Failed to create audition audio:', error);
    }
  };

  const handleTrackRightClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    removeTrackFromCrate(index, deck);
  };

  // Cleanup audition on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.remove();
        if (previewTimeout) {
          clearTimeout(previewTimeout);
        }
      }
    };
  }, [currentAudio, previewTimeout]);

  if (crate.length === 0) {
    return (
      <div ref={drop} className={`deck-crate deck-crate-${deck.toLowerCase()} ${className}`}>
        <div 
          style={{
            width: '124px',
            height: '124px',
            border: isOver ? '2px dashed #81E4F2' : '2px dashed rgba(71, 85, 105, 0.4)',
            borderRadius: '8px',
            background: isOver ? 'rgba(129, 228, 242, 0.1)' : 'rgba(15, 23, 42, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            cursor: 'default'
          }}
          className="crate-empty-state"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(129, 228, 242, 0.5)';
            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.4)';
            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.2)';
          }}
        >
          <div 
            style={{
              textAlign: 'center',
              padding: '16px'
            }}
          >
            <div 
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: '500',
                lineHeight: '1.2',
                opacity: '0.8'
              }}
            >
              Deck {deck} Crate
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`deck-crate deck-crate-${deck.toLowerCase()} ${className}`}
      style={{
        position: 'relative'
      }}>
      {/* Loading overlay */}
      {loading && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: '8px',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div 
              className="animate-spin"
              style={{
                width: '24px',
                height: '24px',
                border: '2px solid rgba(129, 228, 242, 0.3)',
                borderTop: '2px solid #81E4F2',
                borderRadius: '50%',
                margin: '0 auto 8px'
              }}
            />
            <div style={{ fontSize: '10px', color: '#81E4F2', fontWeight: '500' }}>
              Loading...
            </div>
          </div>
        </div>
      )}
      
      {/* No header when crate has tracks - cleaner look */}
      <div
        ref={drop}
        className="crate-tracks"
        style={{
          ...(isOver && canDrop && {
            backgroundColor: 'rgba(129, 228, 242, 0.15)',
            outline: '2px solid #81E4F2'
          })
        }}
      >
        {Array.from({ length: 4 }, (_, index) => {
          const track = crate[index];
          const isCurrentTrack = track && currentTrack?.id === track.id;
          const showOverflow = index === 3 && crate.length > 4;

          if (!track) {
            return (
              <div key={`empty-${index}`} className="crate-track empty">
                {/* Empty slot */}
              </div>
            );
          }

          return (
            <DraggableTrack
              key={`${track.id}-${index}`}
              track={track}
              index={index}
              deck={deck}
              isCurrentTrack={isCurrentTrack}
              showOverflow={showOverflow}
              crateLength={crate.length}
              playingTrack={playingTrack}
              onTrackClick={handleTrackClick}
              onTrackRightClick={handleTrackRightClick}
            />
          );
        })}
      </div>
      
      <style>{`
        .deck-crate {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 124px;
          max-width: 124px;
        }
        
        .crate-empty {
          width: 124px;
          height: 124px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px dashed #475569;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }
        
        .crate-tracks {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 4px;
          width: 124px;
          height: 124px;
        }
        
        .crate-track {
          position: relative;
          width: 58px;
          height: 58px;
          border-radius: 4px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid rgba(71, 85, 105, 0.3);
          opacity: 0.7;
          contain: strict;
          clip-path: inset(0);
        }

        .crate-track.dragging {
          transform: rotate(5deg) scale(1.1) !important;
          z-index: 1000 !important;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4) !important;
          opacity: 0.5 !important;
        }
        
        .crate-track:hover {
          opacity: 1 !important;
          transform: scale(1.1) !important;
          border-color: #81E4F2 !important;
          box-shadow: 0 0 16px rgba(129, 228, 242, 0.6) !important;
          z-index: 10 !important;
          transition: all 0.15s ease !important;
        }
        
        .crate-track:active {
          transform: scale(0.95) !important;
          transition: all 0.1s ease !important;
        }
        
        
        .crate-track-content {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          overflow: hidden;
          position: relative;
        }
        
        .crate-track-image {
          flex: 1;
          width: 100%;
          object-fit: cover;
        }
        
        .track-bpm-container {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 16px;
          height: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.9);
          border-radius: 1px;
          border: 1px solid rgba(129, 228, 242, 0.3);
          box-sizing: border-box;
          transform: scale(0.91) !important;
          transform-origin: bottom right;
        }
        
        .track-bpm-text {
          font-size: 5px;
          color: #81E4F2;
          font-weight: 700;
          text-shadow: 0 0 1px rgba(0,0,0,1);
          line-height: 1;
          font-family: 'Courier New', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 14px;
        }
        
        .crate-track.empty {
          background: rgba(15, 23, 42, 0.3);
          border: 1px dashed rgba(71, 85, 105, 0.3);
          opacity: 0.5;
          pointer-events: none; /* Allow drops to pass through empty slots */
        }
        
        /* Beautiful dotted-line empty state */
        .crate-empty-state {
          width: 124px;
          height: 124px;
          border: 2px dashed rgba(71, 85, 105, 0.4);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        .crate-empty-state:hover {
          border-color: rgba(129, 228, 242, 0.5);
          background: rgba(15, 23, 42, 0.3);
        }
        
        .empty-content {
          text-align: center;
          padding: 16px;
        }
        
        .empty-text {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
          line-height: 1.2;
          opacity: 0.8;
        }
        
        .overflow-indicator {
          position: absolute;
          top: 2px;
          right: 2px;
          background: rgba(0, 0, 0, 0.8);
          color: #81E4F2;
          font-size: 8px;
          font-weight: 600;
          padding: 1px 3px;
          border-radius: 2px;
          line-height: 1;
        }
        
        /* Deck-specific styling */
        .deck-crate-a .crate-track:hover {
          border-color: #81E4F2;
        }
        
        .deck-crate-b .crate-track:hover {
          border-color: #81E4F2;
        }
      `}</style>
    </div>
  );
} 
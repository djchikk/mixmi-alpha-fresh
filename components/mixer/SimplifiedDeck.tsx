"use client";

import React, { useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { Track } from './types';
import { useToast } from '@/contexts/ToastContext';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import InfoIcon from '@/components/shared/InfoIcon';
import TrackDetailsModal from '@/components/modals/TrackDetailsModal';
import { IPTrack } from '@/types';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface SimplifiedDeckProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onTrackDrop?: (track: Track) => void;
  onClearDeck?: () => void;
  onAddToCart?: (track: Track) => void;
  deck: 'A' | 'B';
  className?: string;
  trackInfoPosition?: 'left' | 'right' | 'bottom' | 'none';
}

export default function SimplifiedDeck({
  currentTrack,
  isPlaying,
  isLoading = false,
  onTrackDrop,
  onClearDeck,
  onAddToCart,
  deck,
  className = '',
  trackInfoPosition = 'bottom'
}: SimplifiedDeckProps) {
  const { showToast } = useToast();
  const [isNewTrackLoaded, setIsNewTrackLoaded] = useState(false);
  const [previousTrackId, setPreviousTrackId] = useState(currentTrack?.id);
  const [isHovered, setIsHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // Drop functionality for collection tracks
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD'],
    drop: (item: { track: any; sourceDeck?: string; sourceIndex: number }) => {
      console.log(`🎯 Deck ${deck} received drop:`, item);

      if (onTrackDrop) {
        console.log(`✅ Calling onTrackDrop for Deck ${deck}`);

        // 🎛️ SMART FILTERING: Only allow loops in mixer
        if (item.track.content_type !== 'loop') {
          const contentTypeName = item.track.content_type === 'loop_pack' ? 'Loop Pack'
            : item.track.content_type === 'ep' ? 'EP'
            : item.track.content_type === 'full_song' ? 'Song' : 'content';

          console.log(`🚫 Mixer: Rejected ${contentTypeName} - Only loops allowed`);

          showToast(`🎛️ Only 8-bar loops can be mixed! Try dragging ${contentTypeName}s to the Crate instead.`, 'info');
          return;
        }

        // Ensure track has all needed fields for linking
        const mixerTrack = {
          ...item.track,
          primary_uploader_wallet: item.track.primary_uploader_wallet
        };

        onTrackDrop(mixerTrack);
      } else {
        console.warn(`❌ No onTrackDrop handler for Deck ${deck}`);
      }
    },
    canDrop: (item) => {
      return true;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [onTrackDrop, deck, showToast]);

  // Fetch username for the track's primary uploader wallet
  useEffect(() => {
    const fetchUsername = async () => {
      if (!currentTrack?.primary_uploader_wallet) {
        setUsername(null);
        return;
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('wallet_address', currentTrack.primary_uploader_wallet)
        .single();

      setUsername(data?.username || null);
    };

    fetchUsername();
  }, [currentTrack?.primary_uploader_wallet]);

  // Detect when a new track is loaded
  useEffect(() => {
    if (currentTrack && currentTrack.id !== previousTrackId) {
      setIsNewTrackLoaded(true);
      setPreviousTrackId(currentTrack.id);

      // Reset the animation after a short duration
      const timeout = setTimeout(() => {
        setIsNewTrackLoaded(false);
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [currentTrack?.id, previousTrackId]);

  // Handle clear/dismiss click
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClearDeck) {
      onClearDeck();
    }
  };

  // Handle cart click
  const handleCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTrack && onAddToCart) {
      onAddToCart(currentTrack);
    }
  };

  // Handle info click
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  // Convert Track to IPTrack for TrackDetailsModal
  const convertToIPTrack = (track: Track): IPTrack => {
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: track.bpm,
      audio_url: track.audioUrl || '',
      cover_image_url: track.imageUrl || track.cover_image_url || '',
      content_type: track.content_type || 'loop',
      primary_uploader_wallet: track.primary_uploader_wallet,
      price_stx: track.price_stx,
      download_price_stx: track.download_price_stx,
      allow_downloads: track.allow_downloads,
      created_at: track.created_at || new Date().toISOString(),
      updated_at: track.updated_at || new Date().toISOString()
    } as IPTrack;
  };

  return (
    <div className={`flex ${trackInfoPosition === 'left' ? 'flex-row-reverse' : trackInfoPosition === 'right' ? 'flex-row' : 'flex-col'} ${trackInfoPosition === 'bottom' ? '' : 'items-center'} ${trackInfoPosition === 'bottom' ? '' : 'gap-4'} ${className}`}>
      <div
        ref={drop as any}
        className="relative flex-shrink-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`carousel-track current ${currentTrack ? 'has-track' : ''} ${isPlaying ? 'playing' : ''} ${isNewTrackLoaded ? 'new-track-loaded' : ''} ${isOver && canDrop ? 'drop-target' : ''}`}
          style={{
            border: isOver && canDrop ? '3px solid #00FF88' : undefined
          }}
        >
          {currentTrack ? (
            <>
              <img
                src={getOptimizedTrackImage({ ...currentTrack, imageUrl: currentTrack.cover_image_url || currentTrack.imageUrl }, 480)}
                alt={currentTrack.title}
              />

              {/* Subtle dark overlay - always visible */}
              <div className="absolute inset-0 bg-black opacity-20 pointer-events-none"></div>

              {/* Hover overlay - darker */}
              {isHovered && (
                <div className="absolute inset-0 bg-black bg-opacity-60 pointer-events-none"></div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-30">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                </div>
              )}

              {/* Hover overlay - shows controls on hover */}
              {isHovered && (
                <>
                  {/* Info Icon - Left side */}
                  <div className="absolute left-1 top-1/2 transform -translate-y-1/2 z-10">
                    <InfoIcon
                      size="md"
                      onClick={handleInfoClick}
                      title="View track details"
                      className="text-white hover:text-white"
                    />
                  </div>

                  {/* Dismiss/Clear Button - Top right */}
                  {onClearDeck && (
                    <button
                      onClick={handleClear}
                      title="Clear deck"
                      className="absolute top-1 right-1 w-6 h-6 bg-red-900/50 hover:bg-red-600 rounded flex items-center justify-center transition-all border border-red-700 hover:border-red-500 z-10"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {/* Price/Cart Button - Bottom left */}
                  {onAddToCart && (
                    <div className="absolute bottom-2 left-2 z-10">
                  {(() => {
                    // Check download_price_stx first (new model)
                    if (currentTrack.download_price_stx !== null && currentTrack.download_price_stx !== undefined) {
                      return currentTrack.download_price_stx === 0 ? (
                        <button
                          onClick={handleCartClick}
                          className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                          title="Free - click to add to cart"
                        >
                          Free
                        </button>
                      ) : (
                        <button
                          onClick={handleCartClick}
                          className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                          title="Add to cart"
                        >
                          {currentTrack.download_price_stx}
                        </button>
                      );
                    }
                    // Fallback to legacy price_stx
                    if (currentTrack.price_stx) {
                      return (
                        <button
                          onClick={handleCartClick}
                          className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                          title="Add to cart"
                        >
                          {currentTrack.price_stx}
                        </button>
                      );
                    }
                    // Remix-only badge
                    return (
                      <div
                        className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                        title="Platform remix only - 1 STX per recorded remix"
                      >
                        M
                      </div>
                    );
                  })()}
                    </div>
                  )}
                </>
              )}

              {/* BPM Badge - Bottom right (always visible) */}
              <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-white font-mono font-bold text-sm z-10">
                {currentTrack.bpm}
              </div>
            </>
          ) : (
            <div className="deck-empty">
              <span className="deck-empty-icon">+</span>
              <span className="deck-empty-text">Load Loop</span>
            </div>
          )}

          {isOver && canDrop && (
            <div className="absolute inset-0 bg-cyan-400 opacity-10 rounded-lg flex items-center justify-center">
              <div className="text-white font-bold text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                Drop to Load
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Track Info Display */}
      {currentTrack && trackInfoPosition !== 'none' && (
        <div className={`max-w-[140px] ${trackInfoPosition === 'bottom' ? 'mt-2 text-center' : ''} ${trackInfoPosition === 'left' ? 'text-left' : trackInfoPosition === 'right' ? 'text-left' : 'text-center'}`}>
          {currentTrack.primary_uploader_wallet ? (
            <Link
              href={username ? `/store/${username}` : `/store/${currentTrack.primary_uploader_wallet}`}
              className="text-white text-sm font-bold truncate hover:text-[#81E4F2] transition-colors block"
              onClick={(e) => e.stopPropagation()}
            >
              {currentTrack.title} - {currentTrack.bpm}
            </Link>
          ) : (
            <div className="text-white text-sm font-bold truncate">
              {currentTrack.title} - {currentTrack.bpm}
            </div>
          )}
          {currentTrack.primary_uploader_wallet ? (
            <Link
              href={username ? `/profile/${username}` : `/profile/${currentTrack.primary_uploader_wallet}`}
              className="text-slate-400 text-xs truncate hover:text-[#81E4F2] transition-colors block"
              onClick={(e) => e.stopPropagation()}
            >
              by {currentTrack.artist} →
            </Link>
          ) : (
            <div className="text-slate-400 text-xs truncate">
              by {currentTrack.artist} →
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .carousel-track {
          width: 140px;
          height: 140px;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        
        .carousel-track img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .carousel-track.current {
          position: relative;
          z-index: 2;
          border: 2px solid transparent;
        }
        
        .carousel-track.current.has-track {
          border: 2px solid #81E4F2;
          animation: softGlow 4s ease-in-out infinite;
        }
        
        .carousel-track.current.new-track-loaded {
          border-color: #81E4F2 !important;
        }
        
        @keyframes softGlow {
          0%, 100% { 
            box-shadow: 0 0 6px rgba(129, 228, 242, 0.3);
            border-color: #81E4F2;
            opacity: 0.85;
          }
          50% { 
            box-shadow: 0 0 16px rgba(129, 228, 242, 0.5);
            border-color: #93E8F4;
            opacity: 1;
          }
        }
        
        .carousel-track.current.playing {
          border-color: #81E4F2 !important;
        }
        
        .deck-empty {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #1A1A2E;
          color: #64748B;
          font-size: 13px;
          font-weight: 500;
          position: relative;
        }
        
        .deck-empty-icon {
          font-size: 28px;
          color: #475569;
          margin-bottom: 6px;
          opacity: 0.8;
        }
        
        .deck-empty-text {
          color: #64748B;
          font-size: 12px;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .carousel-track.drop-target {
          transform: scale(1.05);
          border-color: #00FF88 !important;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
        }
      `}</style>

      {/* Track Details Modal */}
      {currentTrack && (
        <TrackDetailsModal
          track={convertToIPTrack(currentTrack)}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMixer } from '@/contexts/MixerContext';
import { useDrop, useDrag } from 'react-dnd';
import { IPTrack } from '@/types';
import { Play, Pause, Info, GripVertical } from 'lucide-react';
import TrackCard from '@/components/cards/TrackCard';
import TrackDetailsModal from '@/components/modals/TrackDetailsModal';
import InfoIcon from '@/components/shared/InfoIcon';
import { createPortal } from 'react-dom';

// Extend window interface for global handlers
declare global {
  interface Window {
    handleGlobeComparisonTrack?: (track: any) => void;
  }
}

interface CrateProps {
  className?: string;
}

// Draggable track component for mixer context
interface DraggableTrackProps {
  track: any;
  index: number;
  children: React.ReactNode;
}

function DraggableTrack({ track, index, children }: DraggableTrackProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'COLLECTION_TRACK',
    item: () => {
      console.log('🎪 Crate track being dragged:', track);
      return { 
        track: {
          id: track.id,
          title: track.title,
          artist: track.artist,
          imageUrl: track.imageUrl,
          bpm: track.bpm || 120,
          audioUrl: track.audioUrl || track.audio_url, // Handle both formats like deck conversion!
          content_type: track.content_type,
          price_stx: track.price_stx,
          license: track.license
        },
        sourceIndex: index
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track, index]);

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {children}
    </div>
  );
}

// Cart drop zone component
interface CartDropZoneProps {
  onDrop: (track: any) => void;
  children: React.ReactNode;
}

function CartDropZone({ onDrop, children }: CartDropZoneProps) {
  const [{ isOver: isOverCart, canDrop }, drop] = useDrop(() => ({
    accept: 'COLLECTION_TRACK',
    drop: (item: { track: any }) => {
      onDrop(item.track);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [onDrop]);

  return (
    <div ref={drop}>
      {React.cloneElement(children as React.ReactElement, {
        className: `${(children as React.ReactElement).props.className} ${isOverCart ? 'ring-2 ring-[#81E4F2] scale-105' : ''}`
      })}
    </div>
  );
}

// Cart item interface
interface CartItem {
  id: string;
  title: string;
  artist: string;
  price_stx: string;
  license?: string;
}

export default function Crate({ className = '' }: CrateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cartPopoverRef = useRef<HTMLDivElement>(null);
  const { collection, addTrackToCollection, removeTrackFromCollection } = useMixer();
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDropAnimation, setShowDropAnimation] = useState(false);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackCount, setTrackCount] = useState(0);
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartPopover, setShowCartPopover] = useState(false);
  const [cartPinned, setCartPinned] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  
  // Determine current context based on pathname
  const getContext = (): 'store' | 'globe' | 'mixer' => {
    if (pathname.startsWith('/store')) return 'store';
    if (pathname === '/mixer' || pathname === '/globe-mixer-test') return 'mixer';
    return 'globe'; // Default to globe for root path
  };
  
  const context = getContext();
  
  // Update track count after hydration to avoid mismatch
  useEffect(() => {
    setTrackCount(collection.length);
  }, [collection.length]);

  // Set up drop zone
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'TRACK_CARD',
    drop: (item: { track: IPTrack }) => {
      // Check if track already exists
      const exists = collection.some(t => t.id === item.track.id);
      if (!exists) {
        // Add to collection (always to the end)
        addTrackToCollection(item.track);
        // Show drop animation
        setShowDropAnimation(true);
        setTimeout(() => setShowDropAnimation(false), 600);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [collection, addTrackToCollection]);
  
  // Expose addToCollection globally for other components
  useEffect(() => {
    (window as any).addToCollection = (track: any) => {
      // Check if track already exists
      const exists = collection.some(t => t.id === track.id);
      if (!exists) {
        addTrackToCollection(track);
      }
    };
    
    return () => {
      delete (window as any).addToCollection;
    };
  }, [collection, addTrackToCollection]);

  // Handle track preview
  const handleTrackClick = (track: any) => {
    if (!track.audioUrl) return;

    // If clicking the same track that's playing, pause it
    if (playingTrack === track.id && currentAudio) {
      currentAudio.pause();
      setPlayingTrack(null);
      setCurrentAudio(null);
      return;
    }

    // Stop any currently playing track
    if (currentAudio) {
      currentAudio.pause();
    }

    // Start new preview
    const audio = new Audio(track.audioUrl);
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.7;
    
    audio.play()
      .then(() => {
        setPlayingTrack(track.id);
        setCurrentAudio(audio);
        
        // Auto-stop after 20 seconds
        setTimeout(() => {
          if (audio && !audio.paused) {
            audio.pause();
            setPlayingTrack(null);
            setCurrentAudio(null);
          }
        }, 20000);
      })
      .catch(error => {
        console.error('Preview playback failed:', error);
      });
  };

  // Handle track removal
  const handleRemoveTrack = (index: number) => {
    removeTrackFromCollection(index);
  };

  // Cart functions
  const addToCart = (track: any) => {
    // Check if already in cart
    const exists = cart.some(item => item.id === track.id);
    if (!exists) {
      const cartItem: CartItem = {
        id: track.id,
        title: track.title || track.name,
        artist: track.artist || 'Unknown Artist',
        price_stx: track.price_stx || '5',
        license: track.license || 'Standard'
      };
      setCart([...cart, cartItem]);
      
      // Pulse animation
      setCartPulse(true);
      setTimeout(() => setCartPulse(false), 300);
    }
  };

  const removeFromCart = (trackId: string) => {
    setCart(cart.filter(item => item.id !== trackId));
  };

  const clearCart = () => {
    setCart([]);
    setShowCartPopover(false);
  };

  const purchaseAll = () => {
    console.log('🛒 Purchasing cart:', cart);
    console.log('Total STX:', cartTotal);
    // TODO: Integrate with Stacks wallet
    clearCart();
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = parseFloat(item.price_stx) || 0;
    return sum + price;
  }, 0);

  const isInCart = (trackId: string) => {
    return cart.some(item => item.id === trackId);
  };

  // Handle click outside cart popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!cartPinned && cartPopoverRef.current && !cartPopoverRef.current.contains(event.target as Node)) {
        setShowCartPopover(false);
      }
    };

    if (showCartPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCartPopover, cartPinned]);

  // Expose addToCart globally
  useEffect(() => {
    (window as any).addToCart = addToCart;
    return () => {
      delete (window as any).addToCart;
    };
  }, [cart]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, [currentAudio]);

  // Hide collection bar on profile and docs pages - must be after ALL hooks
  // But show it on certificates (vault) page so users can drag loops into it
  if (pathname === '/profile') {
    return null;
  }

  // Handle navigation - back or to mixer
  const handleNavigation = () => {
    if (context === 'mixer') {
      router.back();
    } else {
      router.push('/mixer');
    }
  };

  // Determine border color based on content type
  const getBorderColor = (track: any) => {
    switch (track.content_type) {
      case 'full_song':
        return 'border-[#FFE4B5] shadow-[#FFE4B5]/50';
      case 'ep':
        return 'border-[#FFE4B5] shadow-[#FFE4B5]/50';
      case 'loop':
        return 'border-[#9772F4] shadow-[#9772F4]/50';
      case 'loop_pack':
        return 'border-[#9772F4] shadow-[#9772F4]/50';
      default:
        return 'border-[#9772F4] shadow-[#9772F4]/50';
    }
  };

  // Determine border thickness - thicker for multi-content (loop packs and EPs)
  const getBorderThickness = (track: any) => {
    return (track.content_type === 'loop_pack' || track.content_type === 'ep') ? 'border-4' : 'border-2';
  };


  // Collapsed state - minimal bar
  if (isCollapsed) {
    return (
      <div 
        className={`collection-bar-collapsed ${className}`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40px',
          background: 'rgba(10, 10, 11, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={() => setIsCollapsed(false)}
      >
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1
        }}>
          <div style={{ 
            color: '#E8E5FF',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            Crate ({trackCount})
          </div>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px',
              transition: 'color 0.2s'
            }}
            className="hover:text-white"
            title="Expand crate"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 14L12 9L17 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div 
      ref={drop}
      className={`collection-bar ${className} ${isOver ? 'drag-over' : ''}`}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: isOver ? 'rgba(129, 228, 242, 0.1)' : 'rgba(10, 10, 11, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: isOver ? '2px solid #81E4F2' : '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '20px',
        animation: 'slideUp 0.3s ease-out',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Left side: Crate label and collapse button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '200px',
        flexShrink: 0
      }}>
        <div style={{ 
          color: '#E8E5FF',
          fontSize: '16px',
          fontWeight: '600',
          whiteSpace: 'nowrap'
        }}>
          Crate ({trackCount})
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '4px',
            transition: 'color 0.2s'
          }}
          className="hover:text-white"
          title="Collapse crate"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="rotate-180"
          >
            <path
              d="M7 14L12 9L17 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </div>

      {/* Center: Scrollable track list or empty state */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollBehavior: 'smooth',
          padding: '4px 0',
          // Hide scrollbar but keep functionality
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="collection-scroll"
      >
        {trackCount === 0 ? (
          // Empty state
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            Your crate is empty — drag content from the cards on the globe, mixer, or search results to add them here
          </div>
        ) : (
          // Track list
          collection.map((track, index) => {
            const isDraggable = (context === 'mixer' || context === 'globe' || context === 'store') && track.content_type !== 'full_song';
            
            const trackElement = (
              <div
                key={`${track.id}-${index}`}
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  group: true
                }}
                className={`track-item group ${showDropAnimation && index === collection.length - 1 ? 'drop-animation' : ''}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  addToCart(track);
                }}
              >
            
            {/* Track thumbnail */}
            <div
              onClick={() => handleTrackClick(track)}
              onMouseEnter={() => setHoveredTrackId(track.id)}
              onMouseLeave={() => setHoveredTrackId(null)}
              className={`cursor-pointer transition-all ${getBorderColor(track)} ${getBorderThickness(track)} ${isInCart(track.id) ? 'ring-2 ring-[#81E4F2] ring-offset-1 ring-offset-black' : ''}`}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: '#1a1a1a'
              }}
              title="Click to preview"
            >
              {track.imageUrl ? (
                <img 
                  src={track.imageUrl} 
                  alt={track.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}>
                  <svg className="w-6 h-6 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
              
              {/* Context-aware hover overlay */}
              {hoveredTrackId === track.id && (
                <>
                  {/* Store context: Drag handle, cart button, and info icon */}
                  {context === 'store' && (
                    <>
                      <div 
                        className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5 text-white/90" 
                        title="Drag to cart"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(track);
                        }}
                        className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm rounded p-0.5 text-white/90 hover:bg-black/80 transition-colors"
                        title="Add to cart"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                      <InfoIcon
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTrack(track);
                          setShowInfoModal(true);
                        }}
                        className="absolute top-1 right-1"
                      />
                    </>
                  )}

                  {/* Globe context: Drag indicator, cart button, and info icon */}
                  {context === 'globe' && (
                    <>
                      <div 
                        className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5 text-white/90" 
                        title="Drag to mixer or cart"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(track);
                        }}
                        className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm rounded p-0.5 text-white/90 hover:bg-black/80 transition-colors"
                        title="Add to cart"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                      <InfoIcon
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Globe-specific behavior: trigger comparison
                          if (window.handleGlobeComparisonTrack) {
                            window.handleGlobeComparisonTrack(track);
                          }
                        }}
                        className="absolute top-1 right-1"
                        title="Click for details"
                      />
                    </>
                  )}

                  {/* Mixer context: Drag indicator, cart button, and info icon */}
                  {context === 'mixer' && (
                    <>
                      {track.content_type !== 'full_song' && (
                        <div 
                          className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5 text-white/90" 
                          title="Drag to deck or cart"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(track);
                        }}
                        className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm rounded p-0.5 text-white/90 hover:bg-black/80 transition-colors"
                        title="Add to cart"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                      <InfoIcon
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTrack(track);
                          setShowInfoModal(true);
                        }}
                        className="absolute top-1 right-1"
                        title="View track details"
                      />
                    </>
                  )}
                </>
              )}

              {/* Playing indicator (always visible when playing) */}
              {playingTrack === track.id && hoveredTrackId !== track.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-green-400 animate-pulse" />
                    <div className="w-1 h-3 bg-green-400 animate-pulse animation-delay-200" />
                    <div className="w-1 h-3 bg-green-400 animate-pulse animation-delay-400" />
                  </div>
                </div>
              )}

              {/* BPM overlay for mixer (always) and store/globe (on hover) contexts */}
              {(context === 'mixer' || ((context === 'store' || context === 'globe') && hoveredTrackId === track.id)) && (
                <div className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-[10px] text-white/90 font-mono">
                  {track.bpm || 120}
                </div>
              )}
            </div>

            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTrack(index);
              }}
              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#ff4757',
                border: '2px solid #0A0A0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
              </div>
            );
            
            // Wrap in DraggableTrack if in mixer context and not a song
            return isDraggable ? (
              <DraggableTrack key={`${track.id}-${index}`} track={track} index={index}>
                {trackElement}
              </DraggableTrack>
            ) : trackElement;
          })
        )}
      </div>

      {/* Right side: Cart, navigation and launch button */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: '200px',
        flexShrink: 0
      }}>
        {/* Cart Icon and Popover */}
        <div style={{ position: 'relative' }}>
          {/* Cart Drop Zone */}
          <CartDropZone onDrop={addToCart}>
            <button
              onClick={() => setShowCartPopover(!showCartPopover)}
              className={`
                cart-icon flex items-center gap-1 p-1.5
                hover:bg-[#1E293B] rounded transition-all
                ${cartPulse ? 'animate-pulse' : ''}
              `}
              style={{ fontFamily: 'monospace', fontSize: '14px' }}
            >
              <svg className="w-5 h-5 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cart.length > 0 && (
                <span className="text-gray-400 text-xs">({cart.length})</span>
              )}
            </button>
          </CartDropZone>

          {/* Cart Popover */}
          {showCartPopover && (
            <div
              ref={cartPopoverRef}
              className="absolute bottom-full mb-2 right-0 w-80 bg-[#101726]/95 backdrop-blur-sm border border-[#1E293B] rounded-lg shadow-xl z-50"
              style={{ fontFamily: 'monospace' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-[#1E293B]">
                <span className="text-sm text-white">Cart ({cart.length} items)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCartPinned(!cartPinned)}
                    className="p-1 hover:bg-[#1E293B] rounded transition-colors"
                    title={cartPinned ? "Unpin cart" : "Pin cart"}
                  >
                    {cartPinned ? '📌' : '📍'}
                  </button>
                  <button
                    onClick={() => setShowCartPopover(false)}
                    className="p-1 hover:bg-[#1E293B] rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              {cart.length > 0 ? (
                <>
                  <div className="max-h-60 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="group flex justify-between items-center p-3 hover:bg-[#1E293B]/50 border-b border-[#151C2A] last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white truncate">{item.title}</div>
                          <div className="text-xs text-gray-500 truncate">{item.artist}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#81E4F2]">{item.price_stx} STX</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#252a3a] rounded transition-all"
                            title="Remove from cart"
                          >
                            <svg className="w-3 h-3 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="p-3 border-t border-[#1E293B]">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-400">Total:</span>
                      <span className="text-sm text-white font-bold">{cartTotal.toFixed(1)} STX</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={clearCart}
                        className="flex-1 px-3 py-2 bg-[#1E293B] hover:bg-[#252a3a] text-gray-400 hover:text-white rounded text-xs transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={purchaseAll}
                        className="flex-1 px-3 py-2 bg-[#81E4F2] hover:bg-[#6BC8D6] text-black font-medium rounded text-xs transition-colors"
                      >
                        Purchase All →
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-gray-500 text-xs">
                  Cart is empty
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scroll indicator if needed */}
        {collection.length > 8 && (
          <button
            onClick={() => {
              if (scrollRef.current) {
                scrollRef.current.scrollLeft += 300;
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            className="hover:bg-white/20"
          >
            →
          </button>
        )}

        {/* Navigation button - Back or Full Mixer */}
        <button
          onClick={handleNavigation}
          className="px-4 py-2 text-sm text-gray-300 font-medium rounded-md border border-white/20 hover:border-white/30 transition-all"
          style={{
            backgroundColor: '#061F3C',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexDirection: context === 'mixer' ? 'row-reverse' : 'row'
          }}
        >
          {context === 'mixer' ? 'Back' : 'Big Mixer'}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              transform: context === 'mixer' ? 'rotate(180deg)' : 'none'
            }}
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* CSS for animations and scrollbar hiding */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .collection-scroll::-webkit-scrollbar {
          display: none;
        }

        .track-item:hover > div:first-child {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        @keyframes dropBounce {
          0% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          50% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .drop-animation {
          animation: dropBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>

      {/* Drop indicator when dragging over */}
      {isOver && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 1001 }}
        >
          <div className="text-white text-lg font-semibold bg-black/80 px-6 py-3 rounded-lg">
            Drop to add to crate
          </div>
        </div>
      )}

      {/* Info Modal for Store Context */}
      {showInfoModal && selectedTrack && context === 'store' && (
        <TrackDetailsModal
          track={{
            ...selectedTrack,
            cover_image_url: selectedTrack.imageUrl,
            audio_url: selectedTrack.audioUrl,
            // Add any other missing fields that TrackDetailsModal expects
            tags: selectedTrack.tags || [],
            description: selectedTrack.description || '',
            tell_us_more: selectedTrack.tell_us_more || '',
            notes: selectedTrack.notes || ''
          }}
          isOpen={showInfoModal}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedTrack(null);
          }}
        />
      )}

      {/* Info Modal for Mixer Context */}
      {showInfoModal && selectedTrack && context === 'mixer' && (
        <TrackDetailsModal
          track={{
            ...selectedTrack,
            cover_image_url: selectedTrack.imageUrl,
            audio_url: selectedTrack.audioUrl,
            // Add any other missing fields that TrackDetailsModal expects
            tags: selectedTrack.tags || [],
            description: selectedTrack.description || '',
            tell_us_more: selectedTrack.tell_us_more || '',
            notes: selectedTrack.notes || ''
          }}
          isOpen={showInfoModal}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedTrack(null);
          }}
        />
      )}
    </div>
  );
}
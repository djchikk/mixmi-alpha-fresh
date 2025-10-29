/**
 * @deprecated This 280px card component is being phased out in favor of TrackDetailsModal
 * 
 * DEPRECATION NOTICE:
 * - Use TrackDetailsModal for comprehensive track information display
 * - Use CompactTrackCardWithFlip for 160px cards with flip functionality
 * - This component is kept for reference but should not be used in new code
 * 
 * To be removed in next major refactor after all references are updated
 */

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IPTrack } from '@/types';
import { useMixer } from '@/contexts/MixerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import OptimizedImage from '../shared/OptimizedImage';
import InfoIcon from '../shared/InfoIcon';

interface TrackCardProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void; // New callback to stop preview
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void; // New callback for deletion
}

export default function TrackCard({ 
  track, 
  isPlaying, 
  onPlayPreview, 
  onStopPreview,
  showEditControls,
  onPurchase,
  onEditTrack,
  onDeleteTrack
}: TrackCardProps) {
  const router = useRouter();
  const { loadTrackToDeck, addTrackToCollection } = useMixer();
  const { walletAddress } = useAuth();
  const { showToast } = useToast();
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Generate a consistent subtle color for profile initials based on name
  const getProfileColor = (name: string) => {
    // Create a simple hash from the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to a subtle color (muted/dark tones)
    const colors = [
      'rgba(100, 100, 120, 0.6)',   // Muted blue-grey
      'rgba(120, 100, 100, 0.6)',   // Muted brown
      'rgba(100, 120, 100, 0.6)',   // Muted green
      'rgba(120, 120, 100, 0.6)',   // Muted yellow
      'rgba(110, 100, 120, 0.6)',   // Muted purple
      'rgba(120, 110, 100, 0.6)',   // Muted orange
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Debug: Track state changes
  useEffect(() => {
    console.log('🎭 Card flip state changed to:', isFlipped, 'for track:', track.title);
  }, [isFlipped, track.title]);

  // Determine border color based on content type
  const getBorderColor = () => {
    switch (track.content_type) {
      case 'loop':
        return 'border-[#9772F4]'; // Vibrant purple for loops
      case 'full_song':
        return 'border-[#FFE4B5]'; // Peach-gold for full songs
      default:
        return 'border-blue-400'; // Fallback for collaborations
    }
  };


  // Handle card flip
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🎭 Info icon clicked! Current flipped state:', isFlipped, 'Track:', track.title);
    const newState = !isFlipped;
    setIsFlipped(newState);
    console.log('🎭 Setting flipped state to:', newState);
    // Force a slight delay to ensure state update
    setTimeout(() => {
      console.log('🎭 Flip state after timeout:', newState);
    }, 100);
  };

  // Handle collection button click
  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check for modifier keys - if Ctrl/Cmd held, go directly to mixer (power user feature)
    const directToMixer = e.ctrlKey || e.metaKey;
    
    console.log(`🛒 Adding track to collection:`, track.title, directToMixer ? '(direct to mixer)' : '(added to collection)');
    
    // Visual feedback - green for cart add, purple for direct mixer
    const button = e.currentTarget as HTMLButtonElement;
    button.style.transform = 'scale(0.95)';
    button.style.backgroundColor = directToMixer ? '#9772F4' : '#10b981'; // Purple for direct, green for cart
    setTimeout(() => {
      button.style.transform = 'scale(1)';
      button.style.backgroundColor = '#101726';
    }, 150);
    
    // Add track to collection
    addTrackToCollection(track);
    showToast('Added to collection', 'success');
    
    // Only navigate to mixer if modifier key held (power user shortcut)
    if (directToMixer) {
      setTimeout(() => {
        router.push('/mixer');
      }, 200);
    }
    // Otherwise, let the persistent cart handle the experience!
  };

  // Handle play button click
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayPreview(track.id, track.audio_url);
  };

  // Handle purchase click
  const handlePurchaseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPurchase?.(track);
  };

  // Handle track deletion
  const handleDeleteTrack = async () => {
    setIsDeleting(true);
    
    try {
      console.log('🗑️ Starting deletion process for track:', {
        trackId: track.id,
        trackTitle: track.title,
        createdBy: track.created_by,
        primaryUploader: track.primary_uploader_wallet
      });
      
      // 🔧 CRITICAL: Authenticate with Supabase first
      const authResponse = await fetch('/api/auth/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletAddress })
      });
      
      if (!authResponse.ok) {
        throw new Error('Failed to authenticate for deletion');
      }
      
      const authData = await authResponse.json();
      console.log('🔐 Authentication successful for deletion:', {
        success: authData.success,
        message: authData.message,
        hasToken: !!authData.token
      });
      
      // 🔧 CRITICAL: Set the JWT token in Supabase client
      if (authData.token) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: authData.token,
          refresh_token: authData.token // Use same token for both
        });
        
        if (setSessionError) {
          console.error('🚨 Failed to set Supabase session:', setSessionError);
          throw new Error('Failed to set authentication session');
        }
        
        console.log('✅ Supabase session set successfully');
      } else {
        throw new Error('No JWT token received from authentication');
      }
      
      // Debug: Check current user context after setting session
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔐 Current user context after setting session:', {
        user: user,
        userEmail: user?.email,
        userMetadata: user?.user_metadata,
        isAuthenticated: !!user
      });
      
      // Delete audio file from storage if it exists
      if (track.audio_url) {
        const audioPath = track.audio_url.split('/').pop();
        if (audioPath) {
          console.log('🗑️ Deleting audio file:', audioPath);
          const { error: audioDeleteError } = await supabase.storage
            .from('audio')
            .remove([audioPath]);
          
          if (audioDeleteError) {
            console.warn('⚠️ Audio file deletion warning:', audioDeleteError);
          }
        }
      }
      
      // Delete cover image from storage if it exists
      if (track.cover_image_url) {
        const imagePath = track.cover_image_url.split('/').pop();
        if (imagePath) {
          console.log('🗑️ Deleting cover image:', imagePath);
          const { error: imageDeleteError } = await supabase.storage
            .from('images')
            .remove([imagePath]);
          
          if (imageDeleteError) {
            console.warn('⚠️ Cover image deletion warning:', imageDeleteError);
          }
        }
      }
      
      // Delete track record from database
      console.log('🗑️ Attempting to delete track record from database...');
      console.log('🔍 Delete parameters:', {
        table: 'ip_tracks',
        trackId: track.id,
        whereClause: `id = ${track.id}`
      });
      
      const { data: deleteData, error: dbDeleteError, count } = await supabase
        .from('ip_tracks')
        .delete()
        .eq('id', track.id)
        .select(); // Add select to see what was actually deleted
      
      console.log('🔍 Database delete response:', {
        data: deleteData,
        error: dbDeleteError,
        count: count,
        deletedRecords: deleteData?.length || 0
      });
      
      if (dbDeleteError) {
        console.error('❌ Database delete error details:', {
          message: dbDeleteError.message,
          details: dbDeleteError.details,
          hint: dbDeleteError.hint,
          code: dbDeleteError.code
        });
        throw new Error(`Failed to delete track: ${dbDeleteError.message}`);
      }
      
      if (!deleteData || deleteData.length === 0) {
        console.warn('⚠️ No records were deleted - this suggests RLS policy blocking deletion');
        throw new Error('No records were deleted. This might be a permissions issue.');
      }
      
      console.log('✅ Track deleted successfully from database');
      showToast('Track deleted successfully', 'success');
      
      // Notify parent component
      onDeleteTrack?.(track.id);
      
    } catch (error) {
      console.error('❌ Error deleting track:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to delete track', 
        'error'
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  return (
    <div className="relative group">
      {/* Main Card Container - 280x280px with 3D flip */}
      <div 
        className={`w-[280px] h-[280px] rounded-lg overflow-hidden transition-all duration-500 cursor-pointer ${getBorderColor()} border-2 bg-slate-800`}
        style={{ perspective: '1000px' }}
      >
        {/* Flip Container */}
        <div 
          className="relative w-full h-full transition-transform duration-700 ease-in-out"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          
          {/* FRONT OF CARD - Art First Design */}
          <div 
            className="absolute inset-0 w-full h-full"
            style={{ 
              backfaceVisibility: 'hidden',
              zIndex: isFlipped ? -1 : 2
            }}
          >
            {/* Cover Image - Full Card */}
            <div className="relative w-full h-full overflow-hidden">
              {track.cover_image_url ? (
                <OptimizedImage 
                  src={track.cover_image_url} 
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
              
              {/* Hover Overlay - All Info & Controls */}
              <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex flex-col justify-between p-4">
                
                {/* Top Section: Title, Artist, Info & Delete */}
                <div>
                  <div className="flex justify-between items-start mb-2">
                    {/* Left side: Title and Artist */}
                    <div className="flex-1 min-w-0 mr-2">
                      <h3 className="font-bold text-white text-base mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{track.title}</h3>
                      <p className="text-gray-300 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{track.artist}</p>
                    </div>
                    
                    {/* Right side: Delete and Info icons */}
                    <div className="flex gap-2 flex-shrink-0">
                      {/* Delete Button (Only show for edit controls) */}
                      {showEditControls && (
                        <button
                          onClick={handleDeleteClick}
                          title="Delete track"
                          className="text-white hover:text-red-400 transition-colors text-xl opacity-90 hover:opacity-100"
                          style={{ pointerEvents: 'all' }}
                        >
                          🗑️
                        </button>
                      )}
                      
                      {/* Info Icon */}
                      <InfoIcon
                        size="md"
                        onClick={handleInfoClick}
                        className="relative z-10"
                        title="Click to flip card and see details"
                      />
                    </div>
                  </div>
                </div>

                {/* Center: Play Button */}
                <div className="flex items-center justify-center">
                  {track.audio_url && (
                    <button
                      onClick={handlePlayClick}
                      onMouseLeave={() => {
                        // Stop preview when mouse leaves the play button
                        if (isPlaying && onStopPreview) {
                          onStopPreview();
                        }
                      }}
                      className="w-16 h-16 bg-[#101726] hover:bg-[#1a1f3a] rounded-full flex items-center justify-center transition-colors border border-gray-600 hover:border-[#81E4F2]"
                    >
                      {isPlaying ? (
                        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                      ) : (
                        <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Bottom Section: BPM, Collection, Price (horizontal) */}
                <div className="flex items-center justify-between">
                  {/* BPM Badge (left) */}
                  {track.bpm && (
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-gray-300">
                      {track.bpm} BPM
                    </span>
                  )}
                  {!track.bpm && <div className="w-16"></div>} {/* Spacer if no BPM */}
                  
                  {/* Collection Button (center) - Now for both loops and songs */}
                  <button
                    onClick={handleCollectionClick}
                    title="Add to Collection"
                    className="w-10 h-10 bg-[#101726] hover:bg-[#1a1f3a] rounded-full flex items-center justify-center text-white transition-all border border-gray-600 hover:border-[#81E4F2] group"
                  >
                    <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                  </button>
                  
                  {/* Buy Button (right) */}
                  <button
                    onClick={handlePurchaseClick}
                    className="bg-accent hover:bg-accent/90 text-slate-900 font-bold py-1.5 px-3 rounded transition-all transform hover:scale-105 text-sm"
                  >
                    {track.price_stx} STX
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BACK OF CARD - Attribution Details (MC Claude's Design) */}
          <div 
            className="absolute inset-0 w-full h-full px-4 overflow-hidden"
            style={{ 
              background: '#0F172A',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              zIndex: isFlipped ? 2 : -1
            }}
          >
            <div className="h-full overflow-y-auto pt-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Header with close button */}
              <div className="flex justify-between items-start" style={{ marginBottom: '8px' }}>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white truncate" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                    {track.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#999' }}>{track.artist}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🎭 Close button clicked! Flipping back to front');
                    setIsFlipped(false);
                  }}
                  className="ml-2 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer"
                  style={{ 
                    zIndex: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#bbb'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                  title="Close details"
                >
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>✕</span>
                </button>
              </div>

              {/* Tags Section */}
              {track.tags && Array.isArray(track.tags) && track.tags.length > 0 && (
                <div 
                  className="rounded-md"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '6px',
                    padding: '10px'
                  }}
                >
                  <h4 className="text-white uppercase font-bold" style={{ fontSize: '10px', letterSpacing: '0.3px', marginBottom: '6px' }}>TAGS</h4>
                  <div className="flex flex-wrap gap-2">
                    {track.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="transition-all cursor-default"
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: '500',
                          color: '#999'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.color = '#999';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description Section */}
              <div 
                className="rounded-md"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '10px'
                }}
              >
                <h4 className="text-white uppercase font-bold" style={{ fontSize: '10px', letterSpacing: '0.3px', marginBottom: '6px' }}>DESCRIPTION</h4>
                <div className="text-xs" style={{ lineHeight: '1.5', color: '#999' }}>
                  {track.description || `A ${track.content_type === 'full_song' ? 'beautiful song' : 'dynamic loop'} showcasing the power of the mixmi platform. This track represents the future of creative collaboration and remix culture.`}
                </div>
              </div>

              {/* Licensing Section */}
              <div 
                className="rounded-md"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '10px'
                }}
              >
                <h4 className="text-white uppercase font-bold" style={{ fontSize: '10px', letterSpacing: '0.3px', marginBottom: '6px' }}>LICENSING</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#999' }}>Remixing:</span>
                    <span style={{ color: track.allow_remixing ? '#4ade80' : '#FF595A', fontSize: track.allow_remixing ? '16px' : '14px' }}>
                      {track.allow_remixing ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#999' }}>Collaboration:</span>
                    <span style={{ color: track.open_to_collaboration ? '#4ade80' : '#FF595A', fontSize: track.open_to_collaboration ? '16px' : '14px' }}>
                      {track.open_to_collaboration ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#999' }}>Commercial Use:</span>
                    <span style={{ color: track.license_type === 'custom' ? '#4ade80' : '#FF595A', fontSize: track.license_type === 'custom' ? '16px' : '14px' }}>
                      {track.license_type === 'custom' ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              {track.tell_us_more && (
                <div 
                  className="rounded-md"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '6px',
                    padding: '10px'
                  }}
                >
                  <h4 className="text-white uppercase font-bold" style={{ fontSize: '10px', letterSpacing: '0.3px', marginBottom: '6px' }}>NOTES</h4>
                  <div className="max-h-20 overflow-y-auto">
                    <p className="text-xs" style={{ lineHeight: '1.5', color: '#999' }}>
                      {track.tell_us_more}
                    </p>
                  </div>
                </div>
              )}

              {/* Rights Sections */}
              <div 
                className="rounded-md space-y-4"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '10px'
                }}
              >
                {/* Composition Rights */}
                <div>
                  <h4 className="text-white text-xs font-semibold mb-3 tracking-wide">♪ Composition Rights</h4>
                  <div className="space-y-2">
                    {/* Visual split bar */}
                    <div className="h-1 flex gap-0.5">
                      {track.composition_split_1_percentage > 0 && (
                        <div 
                          className="h-full rounded-sm"
                          style={{ 
                            width: `${track.composition_split_1_percentage}%`,
                            backgroundColor: '#81E4F2'
                          }}
                        />
                      )}
                      {track.composition_split_2_percentage > 0 && (
                        <div 
                          className="h-full rounded-sm"
                          style={{ 
                            width: `${track.composition_split_2_percentage}%`,
                            backgroundColor: 'rgba(129, 228, 242, 0.7)'
                          }}
                        />
                      )}
                      {track.composition_split_3_percentage > 0 && (
                        <div 
                          className="h-full rounded-sm"
                          style={{ 
                            width: `${track.composition_split_3_percentage}%`,
                            backgroundColor: 'rgba(129, 228, 242, 0.4)'
                          }}
                        />
                      )}
                    </div>
                    {/* Contributors */}
                    <div className="space-y-1">
                      {track.composition_split_1_percentage > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div 
                              className="rounded flex items-center justify-center text-xs font-mono flex-shrink-0"
                              style={{ 
                                backgroundColor: getProfileColor(track.composition_split_1_wallet || 'Creator'),
                                width: '28px',
                                height: '28px'
                              }}
                            >
                              {(track.composition_split_1_wallet || 'CR')[0].toUpperCase()}
                            </div>
                            <span className="truncate font-mono" style={{ color: '#ccc' }}>
                              {track.composition_split_1_wallet || 'Creator'}
                            </span>
                          </div>
                          <span className="text-white font-mono text-base font-bold">
                            {track.composition_split_1_percentage}%
                          </span>
                        </div>
                      )}
                      {track.composition_split_2_percentage > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div 
                              className="rounded flex items-center justify-center text-xs font-mono flex-shrink-0"
                              style={{ 
                                backgroundColor: getProfileColor(track.composition_split_2_wallet || 'Collaborator'),
                                width: '28px',
                                height: '28px'
                              }}
                            >
                              {(track.composition_split_2_wallet || 'CO')[0].toUpperCase()}
                            </div>
                            <span className="truncate font-mono" style={{ color: '#ccc' }}>
                              {track.composition_split_2_wallet || 'Collaborator'}
                            </span>
                          </div>
                          <span className="text-white font-mono text-base font-bold">
                            {track.composition_split_2_percentage}%
                          </span>
                        </div>
                      )}
                      {track.composition_split_3_percentage > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div 
                              className="rounded flex items-center justify-center text-xs font-mono flex-shrink-0"
                              style={{ 
                                backgroundColor: getProfileColor(track.composition_split_3_wallet || 'Collaborator'),
                                width: '28px',
                                height: '28px'
                              }}
                            >
                              {(track.composition_split_3_wallet || 'CO')[0].toUpperCase()}
                            </div>
                            <span className="truncate font-mono" style={{ color: '#ccc' }}>
                              {track.composition_split_3_wallet || 'Collaborator'}
                            </span>
                          </div>
                          <span className="text-white font-mono text-base font-bold">
                            {track.composition_split_3_percentage}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recording Rights */}
                <div>
                  <h4 className="text-white text-xs font-semibold mb-3 tracking-wide">● Recording Rights</h4>
                  <div className="space-y-2">
                    {/* Visual split bar */}
                    <div className="h-1 flex gap-0.5">
                      {track.production_split_1_percentage > 0 && (
                        <div 
                          className="h-full rounded-sm"
                          style={{ 
                            width: `${track.production_split_1_percentage}%`,
                            backgroundColor: '#FF595A'
                          }}
                        />
                      )}
                      {track.production_split_2_percentage > 0 && (
                        <div 
                          className="h-full rounded-sm"
                          style={{ 
                            width: `${track.production_split_2_percentage}%`,
                            backgroundColor: 'rgba(255, 89, 90, 0.7)'
                          }}
                        />
                      )}
                      {track.production_split_3_percentage > 0 && (
                        <div 
                          className="h-full rounded-sm"
                          style={{ 
                            width: `${track.production_split_3_percentage}%`,
                            backgroundColor: 'rgba(255, 89, 90, 0.4)'
                          }}
                        />
                      )}
                    </div>
                    {/* Contributors */}
                    <div className="space-y-1">
                      {track.production_split_1_percentage > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div 
                              className="rounded flex items-center justify-center text-xs font-mono flex-shrink-0"
                              style={{ 
                                backgroundColor: getProfileColor(track.production_split_1_wallet || 'Producer'),
                                width: '28px',
                                height: '28px'
                              }}
                            >
                              {(track.production_split_1_wallet || 'PR')[0].toUpperCase()}
                            </div>
                            <span className="truncate font-mono" style={{ color: '#ccc' }}>
                              {track.production_split_1_wallet || 'Producer'}
                            </span>
                          </div>
                          <span className="text-white font-mono text-base font-bold">
                            {track.production_split_1_percentage}%
                          </span>
                        </div>
                      )}
                      {track.production_split_2_percentage > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div 
                              className="rounded flex items-center justify-center text-xs font-mono flex-shrink-0"
                              style={{ 
                                backgroundColor: getProfileColor(track.production_split_2_wallet || 'Collaborator'),
                                width: '28px',
                                height: '28px'
                              }}
                            >
                              {(track.production_split_2_wallet || 'CO')[0].toUpperCase()}
                            </div>
                            <span className="truncate font-mono" style={{ color: '#ccc' }}>
                              {track.production_split_2_wallet || 'Collaborator'}
                            </span>
                          </div>
                          <span className="text-white font-mono text-base font-bold">
                            {track.production_split_2_percentage}%
                          </span>
                        </div>
                      )}
                      {track.production_split_3_percentage > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div 
                              className="rounded flex items-center justify-center text-xs font-mono flex-shrink-0"
                              style={{ 
                                backgroundColor: getProfileColor(track.production_split_3_wallet || 'Collaborator'),
                                width: '28px',
                                height: '28px'
                              }}
                            >
                              {(track.production_split_3_wallet || 'CO')[0].toUpperCase()}
                            </div>
                            <span className="truncate font-mono" style={{ color: '#ccc' }}>
                              {track.production_split_3_wallet || 'Collaborator'}
                            </span>
                          </div>
                          <span className="text-white font-mono text-base font-bold">
                            {track.production_split_3_percentage}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Source URLs Section */}
              <div 
                className="rounded-md"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '10px'
                }}
              >
                <h4 className="text-white uppercase font-bold" style={{ fontSize: '10px', letterSpacing: '0.3px', marginBottom: '6px' }}>SOURCE</h4>
                {track.social_urls && Object.keys(track.social_urls).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(track.social_urls).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 transition-all cursor-pointer"
                        style={{ 
                          padding: '4px 10px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '16px',
                          fontSize: '11px',
                          color: '#999',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.color = '#999';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2 text-gray-500 text-xs">
                    No source links available
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md mx-4 border border-slate-600">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🗑️</span>
              <h3 className="text-lg font-bold text-white">Delete Track</h3>
            </div>
            
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete <strong>"{track.title}"</strong>?
            </p>
            
            <p className="text-sm text-gray-400 mb-6">
              This will permanently remove the track, audio file, and cover image. This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrack}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Track'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
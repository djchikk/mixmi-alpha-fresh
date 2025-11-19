/**
 * useMixerPackHandler.ts
 *
 * Custom hook for handling pack drops and unpacking in the Universal Mixer.
 * Manages fetching pack contents, adding to collection, auto-expanding UI, and loading to decks.
 *
 * @author Sandy Hoover & Claude Code
 * @created 2025-11-19
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useMixer } from '@/contexts/MixerContext';
import { Track } from '../types';

/**
 * Hook for handling pack drops onto mixer decks
 *
 * @returns Handler function for pack drops
 */
export function useMixerPackHandler() {
  const { showToast } = useToast();
  const { addTrackToCollection } = useMixer();

  const handlePackDrop = useCallback(async (
    packTrack: any,
    deck: 'A' | 'B',
    loadTrackToDeckA: (track: Track) => Promise<void>,
    loadTrackToDeckB: (track: Track) => Promise<void>
  ) => {
    console.log(`📦 Adding pack to crate with auto-expand:`, packTrack);

    try {
      // Determine what type of content to fetch
      const contentTypeToFetch = packTrack.content_type === 'loop_pack' ? 'loop'
        : packTrack.content_type === 'station_pack' ? 'radio_station'
        : 'full_song';

      const packId = packTrack.pack_id || packTrack.id.split('-loc-')[0];

      // Fetch child tracks to load first one to deck
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', contentTypeToFetch)
        .order('pack_position', { ascending: true });

      if (error) {
        console.error('❌ Error fetching pack contents:', error);
        showToast('Failed to load pack contents', 'error');
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No tracks found in pack');
        showToast('No tracks found in pack', 'warning');
        return;
      }

      console.log(`✅ Found ${data.length} tracks in pack`);

      // Add the pack container to the crate (not individual tracks)
      console.log(`📦 Adding pack container to crate:`, packTrack.title);
      addTrackToCollection(packTrack);

      // Auto-expand the pack in the crate - wait for next render cycle
      if ((window as any).expandPackInCrate) {
        console.log(`🎯 Triggering auto-expand for pack:`, packTrack.id);

        // Use requestAnimationFrame for reliable timing after render
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Double RAF ensures DOM is fully updated
            try {
              if ((window as any).expandPackInCrate) {
                (window as any).expandPackInCrate(packTrack);
              } else {
                console.warn('⚠️ expandPackInCrate not available');
              }
            } catch (error) {
              console.error('❌ Failed to auto-expand pack:', error);
            }
          });
        });
      }

      // Load the first track to the deck
      const firstTrack = data[0];
      const loadFunction = deck === 'A' ? loadTrackToDeckA : loadTrackToDeckB;

      // Convert IPTrack to Track format
      const mixerTrack: Track = {
        id: firstTrack.id,
        title: firstTrack.title,
        artist: firstTrack.artist || 'Unknown Artist',
        imageUrl: firstTrack.cover_image_url || '',
        audioUrl: contentTypeToFetch === 'radio_station'
          ? ((firstTrack as any).stream_url || firstTrack.audio_url)
          : firstTrack.audio_url,
        bpm: firstTrack.bpm || 120,
        content_type: firstTrack.content_type,
        pack_position: firstTrack.pack_position
      };

      await loadFunction(mixerTrack);

      // Show success toast
      const emoji = packTrack.content_type === 'station_pack' ? '📻'
        : packTrack.content_type === 'ep' ? '🎵'
        : '🔁';
      const itemName = packTrack.content_type === 'station_pack' ? 'stations'
        : packTrack.content_type === 'ep' ? 'tracks'
        : 'loops';

      showToast(`${emoji} ${data.length} ${itemName} unpacked to crate!`, 'success');

    } catch (error) {
      console.error('❌ Error unpacking pack:', error);
      showToast('Failed to unpack content', 'error');
    }
  }, [showToast, addTrackToCollection]);

  return { handlePackDrop };
}

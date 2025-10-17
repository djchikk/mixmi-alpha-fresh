import { useState } from 'react';
import { IPTrack } from '@/types';
import { SupabaseAuthBridge } from '@/lib/auth/supabase-auth-bridge';
import AlphaAuth from '@/lib/auth/alpha-auth';
import { CertificateService } from '@/lib/certificate-service';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';

interface SubmitFormData {
  id: string;
  title: string;
  ep_title?: string; // For EP uploads
  version: string;
  artist: string;
  description: string;
  tell_us_more: string;
  tags: string[];
  notes?: string;
  content_type: string;
  loop_category: string;
  sample_type: string;
  bpm: number;
  key: string;
  isrc: string;
  location_lat?: number;
  location_lng?: number;
  primary_location?: string;
  locations?: Array<{ lat: number; lng: number; name: string }>;
  composition_split_1_wallet: string;
  composition_split_1_percentage: number;
  composition_split_2_wallet: string;
  composition_split_2_percentage: number;
  composition_split_3_wallet: string;
  composition_split_3_percentage: number;
  production_split_1_wallet: string;
  production_split_1_percentage: number;
  production_split_2_wallet: string;
  production_split_2_percentage: number;
  production_split_3_wallet: string;
  production_split_3_percentage: number;
  cover_image_url: string;
  audio_url: string;
  license_type: string;
  license_selection: 'platform_remix' | 'platform_download';
  allow_remixing: boolean;
  allow_downloads: boolean;
  open_to_commercial: boolean;
  open_to_collaboration: boolean;
  price_stx: number;
  remix_price: number;
  combined_price: number;
  download_price?: number;
  commercial_contact: string;
  commercial_contact_fee: number;
  collab_contact: string;
  collab_contact_fee: number;
  // TEMPORARY: For database cleanup re-registration only
  uploader_wallet_override?: string;
  // Loop pack support
  loop_files?: File[];
  // EP support
  ep_files?: File[];
}

interface UseIPTrackSubmitProps {
  walletAddress?: string; // Content attribution wallet
  alphaWallet?: string;   // Alpha verification wallet (uploader)
  track?: IPTrack;
  onSave?: (track: IPTrack) => void;
  onSuccess?: () => void;
}

interface UseIPTrackSubmitReturn {
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'complete';
  submitTrack: (formData: SubmitFormData, validationErrors: string[]) => Promise<void>;
}

// Helper function to process loop pack uploads
async function processLoopPack(formData: SubmitFormData, authSession: any, walletAddress: string, baseTrackData: any) {
  console.log('📦 Starting loop pack processing...');
  
  // We need to use the actual audio upload utilities
  // Note: processAudioFile is a hook method, not a standalone function
  // For now, let's create the audio upload manually
  
  // Step 1: Create loop pack record
  const packData = {
    id: formData.id || crypto.randomUUID(),
    name: formData.title,
    description: formData.description,
    artist: formData.artist,
    cover_image_url: formData.cover_image_url,
    created_at: new Date().toISOString(),
    uploader_wallet: walletAddress,
    total_loops: formData.loop_files!.length
  };
  
  console.log('📦 Creating loop pack record:', packData);
  const { data: packResult, error: packError } = await authSession.supabase
    .from('loop_packs')
    .insert([packData])
    .select('id');
    
  if (packError) {
    console.error('❌ Pack creation error:', packError);
    throw new Error(`Failed to create loop pack: ${packError.message}`);
  }
  
  const packId = packResult[0].id;
  console.log('✅ Loop pack created with ID:', packId);
  
  // Step 2: Process each loop file
  console.log('🎵 Processing individual loop files...');
  const loopResults = [];
  let firstLoopAudioUrl = null; // Store first loop's audio URL for master record
  
  for (let i = 0; i < formData.loop_files!.length; i++) {
    const file = formData.loop_files![i];
    console.log(`🎵 Processing loop ${i + 1}/${formData.loop_files!.length}: ${file.name}`);
    
    try {
      // Upload audio file to Supabase storage manually
      const fileExt = file.name.split('.').pop();
      const fileName = `${walletAddress}-${Date.now()}-${i + 1}.${fileExt}`;
      const filePath = `audio/${fileName}`;
      
      console.log(`📤 Uploading ${file.name} to storage as ${filePath}`);
      
      const { data: uploadData, error: uploadError } = await authSession.supabase.storage
        .from('user-content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        console.error(`❌ Upload error for loop ${i + 1}:`, uploadError);
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data: urlData } = authSession.supabase.storage
        .from('user-content')
        .getPublicUrl(filePath);
      
      const audioUrl = urlData.publicUrl;
      console.log(`✅ Loop ${i + 1} uploaded to:`, audioUrl);
      
      // Store first loop's audio URL for master record
      if (i === 0) {
        firstLoopAudioUrl = audioUrl;
      }
      
      // For now, we'll skip BPM detection and duration detection
      // These can be added later if needed
      const audioResult = {
        audioUrl: audioUrl,
        duration: null, // Could be detected client-side if needed
        bpm: null // Could be detected if needed
      };
      
      // Create individual loop record
      // Use audio filename (without extension) as loop title for better UX
      const loopTitle = file.name.replace(/\.[^/.]+$/, "") || `Loop ${i + 1}`;
      const loopData = {
        ...baseTrackData,
        id: crypto.randomUUID(),
        title: loopTitle,
        content_type: 'loop', // Individual loops must be 'loop' type
        loop_category: 'pack',
        pack_id: packId,
        pack_position: i + 1,
        audio_url: audioResult.audioUrl,
        duration: audioResult.duration || null,
        bpm: audioResult.bpm || baseTrackData.bpm,
        cover_image_url: formData.cover_image_url, // Inherit pack cover image
        // Explicitly inherit licensing and pricing from pack
        allow_downloads: baseTrackData.allow_downloads,
        remix_price_stx: 1.0, // Individual loops always 1 STX per remix
        download_price_stx: baseTrackData.allow_downloads === true
          ? ((formData as any).price_per_loop || 0.5) // Individual loop download price
          : null, // Remix-only packs have no download price
      };
      
      console.log(`📊 Loop ${i + 1} data:`, loopData);
      console.log(`✅ Loop ${i + 1} licensing: allow_downloads=${loopData.allow_downloads}, download_price_stx=${loopData.download_price_stx}`);
      
      const { data: loopResult, error: loopError } = await authSession.supabase
        .from('ip_tracks')
        .insert([loopData])
        .select('id, title');
        
      if (loopError) {
        console.error(`❌ Loop ${i + 1} creation error:`, loopError);
        throw new Error(`Failed to create loop ${i + 1}: ${loopError.message}`);
      }
      
      loopResults.push(loopResult[0]);
      console.log(`✅ Loop ${i + 1} created:`, loopResult[0]);
      
    } catch (error) {
      console.error(`❌ Error processing loop ${i + 1}:`, error);
      throw new Error(`Failed to process loop ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log('✅ All loops processed successfully:', loopResults);
  
  // Step 3: Create master pack record for globe/store display
  console.log('🎯 Creating master pack record for globe display...');
  
  const masterPackRecord = {
    ...baseTrackData,
    id: packId, // Use the same pack ID so individual loops can be found!
    title: (formData as any).pack_title || formData.title, // Use pack_title for loop packs
    content_type: 'loop_pack', // This will show on globe
    loop_category: null, // Pack records don't need category
    pack_id: null, // Master pack record doesn't belong to a pack - IT IS the pack
    pack_position: null, // Master record has no position
    audio_url: firstLoopAudioUrl, // Use first loop's audio
    duration: null, // Pack duration could be sum of all loops, but null for now
    bpm: baseTrackData.bpm, // Use pack-level BPM from form
    // Explicitly inherit licensing from pack
    allow_downloads: baseTrackData.allow_downloads,
    // Use form pricing for loop packs with new pricing model
    remix_price_stx: 1.0, // Platform standard: 1 STX per loop remix
    download_price_stx: baseTrackData.allow_downloads === true
      ? ((formData as any).price_per_loop || 0.5) * formData.loop_files!.length // Total pack download price
      : null, // Remix-only packs have no download price
    price_stx: baseTrackData.allow_downloads === true
      ? ((formData as any).price_per_loop || 0.5) * formData.loop_files!.length // Legacy: total pack download price
      : null, // Legacy: remix-only packs should show MIX badge (no price_stx)
    description: formData.description + ` (Loop Pack containing ${formData.loop_files!.length} loops)`,
  };
  
  console.log('📊 Master pack record data:', masterPackRecord);
  console.log(`✅ Master pack licensing: allow_downloads=${masterPackRecord.allow_downloads}, download_price_stx=${masterPackRecord.download_price_stx}`);
  console.log('🚀 ABOUT TO INSERT MASTER PACK RECORD...');
  
  const { data: masterResult, error: masterError } = await authSession.supabase
    .from('ip_tracks')
    .insert([masterPackRecord])
    .select('id, title, content_type');
    
  if (masterError) {
    console.error('❌ Master pack record creation error:', masterError);
    // Don't throw error - individual loops were created successfully
    console.warn('⚠️ Pack created but master record failed. Individual loops accessible via pack_id.');
  } else {
    console.log('✅ Master pack record created:', masterResult[0]);
  }
  
  return { 
    packId, 
    loops: loopResults,
    masterRecord: masterResult?.[0] || null
  };
}

// Helper function to process EP uploads
async function processEP(formData: SubmitFormData, authSession: any, walletAddress: string, baseTrackData: any) {
  console.log('🎤 Starting EP processing...');
  
  // Step 1: Generate EP ID (no separate EP table needed - follow loop pack pattern)
  const epId = formData.id || crypto.randomUUID();
  console.log('🎤 Using EP ID:', epId);
  
  // Step 2: Process each song file
  console.log('🎵 Processing individual song files...');
  const songResults = [];
  let firstSongAudioUrl = null; // Store first song's audio URL for master record
  
  for (let i = 0; i < formData.ep_files!.length; i++) {
    const file = formData.ep_files![i];
    console.log(`🎵 Processing song ${i + 1}/${formData.ep_files!.length}: ${file.name}`);
    
    try {
      // Upload audio file to Supabase storage manually
      const fileExt = file.name.split('.').pop();
      const fileName = `${walletAddress}-${Date.now()}-${i + 1}.${fileExt}`;
      const filePath = `audio/${fileName}`;
      
      console.log(`📤 Uploading ${file.name} to storage as ${filePath}`);
      
      const { data: uploadData, error: uploadError } = await authSession.supabase.storage
        .from('user-content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        console.error(`❌ Upload error for song ${i + 1}:`, uploadError);
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data: urlData } = authSession.supabase.storage
        .from('user-content')
        .getPublicUrl(filePath);
      
      const audioUrl = urlData.publicUrl;
      console.log(`✅ Song ${i + 1} uploaded to:`, audioUrl);
      
      // Store first song's audio URL for master record
      if (i === 0) {
        firstSongAudioUrl = audioUrl;
      }
      
      // Create individual song record
      const songRecord = {
        ...baseTrackData,
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, "") || `Song ${i + 1}`, // Remove file extension
        content_type: 'full_song', // Individual songs are full_song type
        pack_id: epId, // Link to parent EP
        pack_position: i + 1, // Position in EP
        audio_url: audioUrl,
        price_stx: (formData as any).price_per_song || 2.5, // Per song price
        bpm: null, // Individual songs may have different BPMs
        key: null, // Individual songs may have different keys
        description: `Song ${i + 1} from ${(formData as any).ep_title || formData.title}`,
      };
      
      console.log(`🎵 Creating song ${i + 1} record:`, songRecord);
      
      const { data: songResult, error: songError } = await authSession.supabase
        .from('ip_tracks')
        .insert([songRecord])
        .select('id, title, pack_position');
        
      if (songError) {
        console.error(`❌ Song ${i + 1} creation error:`, songError);
        throw new Error(`Failed to create song ${i + 1}: ${songError.message}`);
      }
      
      songResults.push(songResult[0]);
      console.log(`✅ Song ${i + 1} created:`, songResult[0]);
      
    } catch (error) {
      console.error(`❌ Error processing song ${i + 1}:`, error);
      throw new Error(`Failed to process song ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log('✅ All songs processed successfully:', songResults);
  
  // Step 3: Create master EP record for globe/store display
  console.log('🎯 Creating master EP record for globe display...');
  
  const masterEPRecord = {
    ...baseTrackData,
    id: epId, // Use the same EP ID so individual songs can be found!
    title: (formData as any).ep_title || formData.title, // Use ep_title for EPs
    content_type: 'ep', // This will show on globe
    pack_id: null, // Master EP record doesn't belong to a pack - IT IS the EP
    pack_position: null, // Master record has no position
    audio_url: firstSongAudioUrl, // Use first song's audio
    duration: null, // EP duration could be sum of all songs, but null for now
    bpm: null, // EPs can have songs with different BPMs, so no master BPM
    key: null, // EPs can have songs with different keys, so no master key
    // Use form pricing for EPs
    price_stx: ((formData as any).price_per_song || 2.5) * formData.ep_files!.length, // Total EP price
    description: formData.description + ` (EP containing ${formData.ep_files!.length} songs)`,
  };
  
  console.log('📊 Master EP record data:', masterEPRecord);
  console.log('🚀 ABOUT TO INSERT MASTER EP RECORD...');
  
  const { data: masterResult, error: masterError } = await authSession.supabase
    .from('ip_tracks')
    .insert([masterEPRecord])
    .select('id, title, content_type');
    
  if (masterError) {
    console.error('❌ Master EP record creation error:', masterError);
    // Don't throw error - individual songs were created successfully
    console.warn('⚠️ EP created but master record failed. Individual songs accessible via pack_id.');
  } else {
    console.log('✅ Master EP record created:', masterResult[0]);
  }
  
  return { 
    epId, 
    songs: songResults,
    masterRecord: masterResult?.[0] || null
  };
}

export function useIPTrackSubmit({ 
  walletAddress,  // Content attribution wallet
  alphaWallet,    // Alpha verification wallet
  track, 
  onSave,
  onSuccess 
}: UseIPTrackSubmitProps): UseIPTrackSubmitReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'complete'>('idle');

  const submitTrack = async (formData: SubmitFormData, validationErrors: string[]) => {
    if (validationErrors.length > 0) {
      console.log('❌ VALIDATION ERRORS:', validationErrors);
      throw new Error(validationErrors.join(', '));
    }

    console.log('✅ VALIDATION PASSED - Starting save...');
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // CRITICAL: Convert alpha codes to actual wallet addresses for blockchain operations
      const authIdentity = formData.wallet_address || walletAddress;
      const effectiveWalletAddress = await getWalletFromAuthIdentity(authIdentity);
      
      if (!effectiveWalletAddress) {
        setSaveStatus('error');
        throw new Error('Could not resolve wallet address from authentication. Please check your account.');
      }
      
      console.log(`👤 Auth identity: ${authIdentity} → Wallet: ${effectiveWalletAddress}`);
      
      // Map our form data to the current database schema
      const { isrc, ...formDataWithoutIsrc } = formData;
      
      const mappedTrackData = {
        id: formData.id,
        title: formData.title,
        version: formData.version,
        artist: formData.artist,
        description: formData.description,
        tags: formData.tags,
        content_type: formData.content_type === 'loop_pack' ? 'loop' : formData.content_type, // Save loop packs as loops for now
        loop_category: formData.content_type === 'loop' ? formData.loop_category : null,
        sample_type: formData.content_type === 'loop' ? 'instrumentals' : 'FULL SONGS',
        // BPM handling: completely optional for songs, user-provided integers only for loops/packs
        bpm: (() => {
          console.log('🎵 BPM DEBUG:', { 
            content_type: formData.content_type, 
            original_bpm: formData.bpm, 
            bpm_type: typeof formData.bpm 
          });
          
          if (formData.content_type === 'full_song' || formData.content_type === 'song') {
            // Songs: BPM is completely optional, always null
            console.log('🎵 Song detected - setting BPM to null');
            return null;
          } else {
            // Loops/packs: ONLY accept user-provided integer values, NO ROUNDING
            // If user enters decimal, validation should catch it and show error
            const bpmValue = Number(formData.bpm);
            const result = (bpmValue && Number.isInteger(bpmValue)) ? bpmValue : null;
            console.log('🎵 Loop/pack BPM result:', result);
            return result;
          }
        })(),
        key: formData.key || null,
        duration: formData.duration ? Math.round(Number(formData.duration)) : null,
        isrc_number: isrc || '',
        tell_us_more: formData.tell_us_more || '',
        notes: formData.notes || '',
        
        // Composition splits - Auto-populate for quick upload or use form data
        composition_split_1_wallet: formData.composition_split_1_wallet || effectiveWalletAddress,
        composition_split_1_percentage: formData.composition_split_1_percentage || 100,
        composition_split_2_wallet: formData.composition_split_2_wallet || null,
        composition_split_2_percentage: formData.composition_split_2_percentage || 0,
        composition_split_3_wallet: formData.composition_split_3_wallet || null,
        composition_split_3_percentage: formData.composition_split_3_percentage || 0,
        
        // Production splits - Auto-populate for quick upload or use form data
        production_split_1_wallet: formData.production_split_1_wallet || effectiveWalletAddress,
        production_split_1_percentage: formData.production_split_1_percentage || 100,
        production_split_2_wallet: formData.production_split_2_wallet || null,
        production_split_2_percentage: formData.production_split_2_percentage || 0,
        production_split_3_wallet: formData.production_split_3_wallet || null,
        production_split_3_percentage: formData.production_split_3_percentage || 0,
        
        // Licensing and permissions
        license_type: formData.license_type,
        license_selection: formData.content_type === 'full_song' ? 'platform_download' : formData.license_selection,
        allow_remixing: formData.content_type === 'full_song' ? false : formData.allow_remixing,
        allow_downloads: formData.content_type === 'full_song' ? true : formData.allow_downloads,
        open_to_commercial: formData.open_to_commercial,
        open_to_collaboration: formData.open_to_collaboration,
        // Removed agree_* fields - not in current database schema

        // NEW PRICING MODEL (separate remix and download pricing)
        // Songs/EPs: Only download price (no remix)
        // Loops: remix_price_stx (1 STX default) + optional download_price_stx
        remix_price_stx: formData.content_type === 'full_song' || formData.content_type === 'ep'
          ? 0  // Songs/EPs can't be remixed
          : 1.0, // Loops default to 1 STX per remix
        download_price_stx: formData.content_type === 'full_song' || formData.content_type === 'ep'
          ? ((formData as any).download_price || formData.price_stx || 2.5) // Songs/EPs always have download price
          : formData.allow_downloads
            ? ((formData as any).download_price_stx || (formData as any).download_price || formData.combined_price || 2.5) // Loops with downloads enabled
            : null, // Remix-only loops have no download price
        price_stx: formData.content_type === 'full_song' || formData.content_type === 'ep'
          ? ((formData as any).download_price || formData.price_stx || 2.5) // Legacy: same as download price
          : formData.allow_downloads
            ? ((formData as any).download_price_stx || (formData as any).download_price || formData.combined_price || 2.5) // Legacy: download price if available
            : 1.0, // Legacy: remix price if no downloads
        
        // Contact info
        commercial_contact: formData.commercial_contact,
        commercial_contact_fee: formData.commercial_contact_fee,
        collab_contact: formData.collab_contact,
        collab_contact_fee: formData.collab_contact_fee,
        
        // Location fields - Be careful with || operator as empty string evaluates to false
        location_lat: formData.location_lat !== undefined ? formData.location_lat : null,
        location_lng: formData.location_lng !== undefined ? formData.location_lng : null,
        primary_location: formData.primary_location !== undefined ? formData.primary_location : null,
        locations: formData.locations || null,
        
        // Media assets
        cover_image_url: formData.cover_image_url,
        audio_url: formData.audio_url,
        
        // Metadata
        created_at: track?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // Collaboration system
        primary_uploader_wallet: effectiveWalletAddress || "",
        uploader_address: effectiveWalletAddress || "",
        collaboration_preferences: {},
        store_display_policy: 'primary_only',
        collaboration_type: 'primary_artist',
        
        // Additional database fields
        is_live: true,
        account_name: effectiveWalletAddress || "",
        main_wallet_name: effectiveWalletAddress || "",
        
        // Remix depth tracking (only for loops - full songs cannot be remixed)
        remix_depth: formData.content_type === 'loop' ? 0 : null, // Loops start at generation 0, full songs get null
        source_track_ids: [], // Empty array for original content
      };

      console.log('📤 MAPPED DATA FOR SUPABASE:', mappedTrackData);
      console.log('👤 Wallet Address:', walletAddress);
      
      // Specific logging for location fields
      console.log('🗺️ LOCATION DATA IN MAPPED TRACK:', {
        primary_location: mappedTrackData.primary_location,
        location_lat: mappedTrackData.location_lat,
        location_lng: mappedTrackData.location_lng,
        locations: mappedTrackData.locations,
        formData_primary_location: formData.primary_location,
        formData_location_lat: formData.location_lat,
        formData_location_lng: formData.location_lng
      });

      // Wallet address already determined above
      
      // Create authenticated Supabase session
      // CRITICAL: Use converted wallet address for authentication (not alpha code)
      const authWallet = effectiveWalletAddress; // Already converted from alpha code above
      
      if (!authWallet) {
        throw new Error('Wallet address is required for authentication');
      }

      console.log('🔐 Authenticating alpha user via API...');
      console.log(`👤 Auth wallet: ${authWallet} (ALPHA VERIFICATION)`);
      console.log(`👤 Content wallet: ${effectiveWalletAddress} (ATTRIBUTION)`);
      
      // Use API endpoint for authentication (server-side with service role key)
      const authResponse = await fetch('/api/alpha-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: authWallet })
      });
      
      const authResult = await authResponse.json();
      
      if (!authResult.success) {
        throw new Error(`Alpha authentication failed: ${authResult.error}`);
      }

      console.log('✅ Alpha user authenticated successfully:', authResult.message);
      
      // Use the existing SupabaseAuthBridge as fallback for actual database operations
      // The API confirmed the user is approved, so this should work
      const authSession = await SupabaseAuthBridge.createWalletSession(effectiveWalletAddress);
      
      // LOOP PACK HANDLING - Process multi-file uploads
      if (formData.content_type === 'loop_pack' && formData.loop_files && formData.loop_files.length > 0) {
        console.log('📦 PROCESSING LOOP PACK:', formData.loop_files.length, 'files');
        console.log('💰 PRICING DEBUG - baseTrackData pricing:', {
          price_stx: mappedTrackData.price_stx,
          remix_price: mappedTrackData.remix_price,
          price_per_loop: (formData as any).price_per_loop
        });
        await processLoopPack(formData, authSession, effectiveWalletAddress, mappedTrackData);
        setSaveStatus('complete');
        console.log('✨ Loop pack created successfully!');
        if (onSuccess) onSuccess();
        return;
      }

      // EP HANDLING - Process multi-file uploads
      if (formData.content_type === 'ep' && formData.ep_files && formData.ep_files.length > 0) {
        console.log('🎤 PROCESSING EP:', formData.ep_files.length, 'songs');
        console.log('💰 PRICING DEBUG - baseTrackData pricing:', {
          price_stx: mappedTrackData.price_stx,
          price_per_song: (formData as any).price_per_song
        });
        await processEP(formData, authSession, effectiveWalletAddress, mappedTrackData);
        setSaveStatus('complete');
        console.log('✨ EP created successfully!');
        if (onSuccess) onSuccess();
        return;
      }

      // Save to Supabase using authenticated client
      if (track) {
        // Update existing track
        console.log('🔄 UPDATING existing track...');
        const { error } = await authSession.supabase
          .from('ip_tracks')
          .update(mappedTrackData)
          .eq('id', track.id);
        
        if (error) {
          console.error('❌ UPDATE ERROR:', error);
          throw error;
        }
        console.log('✅ UPDATE SUCCESS!');
      } else {
        // Insert new track
        console.log('➕ INSERTING new track...');
        console.log('🚨 CLAUDE FIX CHECK - BPM IN MAPPED DATA:', { bmp: mappedTrackData.bpm, content_type: mappedTrackData.content_type });
        console.log('📊 Track data being inserted:', {
          title: mappedTrackData.title,
          tags: mappedTrackData.tags,
          primary_location: mappedTrackData.primary_location,
          location_lat: mappedTrackData.location_lat,
          location_lng: mappedTrackData.location_lng
        });
        const { data, error } = await authSession.supabase
          .from('ip_tracks')
          .insert([mappedTrackData])
          .select('id, title, artist, content_type, created_at');
        
        if (error) {
          console.error('❌ INSERT ERROR:', error);
          throw error;
        }
        console.log('✅ INSERT SUCCESS!', data);
        if (data && data[0]) {
          console.log('📊 Inserted track tags:', data[0].tags);
          console.log('📊 Inserted track location:', data[0].primary_location);
        }
      }

      // Success!
      setSaveStatus('complete');
      console.log(`✨ Track ${track ? 'updated' : 'created'} successfully!`);
      
      // Generate certificate asynchronously for new tracks
      if (!track && effectiveWalletAddress) {
        console.log('🎓 Generating certificate for new track...');
        
        // Prepare certificate data
        const certificateData = {
          id: mappedTrackData.id,
          title: mappedTrackData.title,
          version: mappedTrackData.version,
          artist: mappedTrackData.artist,
          duration: mappedTrackData.duration || undefined,
          bpm: mappedTrackData.bpm || undefined,
          key: mappedTrackData.key || undefined,
          tags: mappedTrackData.tags,
          description: mappedTrackData.description,
          notes: mappedTrackData.tell_us_more || mappedTrackData.notes || undefined,
          coverImageUrl: mappedTrackData.cover_image_url, // Add track cover image
          content_type: mappedTrackData.content_type,
          remix_depth: mappedTrackData.remix_depth,
          open_to_commercial: mappedTrackData.open_to_commercial,
          commercial_contact: mappedTrackData.commercial_contact,
          commercial_contact_fee: mappedTrackData.commercial_contact_fee,
          open_to_collaboration: mappedTrackData.open_to_collaboration,
          collab_contact: mappedTrackData.collab_contact,
          collab_contact_fee: mappedTrackData.collab_contact_fee,
          composition_splits: [
            mappedTrackData.composition_split_1_wallet && {
              name: undefined, // Add if you have names
              wallet: mappedTrackData.composition_split_1_wallet,
              percentage: mappedTrackData.composition_split_1_percentage
            },
            mappedTrackData.composition_split_2_wallet && {
              name: undefined,
              wallet: mappedTrackData.composition_split_2_wallet,
              percentage: mappedTrackData.composition_split_2_percentage
            },
            mappedTrackData.composition_split_3_wallet && {
              name: undefined,
              wallet: mappedTrackData.composition_split_3_wallet,
              percentage: mappedTrackData.composition_split_3_percentage
            }
          ].filter(Boolean),
          production_splits: [
            mappedTrackData.production_split_1_wallet && {
              name: undefined,
              wallet: mappedTrackData.production_split_1_wallet,
              percentage: mappedTrackData.production_split_1_percentage
            },
            mappedTrackData.production_split_2_wallet && {
              name: undefined,
              wallet: mappedTrackData.production_split_2_wallet,
              percentage: mappedTrackData.production_split_2_percentage
            },
            mappedTrackData.production_split_3_wallet && {
              name: undefined,
              wallet: mappedTrackData.production_split_3_wallet,
              percentage: mappedTrackData.production_split_3_percentage
            }
          ].filter(Boolean),
          license_type: mappedTrackData.content_type === 'full_song' 
            ? 'Download Only'
            : mappedTrackData.license_selection === 'platform_download'
              ? 'Remix + Download'
              : 'Remix Only',
          price_stx: mappedTrackData.price_stx,
          stacksTxId: undefined, // Add when you have Stacks integration
          blockHeight: undefined, // Add when you have Stacks integration
          walletAddress: effectiveWalletAddress,
          timestamp: new Date()
        };

        // Generate certificate asynchronously (don't block the UI)
        CertificateService.generateAndStoreCertificate(certificateData)
          .then(result => {
            console.log('✅ Certificate generated successfully:', result);
          })
          .catch(error => {
            console.error('❌ Certificate generation failed:', error);
            // Don't throw - certificate generation failure shouldn't block registration
          });
      }
      
      // Call onSave callback with the track data
      if (onSave) {
        onSave(mappedTrackData as IPTrack);
      }
      
      // Let the modal handle the success state and cleanup
      setIsSaving(false);
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      console.error('💥 Save failed:', error);
      setIsSaving(false);
      setSaveStatus('idle');
      
      // Provide clearer error messages for common issues
      let errorMessage = 'Failed to save track';
      
      if (error?.code === '22P02') {
        // PostgreSQL invalid input syntax error
        if (error.message?.includes('integer') && error.message?.includes('location')) {
          errorMessage = 'Location coordinates format error. Please run the database migration to fix location columns.';
        } else {
          errorMessage = `Invalid data format: ${error.message}`;
        }
      } else if (error?.code === 'PGRST204') {
        errorMessage = `Database column missing: ${error.message}. Please run the latest database migrations.`;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  return {
    isSaving,
    saveStatus,
    submitTrack,
    setSaveStatus,
  };
}
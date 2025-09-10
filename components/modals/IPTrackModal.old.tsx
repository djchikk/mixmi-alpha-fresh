"use client";

import React, { useEffect } from "react";
import Modal from "../ui/Modal";
import ImageUploader from "../shared/ImageUploader";
import { IPTrack, SAMPLE_TYPES, CONTENT_TYPES, LOOP_CATEGORIES, ContentType, LoopCategory } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import SplitPresetManagerUI from "./SplitPresetManager";

// Import custom hooks
import { useIPTrackForm } from "@/hooks/useIPTrackForm";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import { useIPTrackSubmit } from "@/hooks/useIPTrackSubmit";
import { useSplitPresets } from "@/hooks/useSplitPresets";

interface IPTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: IPTrack; // Existing track when editing, undefined when adding new
  onSave?: (track: IPTrack) => void;
}

export default function IPTrackModal({
  isOpen,
  onClose,
  track,
  onSave,
}: IPTrackModalProps) {
  const { walletAddress } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'complete'>('idle');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [audioInputType, setAudioInputType] = useState<'url' | 'upload'>('upload');
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [isAudioUploading, setIsAudioUploading] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState<{
    stage: 'idle' | 'analyzing' | 'processing' | 'uploading' | 'finalizing' | 'complete';
    message: string;
    progress: number; // 0-100
    fileSize?: string;
  }>({
    stage: 'idle',
    message: '',
    progress: 0
  });
  
  // BPM Detection state
  const [bpmDetection, setBpmDetection] = useState<BPMDetectionResult | null>(null);
  const [isDetectingBPM, setIsDetectingBPM] = useState(false);

  // NEW: Upload mode state
  const [isQuickUpload, setIsQuickUpload] = useState(true);

  // Get the appropriate steps array based on mode
  const getSteps = () => isQuickUpload ? QUICK_STEPS : STEPS;

  // Apply smart defaults for Quick Upload mode
  const applyQuickUploadDefaults = () => {
    if (!isQuickUpload) return;
    
    // Smart pricing based on content type
    const smartPrice = formData.content_type === 'loop' ? 1.0 : 2.5;
    
    setFormData(prev => ({
      ...prev,
      // Pricing defaults
      price_stx: smartPrice,
      
      // Solo attribution (100% to uploader)
      composition_split_1_wallet: walletAddress || "",
      composition_split_1_percentage: 100,
      composition_split_2_wallet: "",
      composition_split_2_percentage: 0,
      composition_split_3_wallet: "",
      composition_split_3_percentage: 0,
      
      production_split_1_wallet: walletAddress || "",
      production_split_1_percentage: 100,
      production_split_2_wallet: "",
      production_split_2_percentage: 0,
      production_split_3_wallet: "",
      production_split_3_percentage: 0,
      
      // Standard licensing
      license_type: 'remix_external',
      allow_remixing: true,
      open_to_collaboration: false,
      
      // Clear optional fields
      isrc: "",
    }));
  };

  // Apply defaults when switching to Quick Upload mode
  const handleModeToggle = (quickMode: boolean) => {
    setIsQuickUpload(quickMode);
    setCurrentStep(0); // Reset to first step
    if (quickMode) {
      applyQuickUploadDefaults();
    }
  };

  const [formData, setFormData] = useState<IPTrackFormData>({
    id: "",
    title: "",
    version: "",
    artist: "",
    description: "",
    tell_us_more: "",
    tags: [],
    content_type: 'full_song',
    loop_category: "",
    sample_type: "instrumentals", // Legacy field - set to valid value for constraint
    bpm: 0, // Will be set based on content type
    key: "", // Optional for both types
    isrc: "",
    
    composition_split_1_wallet: walletAddress || "",
    composition_split_1_percentage: 100,
    composition_split_2_wallet: "",
    composition_split_2_percentage: 0,
    composition_split_3_wallet: "",
    composition_split_3_percentage: 0,
    
    production_split_1_wallet: walletAddress || "",
    production_split_1_percentage: 100,
    production_split_2_wallet: "",
    production_split_2_percentage: 0,
    production_split_3_wallet: "",
    production_split_3_percentage: 0,
    
    cover_image_url: "",
    audio_url: "",
    
    // New licensing and permissions fields with smart defaults
    license_type: 'remix_only',
    allow_remixing: true,
    open_to_collaboration: false,
    
    // Pricing fields with smart defaults
    price_stx: 1.0,
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (track) {
        // Editing existing track - always use advanced mode
        setIsQuickUpload(false);
        setFormData({
          id: track.id,
          title: track.title,
          version: track.version || "",
          artist: track.artist,
          description: track.description || "",
          tell_us_more: track.tell_us_more || "",
          tags: track.tags || [],
          content_type: track.content_type || 'full_song',
          loop_category: track.loop_category || "",
          sample_type: track.sample_type,
          bpm: track.bpm || 0,
          key: track.key || "",
          isrc: track.isrc || "",
          
          composition_split_1_wallet: track.composition_split_1_wallet,
          composition_split_1_percentage: track.composition_split_1_percentage,
          composition_split_2_wallet: track.composition_split_2_wallet || "",
          composition_split_2_percentage: track.composition_split_2_percentage || 0,
          composition_split_3_wallet: track.composition_split_3_wallet || "",
          composition_split_3_percentage: track.composition_split_3_percentage || 0,
          
          production_split_1_wallet: track.production_split_1_wallet,
          production_split_1_percentage: track.production_split_1_percentage,
          production_split_2_wallet: track.production_split_2_wallet || "",
          production_split_2_percentage: track.production_split_2_percentage || 0,
          production_split_3_wallet: track.production_split_3_wallet || "",
          production_split_3_percentage: track.production_split_3_percentage || 0,
          
          cover_image_url: track.cover_image_url || "",
          audio_url: track.audio_url || "",
          
          // New licensing and permissions fields
          license_type: track.license_type || 'remix_only',
          allow_remixing: track.allow_remixing ?? true,
          open_to_collaboration: track.open_to_collaboration ?? false,
          
          // Pricing fields
          price_stx: track.price_stx || 1.0,
        });
        setTagInputValue((track.tags || []).join(', '));
      } else {
        // Adding new track - start with Quick Upload
        setIsQuickUpload(true);
        setFormData({
          id: uuidv4(),
          title: "",
          version: "",
          artist: "",
          description: "",
          tell_us_more: "",
          tags: [],
          content_type: 'full_song',
          loop_category: "",
          sample_type: "",
          bpm: 0,
          key: "",
          isrc: "",
          
          composition_split_1_wallet: walletAddress || "",
          composition_split_1_percentage: 100,
          composition_split_2_wallet: "",
          composition_split_2_percentage: 0,
          composition_split_3_wallet: "",
          composition_split_3_percentage: 0,
          
          production_split_1_wallet: walletAddress || "",
          production_split_1_percentage: 100,
          production_split_2_wallet: "",
          production_split_2_percentage: 0,
          production_split_3_wallet: "",
          production_split_3_percentage: 0,
          
          cover_image_url: "",
          audio_url: "",
          
          // New licensing and permissions fields with smart defaults
          license_type: 'remix_external',
          allow_remixing: true,
          open_to_collaboration: false,
          
          // Pricing fields with smart defaults
          price_stx: 2.5, // Smart default for full song
        });
        setTagInputValue("");
      }
      setCurrentStep(0);
      setIsSaving(false);
      setSaveStatus('idle');
      setValidationErrors([]);
      setAudioInputType('upload'); // Always default to upload, consistent across all modes
      setUploadedAudioFile(null);
      setIsAudioUploading(false);
      setAudioUploadProgress({ stage: 'idle', message: '', progress: 0 });
    }
  }, [isOpen, track, walletAddress]);

  // Update pricing when content type changes in Quick Upload mode
  useEffect(() => {
    if (isQuickUpload && !track) {
      applyQuickUploadDefaults();
    }
  }, [formData.content_type, isQuickUpload, track]);

  // Prevent navigation away during audio upload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isAudioUploading && audioUploadProgress.stage !== 'idle' && audioUploadProgress.stage !== 'complete') {
        event.preventDefault();
        event.returnValue = 'Audio upload in progress. Are you sure you want to leave?';
        return 'Audio upload in progress. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAudioUploading, audioUploadProgress.stage]);

  // Validate splits
  const validateSplits = (splitType: 'composition' | 'production'): ValidationResult => {
    const prefix = splitType === 'composition' ? 'composition_split' : 'production_split';
    const total = 
      (formData[`${prefix}_1_percentage` as keyof IPTrackFormData] as number) +
      (formData[`${prefix}_2_percentage` as keyof IPTrackFormData] as number) +
      (formData[`${prefix}_3_percentage` as keyof IPTrackFormData] as number);
    
    if (Math.abs(total - 100) > 0.01) {
      return {
        isValid: false,
        errors: [`${splitType} splits must total 100%. Current total: ${total.toFixed(2)}%`]
      };
    }
    
    return { isValid: true, errors: [] };
  };

  // Auto-calculate equal splits when contributors are added/removed  
  const autoCalculateSplits = (splitType: 'composition' | 'production', contributorCount: number) => {
    const updates: Partial<IPTrackFormData> = {};
    
    if (contributorCount === 0) {
      // No contributors - set all to 0
      if (splitType === 'composition') {
        updates.composition_split_1_percentage = 0;
        updates.composition_split_2_percentage = 0;
        updates.composition_split_3_percentage = 0;
      } else {
        updates.production_split_1_percentage = 0;
        updates.production_split_2_percentage = 0;
        updates.production_split_3_percentage = 0;
      }
    } else {
      // Calculate base percentage and remainder (first person gets extra)
      const basePercentage = Math.floor(100 / contributorCount);
      const remainder = 100 - (basePercentage * contributorCount);
      
      if (splitType === 'composition') {
        updates.composition_split_1_percentage = contributorCount >= 1 ? basePercentage + remainder : 0;
        updates.composition_split_2_percentage = contributorCount >= 2 ? basePercentage : 0;
        updates.composition_split_3_percentage = contributorCount >= 3 ? basePercentage : 0;
      } else {
        updates.production_split_1_percentage = contributorCount >= 1 ? basePercentage + remainder : 0;
        updates.production_split_2_percentage = contributorCount >= 2 ? basePercentage : 0;
        updates.production_split_3_percentage = contributorCount >= 3 ? basePercentage : 0;
      }
    }
    
    return updates;
  };

  // Handle form input changes with auto-splitting logic
  const handleInputChange = (field: keyof IPTrackFormData, value: any) => {
    // Clear validation errors when user starts fixing things
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
    
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      
      // Auto-calculate splits when wallet addresses are added/removed
      if (field.includes('_wallet')) {
        const isComposition = field.includes('composition');
        const isProduction = field.includes('production');
        
        if (isComposition || isProduction) {
          const splitType = isComposition ? 'composition' : 'production';
          const prefix = `${splitType}_split`;
          
          // Count non-empty wallet addresses
          const contributorCount = [1, 2, 3].filter(i => {
            const walletField = `${prefix}_${i}_wallet` as keyof IPTrackFormData;
            const walletValue = i === parseInt(field.split('_')[2]) ? value : newFormData[walletField];
            return walletValue && walletValue.trim() !== '';
          }).length;
          
          // Apply auto-splitting
          const splitUpdates = autoCalculateSplits(splitType, contributorCount);
          Object.assign(newFormData, splitUpdates);
        }
      }
      
      return newFormData;
    });
  };

  // Handle loading a preset
  const handleLoadPreset = (preset: IPTrackSplitPreset) => {
    const updatedFormData = SplitPresetManager.applyPresetToForm(preset, formData);
    setFormData(updatedFormData);
    console.log('✅ Preset loaded:', preset.name);
  };

  // Handle saving a preset
  const handleSavePreset = (presetData: Omit<IPTrackSplitPreset, 'id' | 'created_at'>) => {
    console.log('✅ Preset saved:', presetData.name);
    // The actual saving is handled by the SplitPresetManagerUI component
  };

  // Handle tag changes - maintain raw input for better UX
  const [tagInputValue, setTagInputValue] = useState('');
  
  const handleTagsChange = (tagString: string) => {
    setTagInputValue(tagString);
    // Only process tags when user finishes typing (on blur or specific triggers)
    // For now, just store the raw input and process on blur
  };

  const processTagsFromInput = (tagString: string) => {
    const tags = tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    setFormData(prev => ({ ...prev, tags }));
  };

  // Handle audio file upload with progress
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/m4a', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      setValidationErrors(['Please select a valid audio file (MP3, WAV, FLAC, M4A, OGG)']);
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setValidationErrors(['Audio file must be smaller than 50MB']);
      return;
    }

    await processAudioFile(file);
  };

  // Process audio file with progress feedback
  const processAudioFile = async (file: File) => {
    try {
      setIsAudioUploading(true);
      setValidationErrors([]);
      
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      
      // Stage 1: Analyzing (includes BPM detection for loops)
      setAudioUploadProgress({
        stage: 'analyzing',
        message: `Analyzing audio file...`,
        progress: 15,
        fileSize: `${fileSizeMB}MB`
      });
      
      console.log(`🎵 Processing audio: ${file.name} (${fileSizeMB}MB)`);
      
      // BPM Detection for loops
      let detectionResult: BPMDetectionResult | null = null;
      if (formData.content_type === 'loop') {
        setIsDetectingBPM(true);
        setAudioUploadProgress({
          stage: 'analyzing',
          message: `Detecting BPM for 8-bar loop...`,
          progress: 20,
          fileSize: `${fileSizeMB}MB`
        });
        
        try {
          detectionResult = await detectBPMFromAudioFile(file);
          setBpmDetection(detectionResult);
          
          // 🔧 FIXED: Only set BPM if user hasn't manually entered one
          const hasManualBPM = formData.bpm && formData.bpm > 0;
          if (detectionResult.detected && detectionResult.bpm && !hasManualBPM) {
            handleInputChange('bpm', detectionResult.bpm);
            console.log(`🎵 BPM auto-detected: ${detectionResult.bpm} (${detectionResult.confidence} confidence)`);
          } else if (hasManualBPM) {
            console.log(`🎵 BPM detection result: ${detectionResult.bpm}, but keeping manual input: ${formData.bpm}`);
          }
        } catch (error) {
          console.log('🎵 BPM detection failed:', error);
        } finally {
          setIsDetectingBPM(false);
        }
      }
      
      // Stage 2: Processing
      setAudioUploadProgress({
        stage: 'processing',
        message: `Validating audio format...`,
        progress: 35,
        fileSize: `${fileSizeMB}MB`
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stage 3: Uploading to Supabase Storage
      setAudioUploadProgress({
        stage: 'uploading',
        message: `Uploading ${fileSizeMB}MB audio file to cloud storage...`,
        progress: 50,
        fileSize: `${fileSizeMB}MB`
      });
      
      // REAL UPLOAD: Use SupabaseAuthBridge for authenticated upload
      if (!walletAddress) {
        throw new Error('Wallet address required for file upload');
      }
      
      // Generate clean filename
      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const audioPath = `${walletAddress}/audio/${timestamp}_${cleanFileName}`;
      
      console.log(`🎵 Uploading to Supabase Storage: ${audioPath}`);
      
      // Create authenticated session and upload
      const authSession = await SupabaseAuthBridge.createWalletSession(walletAddress);
      
      if (!authSession.isAuthenticated) {
        throw new Error('Failed to authenticate for file upload');
      }
      
      // Update progress during upload
      setAudioUploadProgress({
        stage: 'uploading',
        message: `Uploading to cloud storage...`,
        progress: 70,
        fileSize: `${fileSizeMB}MB`
      });
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await authSession.supabase.storage
        .from('user-content')
        .upload(audioPath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });
      
      if (uploadError) {
        console.error('🚨 Supabase upload failed:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data: urlData } = authSession.supabase.storage
        .from('user-content')
        .getPublicUrl(audioPath);
      
      console.log(`✅ Audio uploaded successfully: ${urlData.publicUrl}`);
      
      // Stage 4: Finalizing
      setAudioUploadProgress({
        stage: 'finalizing',
        message: 'Finalizing upload...',
        progress: 90,
        fileSize: `${fileSizeMB}MB`
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stage 5: Complete
      setAudioUploadProgress({
        stage: 'complete',
        message: `Audio uploaded successfully! ✨`,
        progress: 100,
        fileSize: `${fileSizeMB}MB`
      });
      
      setUploadedAudioFile(file);
      
      // Set the REAL URL from Supabase Storage
      handleInputChange('audio_url', urlData.publicUrl);
      
      // Show success briefly, then reset
      setTimeout(() => {
        setAudioUploadProgress({ stage: 'idle', message: '', progress: 0 });
        setIsAudioUploading(false);
      }, 1500);
      
    } catch (error) {
      console.error('🚨 Audio upload failed:', error);
      setIsAudioUploading(false);
      setAudioUploadProgress({ stage: 'idle', message: '', progress: 0 });
      setValidationErrors([`Failed to upload audio file: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  // Navigation
  const goToStep = (step: number) => {
    if (step >= 0 && step < getSteps().length) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < getSteps().length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle final submission
  const handleSubmit = async () => {
    console.log('🎯 SUBMIT STARTED - Form Data:', formData);
    
    // Validate all splits
    const compositionValidation = validateSplits('composition');
    const productionValidation = validateSplits('production');
    
    const errors = [...compositionValidation.errors, ...productionValidation.errors];
    
    // Validate required fields
    if (!formData.title || formData.title.trim() === '') {
      errors.push('Track title is required');
    }
    
    if (!formData.artist || formData.artist.trim() === '') {
      errors.push('Artist name is required');
    }
    
    // Validate BPM for loops - always required for loops in advanced mode
    if (!isQuickUpload && formData.content_type === 'loop' && (!formData.bpm || formData.bpm <= 0 || isNaN(formData.bpm))) {
      errors.push('BPM is required for loops and must be a valid number greater than 0');
    }
    
    // Validate that either audio URL or file is provided
    if (!formData.audio_url || formData.audio_url.trim() === '') {
      errors.push('Audio file is required');
    }

    // Terms agreement is handled at platform level - no need to validate per track
    
    if (errors.length > 0) {
      console.log('❌ VALIDATION ERRORS:', errors);
      setValidationErrors(errors);
      return;
    }

    console.log('✅ VALIDATION PASSED - Starting save...');
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // Map our form data to the current database schema
      // Destructure to exclude isrc field (phantom column)
      const { isrc, ...formDataWithoutIsrc } = formData;
      
      const mappedTrackData = {
        id: formData.id,
        title: formData.title,
        version: formData.version,
        artist: formData.artist,
        description: formData.description,
        tags: formData.tags,
        content_type: formData.content_type,
        loop_category: formData.content_type === 'loop' ? formData.loop_category : null,
        sample_type: formData.content_type === 'loop' ? 'instrumentals' : 'FULL SONGS',
        bpm: formData.bpm || null,
        key: formData.key || null,
        isrc_number: isrc || '',  // DATABASE COLUMN: isrc_number (not isrc)
        tell_us_more: formData.tell_us_more || '',
        
        // Composition splits - use NEW column names
        composition_split_1_wallet: formData.composition_split_1_wallet,
        composition_split_1_percentage: formData.composition_split_1_percentage,
        composition_split_2_wallet: formData.composition_split_2_wallet || null,
        composition_split_2_percentage: formData.composition_split_2_percentage || 0,
        composition_split_3_wallet: formData.composition_split_3_wallet || null,
        composition_split_3_percentage: formData.composition_split_3_percentage || 0,
        
        // Production splits - use NEW column names
        production_split_1_wallet: formData.production_split_1_wallet,
        production_split_1_percentage: formData.production_split_1_percentage,
        production_split_2_wallet: formData.production_split_2_wallet || null,
        production_split_2_percentage: formData.production_split_2_percentage || 0,
        production_split_3_wallet: formData.production_split_3_wallet || null,
        production_split_3_percentage: formData.production_split_3_percentage || 0,
        
        // Licensing and permissions - USE ACTUAL DATABASE COLUMN NAMES
        license_type: formData.license_type,
        allow_remixing: formData.allow_remixing,
        open_to_collaboration: formData.open_to_collaboration,
        agree_terms: true,  // DATABASE COLUMN: agree_terms (not agreed_to_terms)
        agree_permissions: true,  // DATABASE COLUMN: agree_permissions
        agree_collab: formData.open_to_collaboration,  // DATABASE COLUMN: agree_collab
        
        // Pricing
        price_stx: formData.price_stx,
        
        // Media assets - USE ACTUAL DATABASE COLUMN NAMES
        cover_image_url: formData.cover_image_url,
        image_url: formData.cover_image_url,  // DATABASE COLUMN: image_url (duplicate for compatibility)
        audio_url: formData.audio_url,
        
        // Metadata
        created_at: track?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // Collaboration system - USE ACTUAL DATABASE COLUMN NAMES
        primary_uploader_wallet: walletAddress || "",
        uploader_address: walletAddress || "",  // DATABASE COLUMN: uploader_address
        collaboration_preferences: {},  // DATABASE COLUMN: collaboration_preferences
        store_display_policy: 'primary_only',  // DATABASE COLUMN: store_display_policy
        collaboration_type: 'primary_artist',  // DATABASE COLUMN: collaboration_type
        
        // Additional database fields that should be set
        is_live: true,  // DATABASE COLUMN: is_live
        account_name: walletAddress || "",  // DATABASE COLUMN: account_name
        main_wallet_name: walletAddress || "",  // DATABASE COLUMN: main_wallet_name
      };

      console.log('📤 MAPPED DATA FOR SUPABASE:', mappedTrackData);
      console.log('👤 Wallet Address:', walletAddress);

      // Create authenticated Supabase session
      if (!walletAddress) {
        throw new Error('Wallet address is required for authentication');
      }

      console.log('🔐 Creating authenticated Supabase session...');
      const authSession = await SupabaseAuthBridge.createWalletSession(walletAddress);
      
      if (!authSession.isAuthenticated) {
        throw new Error('Failed to create authenticated session');
      }

      console.log('✅ Authenticated session created successfully');

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
        const { data, error } = await authSession.supabase
          .from('ip_tracks')
          .insert([mappedTrackData])
          .select();
        
        if (error) {
          console.error('❌ INSERT ERROR:', error);
          throw error;
        }
        console.log('✅ INSERT SUCCESS!', data);
      }
      
      console.log('🎉 SAVE COMPLETE - Setting status...');
      setSaveStatus('complete');
      
      // Call onSave callback if provided
      if (onSave) {
        console.log('📞 CALLING onSave callback...');
        // Convert mapped data back to IPTrack format for callback
        const callbackData: IPTrack = {
          ...formData,
          created_at: mappedTrackData.created_at,
          updated_at: mappedTrackData.updated_at,
          created_by: mappedTrackData.primary_uploader_wallet,
          // Map isrc_number back to isrc for interface compatibility
          isrc: isrc,
        };
        onSave(callbackData);
      }
      
      // Brief delay to show success, then close
      setTimeout(() => {
        console.log('🚪 CLOSING MODAL...');
        setIsSaving(false);
        setSaveStatus('idle');
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('💥 SAVE FAILED:', error);
      console.error('💥 ERROR TYPE:', typeof error);
      console.error('💥 ERROR DETAILS:', JSON.stringify(error, null, 2));
      setIsSaving(false);
      setSaveStatus('idle');
      
      // Better error message handling
      let errorMessage = 'An unexpected error occurred';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = (error as any).message;
        } else if ('details' in error) {
          errorMessage = (error as any).details;
        } else {
          errorMessage = JSON.stringify(error);
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setValidationErrors([`Failed to save track: ${errorMessage}`]);
    }
  };

  const renderStep = () => {
    // Handle Quick Upload mode
    if (isQuickUpload) {
      switch (currentStep) {
        case 0: // Basic Information (Quick Upload)
          return (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Track Title*
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter track title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Artist Name*
                </label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => handleInputChange('artist', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter artist name"
                  required
                />
              </div>

              {/* Two-Tier Content Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Content Type*
                </label>
                <div className="space-y-3">
                  {/* Primary Content Type Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange('content_type', 'full_song');
                        handleInputChange('loop_category', '');
                      }}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        formData.content_type === 'full_song'
                          ? 'border-accent bg-accent/10 text-white'
                          : 'border-slate-700 bg-slate-800 text-gray-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <span className="font-medium">Full Song</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Complete musical compositions (Auto-priced: 2.5 STX)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInputChange('content_type', 'loop')}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        formData.content_type === 'loop'
                          ? 'border-accent bg-accent/10 text-white'
                          : 'border-slate-700 bg-slate-800 text-gray-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="font-medium">Loop/Sample</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Loops, stems, vocals, beats (Auto-priced: 1.0 STX)
                      </p>
                    </button>
                  </div>

                  {/* Loop Category Selection (only show if loop is selected) */}
                  {formData.content_type === 'loop' && (
                    <div className="ml-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Loop Category*
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {LOOP_CATEGORIES.map(category => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => handleInputChange('loop_category', category)}
                            className={`px-3 py-2 rounded-md text-sm transition-colors ${
                              formData.loop_category === category
                                ? 'bg-accent text-slate-900 font-medium'
                                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                            }`}
                          >
                            {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                      
                      {/* Custom Category Input */}
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Or create custom category:
                        </label>
                        <input
                          type="text"
                          value={!LOOP_CATEGORIES.includes(formData.loop_category as LoopCategory) ? formData.loop_category : ''}
                          onChange={(e) => handleInputChange('loop_category', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                          placeholder="e.g., synth pads, drum fills, sound effects..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagInputValue}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  onBlur={(e) => processTagsFromInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="hip-hop, trap, dark, etc."
                />
                {formData.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

                          <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows={3}
                placeholder="Describe your track, give credits to specific contributors (e.g. 'Guitar by Alex, Vocals by Sam'), mention instruments, recording techniques, or inspiration. This helps both AI discovery and human understanding of your work..."
              />
              <p className="text-xs text-gray-400 mt-1">
                💡 <strong>Pro tip:</strong> Use this space for detailed credits, shout-outs, and technical notes that don't fit in the simple role categories above.
              </p>
            </div>

              {/* AI Discovery - Rich Metadata */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  🤖 Rich Context for AI Discovery
                  <span className="text-xs text-gray-400 ml-2">(Optional but powerful)</span>
                </label>
                <textarea
                  value={formData.tell_us_more}
                  onChange={(e) => handleInputChange('tell_us_more', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={4}
                  placeholder="Describe the mood, vibe, story, inspiration, emotions, or any special context that makes this track unique. This helps AI understand and surface your music in unexpected ways. Write in any language - the more detail, the better the discovery..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  ✨ This rich text helps AI understand mood, emotions, and nuances that tags can't capture. 
                  Perfect for mood-based discovery and matching your track with the right listeners.
                </p>
              </div>

              {/* Musical Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    BPM{formData.content_type === 'loop' ? '*' : ' (optional)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="60"
                      max="200"
                      value={formData.bpm || ''}
                      onChange={(e) => handleInputChange('bpm', parseInt(e.target.value) || 0)}
                      className={`w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent ${isDetectingBPM ? 'opacity-50' : ''}`}
                      placeholder="120"
                      required={formData.content_type === 'loop'}
                      disabled={isDetectingBPM}
                    />
                    {isDetectingBPM && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* BPM Detection Results */}
                  {bpmDetection && bpmDetection.detected && (
                    <div className={`mt-2 p-2 rounded text-xs ${
                      bpmDetection.confidence === 'high' ? 'bg-green-900/20 border border-green-700 text-green-400' :
                      bpmDetection.confidence === 'medium' ? 'bg-yellow-900/20 border border-yellow-700 text-yellow-400' :
                      'bg-red-900/20 border border-red-700 text-red-400'
                    }`}>
                      <div className="flex items-center mb-1">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7" />
                        </svg>
                        {formData.bpm && formData.bpm > 0 && formData.bpm !== bpmDetection.bpm ? (
                          <span className="font-medium">
                            Auto-detected: {bpmDetection.bpm} BPM • Using manual: {formData.bpm} BPM
                          </span>
                        ) : (
                          <span className="font-medium">Auto-detected: {bpmDetection.bpm} BPM</span>
                        )}
                        <span className="ml-2 opacity-75">({bpmDetection.confidence} confidence)</span>
                      </div>
                      <p className="opacity-80">{bpmDetection.reasoning}</p>
                    </div>
                  )}
                  
                  {formData.content_type === 'loop' && !bpmDetection && (
                    <p className="text-xs text-accent mt-1">
                      Essential for loops • Upload audio for auto-detection
                    </p>
                  )}
                  
                  {formData.content_type === 'full_song' && (
                    <p className="text-xs text-gray-400 mt-1">Optional for full songs</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Key (optional)
                  </label>
                  <select
                    value={formData.key}
                    onChange={(e) => handleInputChange('key', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Select key...</option>
                    <option value="C">C</option>
                    <option value="C#">C#</option>
                    <option value="D">D</option>
                    <option value="D#">D#</option>
                    <option value="E">E</option>
                    <option value="F">F</option>
                    <option value="F#">F#</option>
                    <option value="G">G</option>
                    <option value="G#">G#</option>
                    <option value="A">A</option>
                    <option value="A#">A#</option>
                    <option value="B">B</option>
                    <option value="Cm">Cm</option>
                    <option value="C#m">C#m</option>
                    <option value="Dm">Dm</option>
                    <option value="D#m">D#m</option>
                    <option value="Em">Em</option>
                    <option value="Fm">Fm</option>
                    <option value="F#m">F#m</option>
                    <option value="Gm">Gm</option>
                    <option value="G#m">G#m</option>
                    <option value="Am">Am</option>
                    <option value="A#m">A#m</option>
                    <option value="Bm">Bm</option>
                  </select>
                </div>
              </div>

              <div className="bg-gradient-to-r from-accent/10 to-accent/5 p-4 rounded-lg border border-accent/20">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-accent mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-accent font-medium">Quick Upload Mode</span>
                </div>
                <p className="text-sm text-gray-300">
                  Smart defaults applied: <strong>{formData.price_stx} STX</strong> pricing, 
                  <strong> unlimited copies</strong>, <strong>remix-friendly</strong> licensing, 
                  <strong>100% solo attribution</strong>
                </p>
              </div>
            </div>
          );

        case 1: // File Uploads (reuse existing case 5)
          return (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Cover Art
                </label>
                <ImageUploader
                  initialImage={formData.cover_image_url}
                  onImageChange={(imageData) => handleInputChange('cover_image_url', imageData)}
                  aspectRatio="square"
                  section="gallery"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Audio File
                </label>
                
                {/* Audio Upload Tabs */}
                <div className="mb-3">
                  <div className="flex border-b border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAudioInputType('upload')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        audioInputType === 'upload'
                          ? 'text-accent border-b-2 border-accent'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioInputType('url')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        audioInputType === 'url'
                          ? 'text-accent border-b-2 border-accent'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      URL
                    </button>
                  </div>
                </div>

                {/* Audio input content - reuse existing implementation */}
                {audioInputType === 'url' ? (
                  <div>
                    <input
                      type="url"
                      value={formData.audio_url}
                      onChange={(e) => handleInputChange('audio_url', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="https://... (audio file URL)"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Paste a direct link to your audio file (MP3, WAV, etc.)
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-accent transition-colors relative">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => handleAudioFileUpload(e)}
                        className="hidden"
                        id="audio-upload"
                        disabled={isAudioUploading}
                      />
                      
                      {/* Upload Progress Overlay - reuse existing implementation */}
                      {isAudioUploading && (
                        <div className="absolute inset-0 bg-slate-800/95 rounded-lg flex flex-col items-center justify-center">
                          <div className="w-full max-w-xs">
                            {/* Progress Stage Icon */}
                            <div className="mb-4 flex justify-center">
                              {audioUploadProgress.stage === 'analyzing' && (
                                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                              )}
                              {audioUploadProgress.stage === 'processing' && (
                                <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                  </svg>
                                </div>
                              )}
                              {audioUploadProgress.stage === 'uploading' && (
                                <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                </div>
                              )}
                              {audioUploadProgress.stage === 'finalizing' && (
                                <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              {audioUploadProgress.stage === 'complete' && (
                                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            
                            {/* Progress Message */}
                            <p className="text-white text-sm font-medium mb-2 text-center">
                              {audioUploadProgress.message}
                            </p>
                            
                            {/* File Size */}
                            {audioUploadProgress.fileSize && (
                              <p className="text-gray-400 text-xs mb-3 text-center">
                                {audioUploadProgress.fileSize}
                              </p>
                            )}
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  audioUploadProgress.stage === 'complete' ? 'bg-green-500' : 'bg-accent'
                                }`}
                                style={{ width: `${audioUploadProgress.progress}%` }}
                              />
                            </div>
                            
                            {/* Progress Percentage */}
                            <p className="text-gray-400 text-xs text-center">
                              {audioUploadProgress.progress}% complete
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <label htmlFor="audio-upload" className={isAudioUploading ? 'pointer-events-none' : 'cursor-pointer'}>
                        <div className="mb-3">
                          <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <p className="text-gray-400 text-sm mb-1">
                          {uploadedAudioFile ? uploadedAudioFile.name : 'Click to select audio file'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Supports MP3, WAV, FLAC, M4A (max 50MB)
                        </p>
                      </label>
                    </div>
                    {uploadedAudioFile && !isAudioUploading && (
                      <div className="mt-2 flex items-center justify-between bg-slate-800 p-2 rounded">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-white">{uploadedAudioFile.name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            ({(uploadedAudioFile.size / (1024 * 1024)).toFixed(1)}MB)
                          </span>
                          <span className="text-xs text-green-400 ml-2">
                            ✓ Uploaded
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedAudioFile(null);
                            handleInputChange('audio_url', '');
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );

        case 2: // Review & Submit (Quick Upload)
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white mb-4">Review & Submit</h3>
              
              <div className="space-y-4">
                {/* Quick Upload Summary */}
                <div className="bg-gradient-to-r from-accent/10 to-accent/5 p-4 rounded-lg border border-accent/20">
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 text-accent mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-accent font-medium">Quick Upload Summary</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    Ready to publish with smart defaults: <strong>{formData.price_stx} STX</strong>, 
                    <strong> unlimited copies</strong>, <strong>standard licensing</strong>, 
                    <strong>100% solo attribution</strong>
                  </p>
                </div>

                {/* Track Information */}
                <div className="bg-slate-800 p-4 rounded-md space-y-3">
                  <h4 className="font-medium text-accent">Track Information</h4>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-300">Title:</p>
                    <p className="text-white">{formData.title || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-300">Artist:</p>
                    <p className="text-white">{formData.artist || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-300">Content Type:</p>
                    <p className="text-white">
                      {formData.content_type === 'full_song' ? 'Full Song' : 'Loop'}
                      {formData.content_type === 'loop' && formData.loop_category && 
                        ` - ${formData.loop_category.charAt(0).toUpperCase() + formData.loop_category.slice(1).replace('_', ' ')}`
                      }
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-300">Price:</p>
                    <p className="text-white">{formData.price_stx} STX (auto-pricing)</p>
                  </div>
                  
                  {formData.tags.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-300">Tags:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {formData.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-md">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {formData.tell_us_more && (
                    <div>
                      <p className="text-sm font-medium text-gray-300">🤖 AI Discovery Context:</p>
                      <div className="bg-slate-700 p-3 rounded-md mt-1">
                        <p className="text-white text-sm leading-relaxed">
                          {formData.tell_us_more}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        ✨ This rich context helps AI understand and surface your music
                      </p>
                    </div>
                  )}
                </div>

                {/* Auto-Applied Settings */}
                <div className="bg-slate-800 p-4 rounded-md space-y-3">
                  <h4 className="font-medium text-accent">Auto-Applied Settings</h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-300">Attribution:</p>
                      <p className="text-white">100% Solo (You)</p>
                    </div>
                    <div>
                      <p className="text-gray-300">Availability:</p>
                      <p className="text-white">Unlimited Copies</p>
                    </div>
                    <div>
                      <p className="text-gray-300">License:</p>
                      <p className="text-white">Remix + External Use</p>
                    </div>
                    <div>
                      <p className="text-gray-300">Permissions:</p>
                      <p className="text-white">Remix-Friendly</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-900/20 border border-green-700 p-3 rounded-md">
                  <p className="text-green-400 text-sm">
                    ✓ All settings applied automatically. Ready to publish!
                  </p>
                </div>
              </div>
            </div>
          );

        default:
          return null;
      }
    }

    // Advanced mode - existing implementation
    switch (currentStep) {
      case 0: // Basic Information
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Track Title*
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter track title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Version
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => handleInputChange('version', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Remix, Radio Edit, Demo, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Artist Name*
              </label>
              <input
                type="text"
                value={formData.artist}
                onChange={(e) => handleInputChange('artist', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter artist name"
                required
              />
            </div>

            {/* Two-Tier Content Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Content Type*
              </label>
              <div className="space-y-3">
                {/* Primary Content Type Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('content_type', 'full_song');
                      handleInputChange('loop_category', ''); // Clear loop category for full songs
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.content_type === 'full_song'
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-slate-700 bg-slate-800 text-gray-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className="font-medium">Full Song</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Complete musical compositions and finished tracks
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange('content_type', 'loop')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.content_type === 'loop'
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-slate-700 bg-slate-800 text-gray-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="font-medium">Loop/Sample</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Loops, stems, vocals, beats, and production elements
                    </p>
                  </button>
                </div>

                {/* Loop Category Selection (only show if loop is selected) */}
                {formData.content_type === 'loop' && (
                  <div className="ml-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Loop Category*
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {LOOP_CATEGORIES.map(category => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => handleInputChange('loop_category', category)}
                          className={`px-3 py-2 rounded-md text-sm transition-colors ${
                            formData.loop_category === category
                              ? 'bg-accent text-slate-900 font-medium'
                              : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                          }`}
                        >
                          {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                    
                    {/* Custom Category Input */}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Or create custom category:
                      </label>
                      <input
                        type="text"
                        value={!LOOP_CATEGORIES.includes(formData.loop_category as LoopCategory) ? formData.loop_category : ''}
                        onChange={(e) => handleInputChange('loop_category', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        placeholder="e.g., synth pads, drum fills, sound effects..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BPM Field - Show for loops (essential) and full songs (optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  BPM {formData.content_type === 'loop' ? '*' : '(Optional)'}
                </label>
                <input
                  type="number"
                  min="60"
                  max="200"
                  value={formData.bpm || ''}
                  onChange={(e) => handleInputChange('bpm', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="120"
                  required={formData.content_type === 'loop'}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {formData.content_type === 'loop' 
                    ? '🎵 Essential for loops - helps with tempo matching'
                    : '🎵 Helps with tempo matching and discovery'
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Key (Optional)
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => handleInputChange('key', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="C, Am, F#, etc."
                />
                <p className="text-xs text-gray-400 mt-1">
                  🎹 Musical key for harmonic matching
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows={3}
                placeholder="Describe your track, give credits to specific contributors (e.g. 'Guitar by Alex, Vocals by Sam'), mention instruments, recording techniques, or inspiration. This helps both AI discovery and human understanding of your work..."
              />
              <p className="text-xs text-gray-400 mt-1">
                💡 <strong>Pro tip:</strong> Use this space for detailed credits, shout-outs, and technical notes that don't fit in the simple role categories above.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagInputValue}
                onChange={(e) => handleTagsChange(e.target.value)}
                onBlur={(e) => processTagsFromInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="hip-hop, trap, dark, etc."
              />
              {formData.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI Discovery - Rich Metadata */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                🤖 Rich Context for AI Discovery
                <span className="text-xs text-gray-400 ml-2">(Optional but powerful)</span>
              </label>
              <textarea
                value={formData.tell_us_more}
                onChange={(e) => handleInputChange('tell_us_more', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows={4}
                placeholder="Describe the mood, vibe, story, inspiration, emotions, lyrics, cultural context, or any special nuances that make this track unique. This helps AI understand and surface your music in unexpected ways. Write in any language - the more detail, the better the discovery..."
              />
              <p className="text-xs text-gray-400 mt-1">
                ✨ This rich text helps AI understand mood, emotions, and nuances that tags can't capture. 
                Perfect for mood-based discovery and matching your track with the right listeners.
              </p>
            </div>
          </div>
        );

      case 1: // Pricing & Availability
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Set Your Price</h3>
              <p className="text-gray-400 text-sm mb-4">How much should people pay to license your track?</p>
              
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={formData.price_stx}
                  onChange={(e) => handleInputChange('price_stx', parseFloat(e.target.value) || 0.1)}
                  className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="text-white font-medium">STX</span>
              </div>
              
              <div className="mt-2 text-sm text-gray-400">
                <p>💡 Suggested: {formData.content_type === 'loop' ? '0.5-2 STX for loops' : '2-5 STX for full songs'}</p>
              </div>
            </div>

            {/* Availability section removed - edition_size is phantom column */}
          </div>
        );

      case 2: // Composition Attribution  
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white mb-4">Who wrote it? (Composition Rights)</h3>
            <p className="text-gray-400 text-sm mb-4">Who wrote the melody, harmony, and lyrics? Percentages auto-calculate equally as you add contributors.</p>
            
            {/* Split Preset Manager */}
            <SplitPresetManagerUI
              onLoadPreset={handleLoadPreset}
              onSavePreset={handleSavePreset}
              currentFormData={formData}
            />
            
            {/* Composition Split 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Creator 1 Wallet*
                </label>
                <input
                  type="text"
                  value={formData.composition_split_1_wallet}
                  onChange={(e) => handleInputChange('composition_split_1_wallet', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="SP..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Percentage* (auto-calculated)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.composition_split_1_percentage}
                  onChange={(e) => handleInputChange('composition_split_1_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Composition Split 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Creator 2 Wallet
                </label>
                <input
                  type="text"
                  value={formData.composition_split_2_wallet}
                  onChange={(e) => handleInputChange('composition_split_2_wallet', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="SP... (adds equal split)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Percentage (auto-calculated)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.composition_split_2_percentage}
                  onChange={(e) => handleInputChange('composition_split_2_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Composition Split 3 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Creator 3 Wallet
                </label>
                <input
                  type="text"
                  value={formData.composition_split_3_wallet}
                  onChange={(e) => handleInputChange('composition_split_3_wallet', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="SP... (adds equal split)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Percentage (auto-calculated)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.composition_split_3_percentage}
                  onChange={(e) => handleInputChange('composition_split_3_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded-md">
              <p className="text-sm text-gray-300">
                Total: {(formData.composition_split_1_percentage + formData.composition_split_2_percentage + formData.composition_split_3_percentage).toFixed(2)}%
              </p>
              {Math.abs((formData.composition_split_1_percentage + formData.composition_split_2_percentage + formData.composition_split_3_percentage) - 100) > 0.01 && (
                <p className="text-red-400 text-xs mt-1">
                  ⚠️ Splits must total exactly 100%
                </p>
              )}
            </div>
          </div>
        );

      case 3: // Production Attribution
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white mb-4">Who recorded it? (Recording Rights)</h3>
            <p className="text-gray-400 text-sm mb-4">Who produced, mixed, and mastered the track? Percentages auto-calculate equally as you add contributors.</p>
            
            {/* Production Split 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Creator 1 Wallet*
                </label>
                <input
                  type="text"
                  value={formData.production_split_1_wallet}
                  onChange={(e) => handleInputChange('production_split_1_wallet', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="SP..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Percentage* (auto-calculated)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.production_split_1_percentage}
                  onChange={(e) => handleInputChange('production_split_1_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Production Split 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Creator 2 Wallet
                </label>
                <input
                  type="text"
                  value={formData.production_split_2_wallet}
                  onChange={(e) => handleInputChange('production_split_2_wallet', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="SP... (adds equal split)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Percentage (auto-calculated)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.production_split_2_percentage}
                  onChange={(e) => handleInputChange('production_split_2_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Production Split 3 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Creator 3 Wallet
                </label>
                <input
                  type="text"
                  value={formData.production_split_3_wallet}
                  onChange={(e) => handleInputChange('production_split_3_wallet', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="SP... (adds equal split)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Percentage (auto-calculated)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.production_split_3_percentage}
                  onChange={(e) => handleInputChange('production_split_3_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded-md">
              <p className="text-sm text-gray-300">
                Total: {(formData.production_split_1_percentage + formData.production_split_2_percentage + formData.production_split_3_percentage).toFixed(2)}%
              </p>
              {Math.abs((formData.production_split_1_percentage + formData.production_split_2_percentage + formData.production_split_3_percentage) - 100) > 0.01 && (
                <p className="text-red-400 text-xs mt-1">
                  ⚠️ Splits must total exactly 100%
                </p>
              )}
            </div>
          </div>
        );

      case 4: // Connect to Existing Release (Optional)
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white mb-4">Connect to Existing Release (Optional)</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                ISRC Code
              </label>
              <input
                type="text"
                value={formData.isrc}
                onChange={(e) => handleInputChange('isrc', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="(optional)"
              />
            </div>

            {/* Social media and contact info fields removed for platform-level management */}
          </div>
        );

      case 5: // File Uploads
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white mb-4">File Uploads</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Cover Art
              </label>
              <ImageUploader
                initialImage={formData.cover_image_url}
                onImageChange={(imageData) => handleInputChange('cover_image_url', imageData)}
                aspectRatio="square"
                section="gallery"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Audio File
              </label>
              
              {/* Audio Upload Tabs */}
              <div className="mb-3">
                <div className="flex border-b border-slate-700">
                  <button
                    type="button"
                    onClick={() => setAudioInputType('upload')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      audioInputType === 'upload'
                        ? 'text-accent border-b-2 border-accent'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioInputType('url')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      audioInputType === 'url'
                        ? 'text-accent border-b-2 border-accent'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    URL
                  </button>
                </div>
              </div>

              {audioInputType === 'url' ? (
                <div>
                  <input
                    type="url"
                    value={formData.audio_url}
                    onChange={(e) => handleInputChange('audio_url', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="https://... (audio file URL)"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Paste a direct link to your audio file (MP3, WAV, etc.)
                  </p>
                </div>
              ) : (
                <div>
                  <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-accent transition-colors relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleAudioFileUpload(e)}
                      className="hidden"
                      id="audio-upload"
                      disabled={isAudioUploading}
                    />
                    
                    {/* Upload Progress Overlay */}
                    {isAudioUploading && (
                      <div className="absolute inset-0 bg-slate-800/95 rounded-lg flex flex-col items-center justify-center">
                        <div className="w-full max-w-xs">
                          {/* Progress Stage Icon */}
                          <div className="mb-4 flex justify-center">
                            {audioUploadProgress.stage === 'analyzing' && (
                              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                            )}
                            {audioUploadProgress.stage === 'processing' && (
                              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              </div>
                            )}
                            {audioUploadProgress.stage === 'uploading' && (
                              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                              </div>
                            )}
                            {audioUploadProgress.stage === 'finalizing' && (
                              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            {audioUploadProgress.stage === 'complete' && (
                              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Progress Message */}
                          <p className="text-white text-sm font-medium mb-2 text-center">
                            {audioUploadProgress.message}
                          </p>
                          
                          {/* File Size */}
                          {audioUploadProgress.fileSize && (
                            <p className="text-gray-400 text-xs mb-3 text-center">
                              {audioUploadProgress.fileSize}
                            </p>
                          )}
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                audioUploadProgress.stage === 'complete' ? 'bg-green-500' : 'bg-accent'
                              }`}
                              style={{ width: `${audioUploadProgress.progress}%` }}
                            />
                          </div>
                          
                          {/* Progress Percentage */}
                          <p className="text-gray-400 text-xs text-center">
                            {audioUploadProgress.progress}% complete
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <label htmlFor="audio-upload" className={isAudioUploading ? 'pointer-events-none' : 'cursor-pointer'}>
                      <div className="mb-3">
                        <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <p className="text-gray-400 text-sm mb-1">
                        {uploadedAudioFile ? uploadedAudioFile.name : 'Click to select audio file'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Supports MP3, WAV, FLAC, M4A (max 50MB)
                      </p>
                    </label>
                  </div>
                                     {uploadedAudioFile && !isAudioUploading && (
                     <div className="mt-2 flex items-center justify-between bg-slate-800 p-2 rounded">
                       <div className="flex items-center">
                         <svg className="w-4 h-4 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                         </svg>
                         <span className="text-sm text-white">{uploadedAudioFile.name}</span>
                         <span className="text-xs text-gray-400 ml-2">
                           ({(uploadedAudioFile.size / (1024 * 1024)).toFixed(1)}MB)
                         </span>
                         <span className="text-xs text-green-400 ml-2">
                           ✓ Uploaded
                         </span>
                       </div>
                       <button
                         type="button"
                         onClick={() => {
                           setUploadedAudioFile(null);
                           handleInputChange('audio_url', '');
                         }}
                         className="text-red-400 hover:text-red-300"
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                         </svg>
                       </button>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>
        );

      case 6: // Licensing & Permissions
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-2">License Type</h3>
              <p className="text-gray-400 text-sm mb-4">How can others use your track?</p>
              
              <div className="space-y-3">
                <label className="flex items-start p-4 border-2 border-slate-700 rounded-lg cursor-pointer hover:border-accent transition-colors">
                  <input
                    type="radio"
                    name="license_type"
                    value="remix_only"
                    checked={formData.license_type === 'remix_only'}
                    onChange={(e) => handleInputChange('license_type', e.target.value as 'remix_only' | 'remix_external' | 'custom')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <p className="text-white font-medium">Remix Only</p>
                    <p className="text-gray-400 text-sm">Can only use in mixmi mixer (default, protects your track)</p>
                  </div>
                </label>
                
                <label className="flex items-start p-4 border-2 border-slate-700 rounded-lg cursor-pointer hover:border-accent transition-colors">
                  <input
                    type="radio"
                    name="license_type"
                    value="remix_external"
                    checked={formData.license_type === 'remix_external'}
                    onChange={(e) => handleInputChange('license_type', e.target.value as 'remix_only' | 'remix_external' | 'custom')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <p className="text-white font-medium">Remix + External Use</p>
                    <p className="text-gray-400 text-sm">Can use outside platform for commercial projects</p>
                  </div>
                </label>
                
                <label className="flex items-start p-4 border-2 border-slate-700 rounded-lg cursor-pointer hover:border-accent transition-colors">
                  <input
                    type="radio"
                    name="license_type"
                    value="custom"
                    checked={formData.license_type === 'custom'}
                    onChange={(e) => handleInputChange('license_type', e.target.value as 'remix_only' | 'remix_external' | 'custom')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <p className="text-white font-medium">Custom</p>
                    <p className="text-gray-400 text-sm">Contact for specific licensing terms</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-white mb-4">Permissions</h3>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-slate-800 rounded-lg cursor-pointer">
                  <div>
                    <p className="text-white font-medium">Others can remix this track</p>
                    <p className="text-gray-400 text-sm">Enables the standard 80/20 split for remixes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.allow_remixing}
                    onChange={(e) => handleInputChange('allow_remixing', e.target.checked)}
                    className="w-5 h-5 text-accent bg-slate-700 border-slate-600 rounded focus:ring-accent focus:ring-2"
                  />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-slate-800 rounded-lg cursor-pointer">
                  <div>
                    <p className="text-white font-medium">Open to direct collaboration</p>
                    <p className="text-gray-400 text-sm">People can contact you about working together</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.open_to_collaboration}
                    onChange={(e) => handleInputChange('open_to_collaboration', e.target.checked)}
                    className="w-5 h-5 text-accent bg-slate-700 border-slate-600 rounded focus:ring-accent focus:ring-2"
                  />
                </label>
              </div>
            </div>

            {/* Terms agreement is handled at platform level */}
          </div>
        );

      case 7: // Review & Submit
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white mb-4">Review & Submit</h3>
            
            <div className="space-y-4">
              {/* Track Information */}
              <div className="bg-slate-800 p-4 rounded-md space-y-3">
                <h4 className="font-medium text-accent">Track Information</h4>
                
                <div>
                  <p className="text-sm font-medium text-gray-300">Title:</p>
                  <p className="text-white">{formData.title || 'Not specified'}</p>
                </div>
                
                {formData.version && (
                  <div>
                    <p className="text-sm font-medium text-gray-300">Version:</p>
                    <p className="text-white">{formData.version}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm font-medium text-gray-300">Artist:</p>
                  <p className="text-white">{formData.artist || 'Not specified'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-300">Content Type:</p>
                  <p className="text-white">
                    {formData.content_type === 'full_song' ? 'Full Song' : 'Loop'}
                    {formData.content_type === 'loop' && formData.loop_category && 
                      ` - ${formData.loop_category.charAt(0).toUpperCase() + formData.loop_category.slice(1).replace('_', ' ')}`
                    }
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-300">Price:</p>
                  <p className="text-white">{formData.price_stx} STX</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-300">Availability:</p>
                  <p className="text-white">Unlimited</p>
                </div>
                
                {formData.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-300">Tags:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formData.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Attribution */}
              <div className="bg-slate-800 p-4 rounded-md space-y-3">
                <h4 className="font-medium text-accent">Attribution & Rights</h4>
                
                <div>
                  <p className="text-sm font-medium text-gray-300">Composition Attribution:</p>
                  <p className="text-white">
                    {formData.composition_split_1_percentage}% + {formData.composition_split_2_percentage}% + {formData.composition_split_3_percentage}% = {(formData.composition_split_1_percentage + formData.composition_split_2_percentage + formData.composition_split_3_percentage).toFixed(2)}%
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-300">Production Attribution:</p>
                  <p className="text-white">
                    {formData.production_split_1_percentage}% + {formData.production_split_2_percentage}% + {formData.production_split_3_percentage}% = {(formData.production_split_1_percentage + formData.production_split_2_percentage + formData.production_split_3_percentage).toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Licensing & Permissions */}
              <div className="bg-slate-800 p-4 rounded-md space-y-3">
                <h4 className="font-medium text-accent">Licensing & Permissions</h4>
                
                <div>
                  <p className="text-sm font-medium text-gray-300">License Type:</p>
                  <p className="text-white">
                    {formData.license_type === 'remix_only' && 'Remix Only'}
                    {formData.license_type === 'remix_external' && 'Remix + External Use'}
                    {formData.license_type === 'custom' && 'Custom'}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className={`flex items-center ${formData.allow_remixing ? 'text-green-400' : 'text-gray-400'}`}>
                    <span className="mr-2">{formData.allow_remixing ? '✓' : '✗'}</span>
                    Others can remix this track
                  </div>
                  <div className={`flex items-center ${formData.open_to_collaboration ? 'text-green-400' : 'text-gray-400'}`}>
                    <span className="mr-2">{formData.open_to_collaboration ? '✓' : '✗'}</span>
                    Open to collaboration
                  </div>
                  <div className="flex items-center text-green-400">
                    <span className="mr-2">✓</span>
                    Terms & Conditions (Platform Level)
                  </div>
                </div>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-red-900/20 border border-red-700 p-3 rounded-md">
                <h4 className="text-red-400 font-medium mb-2">Validation Errors:</h4>
                <ul className="text-red-300 text-sm space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={track ? "Edit Your Track" : "Add Your Track"}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Upload Mode Toggle - only show for new tracks */}
        {!track && (
          <div className="flex items-center justify-center mb-4">
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => handleModeToggle(true)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isQuickUpload
                    ? 'bg-accent text-slate-900 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Upload
              </button>
              <button
                type="button"
                onClick={() => handleModeToggle(false)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  !isQuickUpload
                    ? 'bg-accent text-slate-900 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Advanced Options
              </button>
            </div>
          </div>
        )}

        {/* Mode Description */}
        {!track && (
          <div className="text-center mb-4">
            {isQuickUpload ? (
              <div className="bg-gradient-to-r from-accent/10 to-accent/5 p-3 rounded-lg border border-accent/20">
                <p className="text-sm text-gray-300">
                  <span className="text-accent font-medium">⚡ Quick Upload:</span> Perfect for solo creators. 
                  Smart defaults for pricing, licensing, and attribution.
                </p>
              </div>
            ) : (
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <p className="text-sm text-gray-300">
                  <span className="text-white font-medium">⚙️ Advanced Options:</span> Full control over pricing, 
                  attribution splits, licensing, and collaboration settings.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {getSteps().map((step, index) => (
            <div
              key={index}
              className={`flex items-center ${index < getSteps().length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index === currentStep
                    ? 'bg-accent text-slate-900'
                    : index < currentStep
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-gray-400'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < getSteps().length - 1 && (
                <div className={`flex-1 h-px mx-2 ${index < currentStep ? 'bg-green-600' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <h3 className="text-lg font-medium text-white">{getSteps()[currentStep]}</h3>
          {currentStep === 0 && (
            <p className="text-gray-400 text-sm mt-1">
              {isQuickUpload 
                ? "Essential info with smart defaults applied automatically"
                : "Tell us about your music and who made it"
              }
            </p>
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.348 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h4 className="text-red-400 font-medium">Please fix these issues:</h4>
            </div>
            <ul className="text-red-300 text-sm space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-slate-700">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
          >
            Previous
          </button>

          {currentStep === getSteps().length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-6 py-2 bg-accent text-slate-900 rounded-md font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : (track ? 'Update Track' : 'Create Track')}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="px-4 py-2 bg-accent text-slate-900 rounded-md font-medium hover:bg-accent/90 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
} 
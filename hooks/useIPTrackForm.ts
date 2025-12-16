import { useState, useEffect } from 'react';
import { IPTrack, ContentType, ValidationResult, IPTrackSplitPreset } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface IPTrackFormData {
  id: string;
  title: string;
  version: string;
  artist: string;
  description: string;
  tell_us_more: string;
  tags: string[];
  notes: string;
  content_type: ContentType;
  loop_category: string;
  sample_type: string;
  bpm: number;
  key: string;
  isrc: string;
  duration?: number;
  
  // Wallet address for this content
  wallet_address: string;
  
  // Location fields
  location_lat?: number;
  location_lng?: number;
  primary_location?: string;
  
  // Composition splits
  composition_split_1_wallet: string;
  composition_split_1_percentage: number;
  composition_split_2_wallet: string;
  composition_split_2_percentage: number;
  composition_split_3_wallet: string;
  composition_split_3_percentage: number;
  
  // Production splits
  production_split_1_wallet: string;
  production_split_1_percentage: number;
  production_split_2_wallet: string;
  production_split_2_percentage: number;
  production_split_3_wallet: string;
  production_split_3_percentage: number;
  
  // Media
  cover_image_url: string;
  audio_url: string;
  
  // Licensing and permissions
  license_type: 'remix_only' | 'remix_external' | 'custom';
  license_selection: 'platform_remix' | 'platform_download';
  allow_remixing: boolean;
  allow_downloads: boolean;
  allow_streaming: boolean;
  open_to_commercial: boolean;
  open_to_collaboration: boolean;

  // AI Assistance tracking
  ai_assisted_idea: boolean;
  ai_assisted_implementation: boolean;

  // Audio source tracking (for video clips)
  audio_source: 'included' | 'silent' | 'separate';

  // Pricing
  price_stx: number;
  remix_price: number;
  combined_price: number;
  download_price: number;
  download_price_stx: number | null;  // Used by SimplifiedLicensingStep for songs/loops
  price_per_song?: number;  // For EPs
  price_per_loop?: number;  // For loop packs
  
  // Contact info for commercial and collaboration
  commercial_contact: string;
  commercial_contact_fee: number;
  collab_contact: string;
  collab_contact_fee: number;
  
  // TEMPORARY: For database cleanup re-registration only
  uploader_wallet_override?: string;
}

interface UseIPTrackFormProps {
  track?: IPTrack;
  walletAddress?: string;
}

interface UseIPTrackFormReturn {
  formData: IPTrackFormData;
  validationErrors: string[];
  currentStep: number;
  isQuickUpload: boolean;
  tagInputValue: string;
  setFormData: React.Dispatch<React.SetStateAction<IPTrackFormData>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setIsQuickUpload: React.Dispatch<React.SetStateAction<boolean>>;
  setTagInputValue: React.Dispatch<React.SetStateAction<string>>;
  handleInputChange: (field: keyof IPTrackFormData, value: any) => void;
  handleTagsChange: (tagString: string) => void;
  handleModeToggle: (quickMode: boolean) => void;
  validateSplits: (splitType: 'composition' | 'production') => ValidationResult;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  getSteps: () => string[];
  resetForm: () => void;
  handleLoadPreset: (preset: IPTrackSplitPreset) => void;
}

const STEPS = [
  'Basic Information',
  'Who wrote it?',
  'Who made it?',
  'Connect to Release (Optional)',
  'File Uploads',
  'Licensing & Pricing',
  'Review & Submit'
];

const QUICK_STEPS = [
  'Basic Information',
  'File Uploads',
  'Licensing & Pricing',
  'Review & Submit'
];

export function useIPTrackForm({ track, walletAddress }: UseIPTrackFormProps): UseIPTrackFormReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // Default to Advanced mode when editing existing track to preserve IP splits and metadata
  const [isQuickUpload, setIsQuickUpload] = useState(!track);
  // Initialize tag input value with existing non-location tags when editing
  const [tagInputValue, setTagInputValue] = useState(() => {
    if (track?.tags && Array.isArray(track.tags)) {
      // Filter out location tags (🌍) since they're displayed separately
      return track.tags.filter(tag => !tag.startsWith('🌍')).join(', ');
    }
    return '';
  });

  const [formData, setFormData] = useState<IPTrackFormData>({
    id: track?.id || uuidv4(),
    title: track?.title || '',
    version: track?.version || '',
    artist: track?.artist || '',
    description: track?.description || '',
    tell_us_more: track?.tell_us_more || '',
    tags: track?.tags || [],
    notes: (track as any)?.notes || '',
    content_type: track?.content_type || 'loop',
    loop_category: track?.loop_category || 'instrumental',
    sample_type: track?.sample_type || 'FULL SONGS',
    bpm: track?.bpm || 0,
    key: track?.key || '',
    isrc: track?.isrc_number || '',
    duration: track?.duration || undefined,
    
    // Wallet address for this content (use primary_uploader_wallet when editing)
    wallet_address: track?.primary_uploader_wallet || (track as any)?.wallet_address || walletAddress || '',
    
    // Composition splits
    composition_split_1_wallet: track?.composition_split_1_wallet || walletAddress || '',
    composition_split_1_percentage: track?.composition_split_1_percentage || 100,
    composition_split_2_wallet: track?.composition_split_2_wallet || '',
    composition_split_2_percentage: track?.composition_split_2_percentage || 0,
    composition_split_3_wallet: track?.composition_split_3_wallet || '',
    composition_split_3_percentage: track?.composition_split_3_percentage || 0,
    
    // Production splits
    production_split_1_wallet: track?.production_split_1_wallet || walletAddress || '',
    production_split_1_percentage: track?.production_split_1_percentage || 100,
    production_split_2_wallet: track?.production_split_2_wallet || '',
    production_split_2_percentage: track?.production_split_2_percentage || 0,
    production_split_3_wallet: track?.production_split_3_wallet || '',
    production_split_3_percentage: track?.production_split_3_percentage || 0,
    
    // Media
    cover_image_url: track?.cover_image_url || '',
    audio_url: track?.audio_url || '',
    video_url: (track as any)?.video_url || '',

    // Video crop data (for video clips)
    video_crop_x: (track as any)?.video_crop_x,
    video_crop_y: (track as any)?.video_crop_y,
    video_crop_width: (track as any)?.video_crop_width,
    video_crop_height: (track as any)?.video_crop_height,
    video_crop_zoom: (track as any)?.video_crop_zoom,
    video_natural_width: (track as any)?.video_natural_width,
    video_natural_height: (track as any)?.video_natural_height,

    // Location fields
    location_lat: track?.location_lat || undefined,
    location_lng: track?.location_lng || undefined,
    primary_location: track?.primary_location || '',
    
    // Licensing and permissions
    license_type: track?.license_type || 'remix_only',
    license_selection: (track as any)?.license_selection || 'platform_remix',
    allow_remixing: track?.allow_remixing ?? true,
    allow_downloads: (track as any)?.allow_downloads ?? false,
    allow_streaming: (track as any)?.allow_streaming ?? true,
    open_to_commercial: (track as any)?.open_to_commercial ?? false,
    open_to_collaboration: track?.open_to_collaboration ?? false,

    // AI Assistance tracking
    ai_assisted_idea: track?.ai_assisted_idea ?? false,
    ai_assisted_implementation: track?.ai_assisted_implementation ?? false,

    // Audio source tracking (for video clips)
    audio_source: (track as any)?.audio_source || 'included',

    // Pricing - use download_price_stx from database (the actual column name)
    // For songs: price_stx is the download price
    // For loops: download_price_stx is the per-item price, price_stx is the total (for packs)
    price_stx: track?.price_stx || 0,
    remix_price: (track as any)?.remix_price || 0.5,
    combined_price: (track as any)?.combined_price || 2.5,
    // IMPORTANT: Fall back to price_stx for songs/EPs that only have price_stx set
    download_price: (track as any)?.download_price_stx || (track as any)?.download_price || track?.price_stx || 2.5,
    // download_price_stx is used directly by SimplifiedLicensingStep for songs/loops
    download_price_stx: (track as any)?.download_price_stx ?? track?.price_stx ?? null,
    // price_per_song/loop are calculated from total for EPs/packs (handled in IPTrackModal)
    
    // Contact info
    commercial_contact: (track as any)?.commercial_contact || '',
    commercial_contact_fee: (track as any)?.commercial_contact_fee || 10,
    collab_contact: (track as any)?.collab_contact || '',
    collab_contact_fee: (track as any)?.collab_contact_fee || 1,
    
    // TEMPORARY: For database cleanup re-registration only
    uploader_wallet_override: undefined,
  });

  // Update wallets when walletAddress changes
  useEffect(() => {
    if (walletAddress && !track) {
      setFormData(prev => ({
        ...prev,
        composition_split_1_wallet: prev.composition_split_1_wallet || walletAddress,
        production_split_1_wallet: prev.production_split_1_wallet || walletAddress,
      }));
    }
  }, [walletAddress, track]);

  // Handle content type change
  useEffect(() => {
    if (formData.content_type === 'full_song') {
      setFormData(prev => ({
        ...prev,
        sample_type: 'FULL SONGS',
        loop_category: '',
        // CRITICAL FIX: Songs should have download licensing, not remix-only
        license_selection: 'platform_download',
        license_type: 'remix_external'
      }));
    } else if (formData.content_type === 'loop') {
      setFormData(prev => ({
        ...prev,
        sample_type: 'instrumentals',
        loop_category: prev.loop_category || 'instrumental',
        // Loops keep remix-only licensing
        license_selection: 'platform_remix',
        license_type: 'remix_only'
      }));
    }
  }, [formData.content_type]);

  // Update splits when wallet_address field changes (after alpha code conversion)
  useEffect(() => {
    if (formData.wallet_address && 
        (formData.composition_split_1_wallet !== formData.wallet_address ||
         formData.production_split_1_wallet !== formData.wallet_address) &&
        formData.composition_split_1_percentage === 100 &&
        formData.production_split_1_percentage === 100) {
      // Update both composition and production splits to use converted wallet address
      setFormData(prev => ({
        ...prev,
        composition_split_1_wallet: formData.wallet_address,
        production_split_1_wallet: formData.wallet_address
      }));
      console.log('🔄 Updated splits to use converted wallet (Quick Upload):', formData.wallet_address);
    }
  }, [formData.wallet_address]);

  const handleModeToggle = (quickMode: boolean) => {
    setIsQuickUpload(quickMode);
    if (quickMode) {
      // Set 100% ownership for quick mode using form wallet (not auth wallet)
      const targetWallet = formData.wallet_address || walletAddress || '';
      setFormData(prev => ({
        ...prev,
        composition_split_1_wallet: targetWallet,
        composition_split_1_percentage: 100,
        composition_split_2_wallet: '',
        composition_split_2_percentage: 0,
        composition_split_3_wallet: '',
        composition_split_3_percentage: 0,
        production_split_1_wallet: targetWallet,
        production_split_1_percentage: 100,
        production_split_2_wallet: '',
        production_split_2_percentage: 0,
        production_split_3_wallet: '',
        production_split_3_percentage: 0,
      }));
    }
    setCurrentStep(0);
  };

  const validateSplits = (splitType: 'composition' | 'production'): ValidationResult => {
    const errors: string[] = [];
    const prefix = splitType === 'composition' ? 'composition' : 'production';
    const displayName = splitType === 'composition' ? 'Composition' : 'Production';

    // Get split values
    // Note: "wallet" fields can contain names OR wallet addresses (flexible for collaborators)
    const split1Wallet = formData[`${prefix}_split_1_wallet` as keyof IPTrackFormData] as string;
    const split1Percentage = formData[`${prefix}_split_1_percentage` as keyof IPTrackFormData] as number;
    const split2Wallet = formData[`${prefix}_split_2_wallet` as keyof IPTrackFormData] as string;
    const split2Percentage = formData[`${prefix}_split_2_percentage` as keyof IPTrackFormData] as number;
    const split3Wallet = formData[`${prefix}_split_3_wallet` as keyof IPTrackFormData] as string;
    const split3Percentage = formData[`${prefix}_split_3_percentage` as keyof IPTrackFormData] as number;

    // Check total percentage
    const totalPercentage = split1Percentage + split2Percentage + split3Percentage;
    if (totalPercentage !== 100) {
      errors.push(`${displayName} split percentages must total 100% (currently ${totalPercentage}%)`);
    }

    // Check for empty identifiers with percentages
    // For Split 1: Auto-fill with uploader wallet if missing but percentage > 0
    if (split1Percentage > 0 && !split1Wallet) {
      const effectiveWallet = formData.wallet_address || walletAddress;
      if (effectiveWallet) {
        // Auto-fix: set the wallet to the uploader wallet
        const fieldPrefix = splitType === 'composition' ? 'composition' : 'production';
        setFormData(prev => ({
          ...prev,
          [`${fieldPrefix}_split_1_wallet`]: effectiveWallet
        }));
      } else {
        errors.push(`${displayName} Split 1: Name or wallet address required when percentage is set`);
      }
    }
    // For splits 2 and 3, accept any non-empty string (name or wallet)
    if (split2Percentage > 0 && !split2Wallet) {
      errors.push(`${displayName} Split 2: Name or wallet address required when percentage is set`);
    }
    if (split3Percentage > 0 && !split3Wallet) {
      errors.push(`${displayName} Split 3: Name or wallet address required when percentage is set`);
    }

    // Check for identifiers without percentages
    if (split2Wallet && split2Percentage === 0) {
      errors.push(`${displayName} Split 2: Percentage required when collaborator is set`);
    }
    if (split3Wallet && split3Percentage === 0) {
      errors.push(`${displayName} Split 3: Percentage required when collaborator is set`);
    }

    return { isValid: errors.length === 0, errors };
  };

  const handleInputChange = (field: keyof IPTrackFormData, value: any) => {
    setFormData(prev => {
      // Special handling for BPM - always round to integer
      let finalValue = value;
      if (field === 'bpm' && value) {
        finalValue = Math.round(value);
        console.log(`🎵 BPM handling in form: ${value} -> ${finalValue}`);
      }
      
      const updated = { ...prev, [field]: finalValue };
      
      // Auto-calculate splits when wallets are added/removed
      if (field.includes('_wallet') && field.includes('_split_')) {
        const splitType = field.includes('composition') ? 'composition' : 'production';
        
        // Count non-empty wallets
        let walletCount = 0;
        for (let i = 1; i <= 3; i++) {
          const walletField = `${splitType}_split_${i}_wallet` as keyof IPTrackFormData;
          const walletValue = i.toString() === field.match(/_(\d)_wallet/)?.[1] 
            ? value 
            : updated[walletField];
          if (walletValue && String(walletValue).trim()) {
            walletCount++;
          }
        }
        
        // Calculate equal splits
        if (walletCount > 0) {
          const basePercentage = Math.floor(100 / walletCount);
          const remainder = 100 - (basePercentage * walletCount);
          
          let remainderAssigned = 0;
          for (let i = 1; i <= 3; i++) {
            const walletField = `${splitType}_split_${i}_wallet` as keyof IPTrackFormData;
            const percentField = `${splitType}_split_${i}_percentage` as keyof IPTrackFormData;
            const walletValue = i.toString() === field.match(/_(\d)_wallet/)?.[1] 
              ? value 
              : updated[walletField];
            
            if (walletValue && String(walletValue).trim()) {
              // Give the remainder to the first contributors
              updated[percentField] = basePercentage + (remainderAssigned < remainder ? 1 : 0);
              remainderAssigned++;
            } else {
              updated[percentField] = 0;
            }
          }
        }
      }
      
      return updated;
    });
    
    // Clear validation errors when user makes changes
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleLoadPreset = (preset: IPTrackSplitPreset) => {
    setFormData(prev => ({
      ...prev,
      ...preset.splits
    }));
  };

  const handleTagsChange = (tagString: string) => {
    // Parse new tags from the text input
    const newNonLocationTags = tagString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    // Preserve existing location tags (🌍) - they're managed separately
    const existingLocationTags = formData.tags.filter(tag => tag.startsWith('🌍'));

    // Combine: new non-location tags + existing location tags
    const combinedTags = [...newNonLocationTags, ...existingLocationTags];

    handleInputChange('tags', combinedTags);
    setTagInputValue(tagString);
  };

  const getSteps = () => isQuickUpload ? QUICK_STEPS : STEPS;

  const goToStep = (step: number) => {
    if (step >= 0 && step < getSteps().length) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < getSteps().length - 1) {
      let nextStepIndex = currentStep + 1;

      // Skip Step 4 (Connect to Release) for video clips in Advanced mode
      // Step 4 is at index 3 in STEPS array
      if (!isQuickUpload && formData.content_type === 'video_clip' && nextStepIndex === 3) {
        nextStepIndex = 4; // Jump to Step 5 (File Uploads)
      }

      setCurrentStep(nextStepIndex);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      let prevStepIndex = currentStep - 1;

      // Skip Step 4 (Connect to Release) for video clips in Advanced mode when going backwards
      // Step 4 is at index 3 in STEPS array
      if (!isQuickUpload && formData.content_type === 'video_clip' && prevStepIndex === 3) {
        prevStepIndex = 2; // Jump back to Step 3 (Who made it?)
      }

      setCurrentStep(prevStepIndex);
    }
  };

  const resetForm = () => {
    setFormData({
      id: uuidv4(),
      title: '',
      version: '',
      artist: '',
      description: '',
      tell_us_more: '',
      tags: [],
      notes: '',
      content_type: 'loop',
      loop_category: 'instrumental',
      sample_type: 'FULL SONGS',
      bpm: 0,
      key: '',
      isrc: '',
      wallet_address: walletAddress || '',
      composition_split_1_wallet: walletAddress || '',
      composition_split_1_percentage: 100,
      composition_split_2_wallet: '',
      composition_split_2_percentage: 0,
      composition_split_3_wallet: '',
      composition_split_3_percentage: 0,
      production_split_1_wallet: walletAddress || '',
      production_split_1_percentage: 100,
      production_split_2_wallet: '',
      production_split_2_percentage: 0,
      production_split_3_wallet: '',
      production_split_3_percentage: 0,
      cover_image_url: '',
      audio_url: '',
      license_type: 'remix_only',
      license_selection: 'platform_remix',
      allow_remixing: true,
      allow_downloads: false,
      allow_streaming: true,
      open_to_commercial: false,
      open_to_collaboration: false,
      price_stx: 2.5,
      remix_price: 0.5,
      combined_price: 2.5,
      download_price: 2.5,
      download_price_stx: null,
      commercial_contact: '',
      commercial_contact_fee: 10,
      collab_contact: '',
      collab_contact_fee: 1,
    });
    setValidationErrors([]);
    setCurrentStep(0);
    setTagInputValue('');
  };

  return {
    formData,
    validationErrors,
    currentStep,
    isQuickUpload,
    tagInputValue,
    setFormData,
    setValidationErrors,
    setCurrentStep,
    setIsQuickUpload,
    setTagInputValue,
    handleInputChange,
    handleTagsChange,
    handleModeToggle,
    validateSplits,
    nextStep,
    prevStep,
    goToStep,
    getSteps,
    resetForm,
    handleLoadPreset,
  };
}
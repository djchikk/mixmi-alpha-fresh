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
  open_to_commercial: boolean;
  open_to_collaboration: boolean;
  
  // Pricing
  price_stx: number;
  remix_price: number;
  combined_price: number;
  download_price: number;
  
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
  'Who recorded it?',
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
  const [isQuickUpload, setIsQuickUpload] = useState(true);
  const [tagInputValue, setTagInputValue] = useState('');

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
    
    // Wallet address for this content
    wallet_address: (track as any)?.wallet_address || walletAddress || '',
    
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
    
    // Location fields
    location_lat: track?.location_lat || undefined,
    location_lng: track?.location_lng || undefined,
    primary_location: track?.primary_location || '',
    
    // Licensing and permissions
    license_type: track?.license_type || 'remix_only',
    license_selection: (track as any)?.license_selection || 'platform_remix',
    allow_remixing: track?.allow_remixing ?? true,
    allow_downloads: (track as any)?.allow_downloads ?? false,
    open_to_commercial: (track as any)?.open_to_commercial ?? false,
    open_to_collaboration: track?.open_to_collaboration ?? false,
    
    // Pricing
    price_stx: track?.price_stx || 0,
    remix_price: (track as any)?.remix_price || 0.5,
    combined_price: (track as any)?.combined_price || 2.5,
    download_price: (track as any)?.download_price || 2.5,
    
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
        loop_category: ''
      }));
    } else if (formData.content_type === 'loop') {
      setFormData(prev => ({
        ...prev,
        sample_type: 'instrumentals',
        loop_category: prev.loop_category || 'instrumental'
      }));
    }
  }, [formData.content_type]);

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
    
    // Check for empty wallets with percentages
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
        errors.push(`${displayName} Split 1: Wallet address required when percentage is set`);
      }
    }
    if (split2Percentage > 0 && !split2Wallet) {
      errors.push(`${displayName} Split 2: Wallet address required when percentage is set`);
    }
    if (split3Percentage > 0 && !split3Wallet) {
      errors.push(`${displayName} Split 3: Wallet address required when percentage is set`);
    }
    
    // Check for wallets without percentages
    if (split2Wallet && split2Percentage === 0) {
      errors.push(`${displayName} Split 2: Percentage required when wallet is set`);
    }
    if (split3Wallet && split3Percentage === 0) {
      errors.push(`${displayName} Split 3: Percentage required when wallet is set`);
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
    const tagsArray = tagString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    handleInputChange('tags', tagsArray);
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
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
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
      open_to_commercial: false,
      open_to_collaboration: false,
      price_stx: 2.5,
      remix_price: 0.5,
      combined_price: 2.5,
      download_price: 2.5,
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
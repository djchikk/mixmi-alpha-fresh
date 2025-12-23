import { useState, useEffect } from 'react';
import { IPTrackSplitPreset } from '@/types';
import { SplitPresetManager } from '@/lib/splitPresets';

interface UseSplitPresetsProps {
  walletAddress?: string;
}

interface UseSplitPresetsReturn {
  presets: IPTrackSplitPreset[];
  isLoadingPresets: boolean;
  handleSavePreset: (presetData: Omit<IPTrackSplitPreset, 'id' | 'created_at'>) => void;
  handleDeletePreset: (presetId: string) => void;
  refreshPresets: () => void;
}

export function useSplitPresets({ walletAddress }: UseSplitPresetsProps): UseSplitPresetsReturn {
  const [presets, setPresets] = useState<IPTrackSplitPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      loadPresets();
    }
  }, [walletAddress]);

  const loadPresets = async () => {
    if (!walletAddress) return;
    
    setIsLoadingPresets(true);
    try {
      const loadedPresets = await SplitPresetManager.loadPresets(walletAddress);
      setPresets(loadedPresets);
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setIsLoadingPresets(false);
    }
  };

  const handleSavePreset = async (presetData: Omit<IPTrackSplitPreset, 'id' | 'created_at'>) => {
    if (!walletAddress) return;
    
    try {
      const newPreset = await SplitPresetManager.savePreset(walletAddress, presetData);
      setPresets(prev => [...prev, newPreset]);
      console.log('✅ Preset saved successfully');
    } catch (error) {
      console.error('Failed to save preset:', error);
      throw error;
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!walletAddress) return;
    
    try {
      await SplitPresetManager.deletePreset(walletAddress, presetId);
      setPresets(prev => prev.filter(p => p.id !== presetId));
      console.log('✅ Preset deleted successfully');
    } catch (error) {
      console.error('Failed to delete preset:', error);
      throw error;
    }
  };

  const refreshPresets = () => {
    loadPresets();
  };

  return {
    presets,
    isLoadingPresets,
    handleSavePreset,
    handleDeletePreset,
    refreshPresets,
  };
}
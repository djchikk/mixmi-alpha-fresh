import { IPTrackSplitPreset } from '@/types';

const STORAGE_KEY = 'mixmi_split_presets';
const MAX_PRESETS = 3; // Limit to 3 presets per user

export class SplitPresetManager {
  private static getStorageKey(walletAddress: string): string {
    return `${STORAGE_KEY}_${walletAddress}`;
  }

  // Load all presets for a user
  static loadPresets(walletAddress: string): IPTrackSplitPreset[] {
    try {
      const key = this.getStorageKey(walletAddress);
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      
      const presets = JSON.parse(stored) as IPTrackSplitPreset[];
      return presets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      console.error('Error loading presets:', error);
      return [];
    }
  }

  // Save a new preset
  static savePreset(walletAddress: string, preset: Omit<IPTrackSplitPreset, 'id' | 'created_at'>): IPTrackSplitPreset {
    const existingPresets = this.loadPresets(walletAddress);
    
    const newPreset: IPTrackSplitPreset = {
      ...preset,
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    };

    // Remove oldest if we're at max capacity
    let updatedPresets = [newPreset, ...existingPresets];
    if (updatedPresets.length > MAX_PRESETS) {
      updatedPresets = updatedPresets.slice(0, MAX_PRESETS);
    }

    try {
      const key = this.getStorageKey(walletAddress);
      localStorage.setItem(key, JSON.stringify(updatedPresets));
      return newPreset;
    } catch (error) {
      console.error('Error saving preset:', error);
      throw error;
    }
  }

  // Delete a preset
  static deletePreset(walletAddress: string, presetId: string): boolean {
    try {
      const existingPresets = this.loadPresets(walletAddress);
      const filtered = existingPresets.filter(p => p.id !== presetId);
      
      const key = this.getStorageKey(walletAddress);
      localStorage.setItem(key, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting preset:', error);
      return false;
    }
  }

  // Update an existing preset
  static updatePreset(walletAddress: string, presetId: string, updates: Partial<IPTrackSplitPreset>): IPTrackSplitPreset | null {
    try {
      const existingPresets = this.loadPresets(walletAddress);
      const presetIndex = existingPresets.findIndex(p => p.id === presetId);
      
      if (presetIndex === -1) return null;

      const updatedPreset = {
        ...existingPresets[presetIndex],
        ...updates,
        id: presetId, // Don't allow ID changes
        created_at: existingPresets[presetIndex].created_at, // Don't change creation date
      };

      existingPresets[presetIndex] = updatedPreset;

      const key = this.getStorageKey(walletAddress);
      localStorage.setItem(key, JSON.stringify(existingPresets));
      return updatedPreset;
    } catch (error) {
      console.error('Error updating preset:', error);
      return null;
    }
  }

  // Extract preset data from form data
  static extractPresetFromForm(formData: any): Omit<IPTrackSplitPreset, 'id' | 'created_at'> {
    return {
      name: '', // Will be set by user
      description: '',
      composition_split_1_wallet: formData.composition_split_1_wallet || '',
      composition_split_1_percentage: formData.composition_split_1_percentage || 0,
      composition_split_2_wallet: formData.composition_split_2_wallet || '',
      composition_split_2_percentage: formData.composition_split_2_percentage || 0,
      composition_split_3_wallet: formData.composition_split_3_wallet || '',
      composition_split_3_percentage: formData.composition_split_3_percentage || 0,
      production_split_1_wallet: formData.production_split_1_wallet || '',
      production_split_1_percentage: formData.production_split_1_percentage || 0,
      production_split_2_wallet: formData.production_split_2_wallet || '',
      production_split_2_percentage: formData.production_split_2_percentage || 0,
      production_split_3_wallet: formData.production_split_3_wallet || '',
      production_split_3_percentage: formData.production_split_3_percentage || 0,
      default_content_type: formData.content_type,
      default_loop_category: formData.loop_category,
    };
  }

  // Apply preset to form data
  static applyPresetToForm(preset: IPTrackSplitPreset, currentFormData: any): any {
    return {
      ...currentFormData,
      composition_split_1_wallet: preset.composition_split_1_wallet,
      composition_split_1_percentage: preset.composition_split_1_percentage,
      composition_split_2_wallet: preset.composition_split_2_wallet,
      composition_split_2_percentage: preset.composition_split_2_percentage,
      composition_split_3_wallet: preset.composition_split_3_wallet,
      composition_split_3_percentage: preset.composition_split_3_percentage,
      production_split_1_wallet: preset.production_split_1_wallet,
      production_split_1_percentage: preset.production_split_1_percentage,
      production_split_2_wallet: preset.production_split_2_wallet,
      production_split_2_percentage: preset.production_split_2_percentage,
      production_split_3_wallet: preset.production_split_3_wallet,
      production_split_3_percentage: preset.production_split_3_percentage,
      ...(preset.default_content_type && { content_type: preset.default_content_type }),
      ...(preset.default_loop_category && { loop_category: preset.default_loop_category }),
    };
  }
} 
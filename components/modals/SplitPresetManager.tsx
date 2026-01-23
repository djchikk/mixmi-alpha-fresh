"use client";

import React, { useState, useEffect } from 'react';
import { IPTrackSplitPreset } from '@/types';
import { SplitPresetManager } from '@/lib/splitPresets';
import { useAuth } from '@/contexts/AuthContext';

interface SplitPresetManagerUIProps {
  presets: IPTrackSplitPreset[];
  onLoadPreset: (preset: IPTrackSplitPreset) => void;
  onSavePreset: (presetData: Omit<IPTrackSplitPreset, 'id' | 'created_at'>) => void;
  onDeletePreset: (presetId: string) => void;
  currentFormData: any;
}

interface SavePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  currentPresetData: Omit<IPTrackSplitPreset, 'id' | 'created_at'>;
}

function SavePresetModal({ isOpen, onClose, onSave, currentPresetData }: SavePresetModalProps) {
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPresetName('');
      setPresetDescription('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!presetName.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(presetName.trim(), presetDescription.trim());
      onClose();
    } catch (error) {
      console.error('Error saving preset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#101726] rounded-lg p-6 max-w-md w-full mx-4 border border-[#151C2A]">
        <h3 className="text-lg font-medium text-white mb-4">Save Split Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Preset Name*
            </label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., My Band, Producer Team"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder="Brief description of this configuration"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              rows={2}
              maxLength={200}
            />
          </div>

          {/* Preview of what will be saved */}
          <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700">
            <p className="text-xs text-gray-400 mb-2">This preset will save:</p>
            <div className="text-xs text-gray-300 space-y-1">
              <div>• Composition splits & percentages</div>
              <div>• Production splits & percentages</div>
              <div>• Content type & loop category defaults</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!presetName.trim() || isSaving}
            className="bg-accent hover:bg-accent/90 text-slate-900 font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Preset'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SplitPresetManagerUI({ presets, onLoadPreset, onSavePreset, onDeletePreset, currentFormData }: SplitPresetManagerUIProps) {
  const { walletAddress, suiAddress, activePersona } = useAuth();
  // Priority: active persona's wallet > persona's SUI > account SUI > account STX
  const effectiveAddress = activePersona?.sui_address || activePersona?.wallet_address || suiAddress || walletAddress;
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Handle loading a preset
  const handleLoadPreset = (preset: IPTrackSplitPreset) => {
    onLoadPreset(preset);
  };

  // Handle saving a preset
  const handleSavePreset = (name: string, description: string) => {
    if (!effectiveAddress) return;

    const presetData = SplitPresetManager.extractPresetFromForm(currentFormData);
    onSavePreset({ ...presetData, name, description });
  };

  // Handle deleting a preset
  const handleDeletePreset = (presetId: string) => {
    onDeletePreset(presetId);
  };

  // Check if current form has any split data worth saving
  const hasValidSplitData = () => {
    return (
      // Check if any wallet addresses are filled
      (currentFormData.composition_split_1_wallet && currentFormData.composition_split_1_wallet.trim().length > 0) || 
      (currentFormData.composition_split_2_wallet && currentFormData.composition_split_2_wallet.trim().length > 0) ||
      (currentFormData.composition_split_3_wallet && currentFormData.composition_split_3_wallet.trim().length > 0) ||
      (currentFormData.production_split_1_wallet && currentFormData.production_split_1_wallet.trim().length > 0) ||
      (currentFormData.production_split_2_wallet && currentFormData.production_split_2_wallet.trim().length > 0) ||
      (currentFormData.production_split_3_wallet && currentFormData.production_split_3_wallet.trim().length > 0) ||
      // Or if any non-zero percentages are set
      (currentFormData.composition_split_1_percentage && currentFormData.composition_split_1_percentage > 0) ||
      (currentFormData.production_split_1_percentage && currentFormData.production_split_1_percentage > 0)
    );
  };

  return (
    <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">Split Presets</h4>
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={!hasValidSplitData()}
          className="text-xs bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 px-3 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={hasValidSplitData() ? 'Save current split configuration' : 'Fill in some split data first'}
        >
          💾 Save Current
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">
          No presets yet. Fill in your splits and save your first preset!
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between bg-slate-900/50 rounded-md p-3 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h5 className="text-sm font-medium text-white truncate">{preset.name}</h5>
                  <span className="text-xs text-gray-400">
                    {new Date(preset.created_at).toLocaleDateString()}
                  </span>
                </div>
                {preset.description && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{preset.description}</p>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => handleLoadPreset(preset)}
                  className="text-xs bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 px-2 py-1 rounded-md transition-colors"
                  title="Load this preset"
                >
                  Load
                </button>
                <button
                  onClick={() => handleDeletePreset(preset.id)}
                  className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-2 py-1 rounded-md transition-colors"
                  title="Delete this preset"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SavePresetModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePreset}
        currentPresetData={SplitPresetManager.extractPresetFromForm(currentFormData)}
      />
    </div>
  );
} 
import { useState } from 'react';
import { detectBPMFromAudioFile, BPMDetectionResult } from '@/lib/bpmDetection';
import { SupabaseAuthBridge } from '@/lib/auth/supabase-auth-bridge';

interface AudioUploadProgress {
  stage: 'idle' | 'analyzing' | 'processing' | 'uploading' | 'finalizing' | 'complete';
  message: string;
  progress: number;
  fileSize?: string;
}

interface UseAudioUploadProps {
  walletAddress?: string;
  contentType: string;
  currentBPM: number;
  onBPMDetected: (bpm: number) => void;
  onAudioUploaded: (url: string) => void;
  onDurationDetected?: (duration: number) => void;
}

interface UseAudioUploadReturn {
  uploadedAudioFile: File | null;
  isAudioUploading: boolean;
  audioUploadProgress: AudioUploadProgress;
  bpmDetection: BPMDetectionResult | null;
  isDetectingBPM: boolean;
  audioInputType: 'url' | 'upload';
  setAudioInputType: React.Dispatch<React.SetStateAction<'url' | 'upload'>>;
  handleAudioFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  processAudioFile: (file: File) => Promise<void>;
  resetAudioUpload: () => void;
}

export function useAudioUpload({
  walletAddress,
  contentType,
  currentBPM,
  onBPMDetected,
  onAudioUploaded,
  onDurationDetected
}: UseAudioUploadProps): UseAudioUploadReturn {
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [isAudioUploading, setIsAudioUploading] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState<AudioUploadProgress>({
    stage: 'idle',
    message: '',
    progress: 0
  });
  const [bpmDetection, setBpmDetection] = useState<BPMDetectionResult | null>(null);
  const [isDetectingBPM, setIsDetectingBPM] = useState(false);
  const [audioInputType, setAudioInputType] = useState<'url' | 'upload'>('upload');

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Log the actual MIME type for debugging
    console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file type - include various m4a MIME types
    const allowedTypes = [
      'audio/mpeg', 
      'audio/wav', 
      'audio/flac', 
      'audio/mp4', 
      'audio/m4a', 
      'audio/x-m4a',  // Alternative m4a MIME type
      'audio/aac',     // AAC audio (often in m4a container)
      'audio/ogg',
      'application/octet-stream' // Sometimes m4a files are reported as this
    ];
    
    // Check by extension if MIME type is generic
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['mp3', 'wav', 'flac', 'mp4', 'm4a', 'aac', 'ogg'];
    
    if (!allowedTypes.includes(file.type) && 
        !(file.type === 'application/octet-stream' && allowedExtensions.includes(fileExtension || ''))) {
      console.error('Invalid file type:', file.type, 'Extension:', fileExtension);
      throw new Error('Please select a valid audio file (MP3, WAV, FLAC, M4A, OGG)');
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error('Audio file must be smaller than 50MB');
    }

    await processAudioFile(file);
  };

  const processAudioFile = async (file: File) => {
    try {
      setIsAudioUploading(true);
      
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      
      // Stage 1: Analyzing (includes BPM detection for loops)
      setAudioUploadProgress({
        stage: 'analyzing',
        message: `Analyzing audio file...`,
        progress: 15,
        fileSize: `${fileSizeMB}MB`
      });
      
      console.log(`🎵 Processing audio: ${file.name} (${fileSizeMB}MB)`);
      
      // Extract duration for all audio files
      let audioDuration: number | undefined;
      try {
        const audioUrl = URL.createObjectURL(file);
        const audio = new Audio(audioUrl);
        
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => {
            audioDuration = audio.duration;
            console.log(`🎵 Audio duration: ${audioDuration} seconds`);
            URL.revokeObjectURL(audioUrl);
            resolve();
          });
          audio.addEventListener('error', () => {
            URL.revokeObjectURL(audioUrl);
            reject(new Error('Failed to load audio metadata'));
          });
        });
        
        // Call the onDurationDetected callback if it exists
        if (onDurationDetected && audioDuration) {
          onDurationDetected(audioDuration);
        }
      } catch (error) {
        console.log('🎵 Duration extraction failed:', error);
      }
      
      // BPM Detection for loops
      let detectionResult: BPMDetectionResult | null = null;
      if (contentType === 'loop') {
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
          
          // Only set BPM if user hasn't manually entered one
          const hasManualBPM = currentBPM && currentBPM > 0;
          if (detectionResult.detected && detectionResult.bpm && !hasManualBPM) {
            onBPMDetected(detectionResult.bpm);
            console.log(`🎵 BPM auto-detected: ${detectionResult.bpm} (${detectionResult.confidence} confidence)`);
          } else if (hasManualBPM) {
            console.log(`🎵 BPM detection result: ${detectionResult.bpm}, but keeping manual input: ${currentBPM}`);
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
        // Allow BPM detection and processing without wallet, skip actual upload
        console.log('⏸️ Wallet address not provided - skipping upload, keeping file for later');
        setUploadedAudioFile(file);
        onAudioUploaded(''); // Empty URL - will be uploaded when wallet is provided
        setAudioUploadProgress({
          stage: 'complete',
          message: 'Audio processed - will upload when wallet address is provided',
          progress: 100,
          fileSize: fileSizeMB + 'MB'
        });
        return;
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
      onAudioUploaded(urlData.publicUrl);
      
      // Show success briefly, then reset
      setTimeout(() => {
        setAudioUploadProgress({ stage: 'idle', message: '', progress: 0 });
        setIsAudioUploading(false);
      }, 1500);
      
    } catch (error) {
      console.error('🚨 Audio upload failed:', error);
      setIsAudioUploading(false);
      setAudioUploadProgress({ stage: 'idle', message: '', progress: 0 });
      throw error;
    }
  };

  const resetAudioUpload = () => {
    setUploadedAudioFile(null);
    setIsAudioUploading(false);
    setAudioUploadProgress({ stage: 'idle', message: '', progress: 0 });
    setBpmDetection(null);
    setIsDetectingBPM(false);
  };

  return {
    uploadedAudioFile,
    isAudioUploading,
    audioUploadProgress,
    bpmDetection,
    isDetectingBPM,
    audioInputType,
    setAudioInputType,
    handleAudioFileUpload,
    processAudioFile,
    resetAudioUpload,
  };
}
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Mic, Upload, Music, Video, Loader2, CheckCircle, X, Globe, MapPin } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@supabase/supabase-js';
import { useLocationAutocomplete } from '@/hooks/useLocationAutocomplete';
import UploadPreviewCard from './UploadPreviewCard';
import DOMPurify from 'dompurify';

// Initialize Supabase client for thumbnail uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  inputMode?: 'voice' | 'text'; // Track how user sent message
}

interface FileAttachment {
  id: string;
  name: string;
  type: 'audio' | 'video' | 'image';
  file: File;
  url?: string; // After upload
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress?: number;
  duration?: number; // Detected duration in seconds
}

/**
 * Detect audio duration client-side using HTMLAudioElement.
 * Returns duration in seconds, or null if detection fails.
 */
function detectAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.src = '';
      audio.load();
    };

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();
      if (duration && isFinite(duration) && duration > 0) {
        resolve(Math.round(duration * 10) / 10); // Round to 1 decimal
      } else {
        resolve(null);
      }
    };

    audio.onerror = () => {
      cleanup();
      resolve(null);
    };

    // Timeout after 5 seconds
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    audio.src = objectUrl;
  });
}

/**
 * Detect video duration client-side using HTMLVideoElement.
 * Returns duration in seconds, or null if detection fails.
 */
function detectVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.src = '';
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (duration && isFinite(duration) && duration > 0) {
        resolve(Math.round(duration * 10) / 10);
      } else {
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    video.src = objectUrl;
  });
}

interface ExtractedTrackData {
  // Will be populated as conversation progresses
  content_type?: string;
  title?: string;
  artist?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  bpm?: number;
  key?: string;
  loop_category?: string;
  tell_us_more?: string;
  location?: string;
  additional_locations?: string[];
  ai_assisted_idea?: boolean;
  ai_assisted_implementation?: boolean;
  allow_downloads?: boolean;
  download_price_stx?: number;
  open_to_collaboration?: boolean;
  open_to_commercial?: boolean;
  // Contact access
  contact_email?: string;
  contact_fee_stx?: number;
  // Splits (ownership) - with persona matching support
  composition_splits?: Array<{
    wallet?: string;
    name?: string;
    username?: string;       // Persona username if matched
    percentage: number;
    create_persona?: boolean; // Auto-create managed persona at submit
  }>;
  production_splits?: Array<{
    wallet?: string;
    name?: string;
    username?: string;
    percentage: number;
    create_persona?: boolean;
  }>;
  // Credits (attribution - no ownership, just recognition)
  credits?: Array<{ name: string; role: string }>;
  // Files
  audio_url?: string;
  video_url?: string;
  cover_image_url?: string;
  // Thumbnail URLs (pre-generated at upload)
  thumb_64_url?: string;
  thumb_160_url?: string;
  thumb_256_url?: string;
  // Video crop data
  video_crop_x?: number;
  video_crop_y?: number;
  video_crop_width?: number;
  video_crop_height?: number;
  video_crop_zoom?: number;
  video_natural_width?: number;
  video_natural_height?: number;
  // For packs
  pack_title?: string;
  ep_title?: string;
  loop_files?: string[];
  ep_files?: string[];
  // Original filenames for track titles (parallel to loop_files/ep_files arrays)
  original_filenames?: string[];
  // Multi-file BPM tracking
  detected_bpms?: number[];
  // File metadata for content type intelligence
  file_durations?: number[]; // Duration of each uploaded file in seconds
}

interface ConversationalUploaderProps {
  walletAddress: string;
  personaId?: string;
}

export default function ConversationalUploader({ walletAddress, personaId }: ConversationalUploaderProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedTrackData>({});
  const [conversationId, setConversationId] = useState<string>('');
  // Persona matches from previous chat response (for collaborator matching)
  const [personaMatchesFromPrevious, setPersonaMatchesFromPrevious] = useState<any>(undefined);
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sessionStartTime] = useState<Date>(new Date()); // Track when session started
  const sessionLoggedRef = useRef(false); // Prevent double-logging

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0); // Track nested drag events

  // Track if we should show the welcome hero (before any user interaction)
  const [showWelcomeHero, setShowWelcomeHero] = useState(true);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastInputMode, setLastInputMode] = useState<'voice' | 'text'>('text');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // TTS playback state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Location autocomplete
  const [locationInput, setLocationInput] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const {
    suggestions: locationSuggestions,
    isLoading: isLoadingLocations,
    handleInputChange: handleLocationSearch,
    clearSuggestions: clearLocationSuggestions,
    cleanup: cleanupLocationSearch
  } = useLocationAutocomplete({ minCharacters: 2, limit: 5 });

  // Initialize conversation
  useEffect(() => {
    const newConversationId = crypto.randomUUID();
    setConversationId(newConversationId);
    // Don't add initial message - we'll show the hero instead
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup location search on unmount
  useEffect(() => {
    return () => cleanupLocationSearch();
  }, [cleanupLocationSearch]);

  // Auto-save draft periodically (every 30 seconds) when there's enough data
  const draftIdRef = useRef<string | null>(null);
  const lastDraftDataRef = useRef<string>('');

  useEffect(() => {
    const interval = setInterval(async () => {
      // Only save if we have at least one uploaded file
      const hasFile = extractedData.audio_url ||
                      extractedData.video_url ||
                      (extractedData.loop_files && extractedData.loop_files.length > 0);

      if (!hasFile || !conversationId || isSubmitting) return;

      // Only save if data has changed since last save
      const dataSnapshot = JSON.stringify(extractedData);
      if (dataSnapshot === lastDraftDataRef.current) return;

      try {
        const response = await fetch('/api/upload-studio/save-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            walletAddress,
            personaId,
            extractedData
          })
        });

        const result = await response.json();
        if (result.success && result.draftId) {
          draftIdRef.current = result.draftId;
          lastDraftDataRef.current = dataSnapshot;
          console.log('💾 Draft auto-saved');
        }
      } catch (error) {
        // Silent fail — auto-save is best-effort
        console.warn('Draft auto-save failed:', error);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [extractedData, conversationId, walletAddress, personaId, isSubmitting]);

  // Voice recording functions
  const startRecording = async () => {
    // Stop any ongoing TTS playback
    stopSpeaking();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Create blob and transcribe
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      showToast('Could not access microphone', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('walletAddress', walletAddress);

      const response = await fetch('/api/upload-studio/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.text) {
        // Send message directly with the transcribed text (don't rely on state)
        sendMessage('voice', result.text);
      } else if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast('No speech detected', 'warning');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      showToast('Failed to transcribe audio', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  // TTS functions
  const stopSpeaking = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      URL.revokeObjectURL(ttsAudioRef.current.src);
      ttsAudioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speakResponse = async (text: string) => {
    // Note: The decision to speak is made in sendMessage based on inputMode parameter
    // No need to double-check state here (it may not have updated yet)
    try {
      setIsSpeaking(true);

      const response = await fetch('/api/upload-studio/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'nova', walletAddress }),
      });

      if (!response.ok) {
        console.error('TTS error:', response.status);
        setIsSpeaking(false);
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        setIsSpeaking(false);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        setIsSpeaking(false);
      };

      await audio.play();
    } catch (error) {
      console.error('TTS playback error:', error);
      setIsSpeaking(false);
    }
  };

  // Log session data for analysis
  const logSession = async (
    outcome: 'submitted' | 'abandoned' | 'error' | 'in_progress',
    finalTrackId?: string,
    finalPackId?: string,
    errorMessage?: string
  ) => {
    // Prevent double-logging
    if (sessionLoggedRef.current && outcome === 'submitted') return;
    if (outcome === 'submitted') sessionLoggedRef.current = true;

    // Only log if there was actual interaction
    if (messages.length === 0 && Object.keys(extractedData).length === 0) {
      return;
    }

    try {
      const uploadedFiles = attachments
        .filter(a => a.status === 'uploaded' && a.url)
        .map(a => ({
          type: a.type,
          url: a.url!,
          name: a.name,
          uploadedAt: new Date().toISOString()
        }));

      await fetch('/api/upload-studio/log-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          walletAddress,
          personaId,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
            attachments: m.attachments?.map(a => ({
              type: a.type,
              url: a.url,
              name: a.name
            })),
            inputMode: m.inputMode // Track voice vs text input
          })),
          uploadedFiles,
          inferredData: extractedData,
          detectedContentType: extractedData.content_type,
          outcome,
          finalTrackId,
          finalPackId,
          reachedReadyState: isReadyToSubmit,
          errorMessage,
          sessionStartTime: sessionStartTime.toISOString()
        })
      });

      console.log('📝 Session logged:', { conversationId, outcome });
    } catch (error) {
      // Don't throw - logging failures shouldn't break the app
      console.warn('Failed to log session:', error);
    }
  };

  // Track abandonment on unmount (if session had meaningful interaction)
  useEffect(() => {
    return () => {
      // Log abandonment if there was interaction but no submission
      if (!sessionLoggedRef.current && (messages.length > 1 || Object.keys(extractedData).length > 0)) {
        // Use sendBeacon for reliable delivery on page unload
        const data = {
          conversationId,
          walletAddress,
          personaId,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString()
          })),
          inferredData: extractedData,
          detectedContentType: extractedData.content_type,
          outcome: 'abandoned',
          reachedReadyState: isReadyToSubmit,
          sessionStartTime: sessionStartTime.toISOString()
        };

        // Try sendBeacon first (works on page unload)
        const beaconSuccess = navigator.sendBeacon(
          '/api/upload-studio/log-session',
          new Blob([JSON.stringify(data)], { type: 'application/json' })
        );

        if (!beaconSuccess) {
          // Fallback to fetch (may not complete on unload)
          fetch('/api/upload-studio/log-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            keepalive: true
          }).catch(() => {});
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect if the chatbot is asking for location
  const isAskingForLocation = useMemo(() => {
    const lastMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0];
    if (!lastMessage) return false;

    const content = lastMessage.content.toLowerCase();

    // More specific location phrases to avoid false positives
    const locationPhrases = [
      'where is this from',
      'where\'s this from',
      'what location',
      'what city',
      'what country',
      'where are you based',
      'where was this',
      'for the globe',
      'place it on the',
      'on the mixmi globe',
      'city, country, or region'
    ];

    // Check if the message is specifically asking about location
    return locationPhrases.some(phrase => content.includes(phrase));
  }, [messages]);

  // Handle location input change
  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    handleLocationSearch(value);
    setShowLocationDropdown(value.length >= 2);
  };

  // Handle location selection from dropdown
  const handleLocationSelect = (placeName: string) => {
    setLocationInput(placeName);
    setShowLocationDropdown(false);
    clearLocationSuggestions();

    // Send location as a message
    setInputValue(placeName);
    // Small delay to let state update, then auto-send
    setTimeout(() => {
      const input = placeName;
      setInputValue('');

      // Create user message with location
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setLocationInput('');

      // Trigger the chat API call
      sendLocationMessage(input);
    }, 50);
  };

  // Send location message to chat API
  const sendLocationMessage = async (location: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/upload-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: location,
          attachments: [],
          currentData: extractedData,
          walletAddress,
          personaId,
          messageHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Chat API error:', result);
        throw new Error(result.error || result.details || 'Chat request failed');
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (result.extractedData) {
        setExtractedData(prev => ({ ...prev, ...result.extractedData }));
      }

      if (result.readyToSubmit) {
        setIsReadyToSubmit(true);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble processing that. Could you try again?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add initial greeting when transitioning from hero to chat
  const addInitialGreeting = () => {
    if (messages.length === 0) {
      const greeting: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Hey! Drop your files and I'll help you get them on the globe and into your Creator Store.",
        timestamp: new Date()
      };
      setMessages([greeting]);
    }
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Hide the welcome hero when files are selected
    setShowWelcomeHero(false);
    addInitialGreeting();

    const newAttachments: FileAttachment[] = files.map(file => {
      let type: 'audio' | 'video' | 'image' = 'audio';
      if (file.type.startsWith('video/')) type = 'video';
      if (file.type.startsWith('image/')) type = 'image';

      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        file,
        status: 'pending'
      };
    });

    setAttachments(prev => [...prev, ...newAttachments]);

    // Upload files immediately
    for (const attachment of newAttachments) {
      await uploadFile(attachment);
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate smart crop for square aspect ratio
  const calculateSmartCrop = (videoWidth: number, videoHeight: number) => {
    const aspectRatio = videoWidth / videoHeight;
    let cropX = 0;
    let cropY = 0;
    let cropSize = Math.min(videoWidth, videoHeight);

    if (aspectRatio > 1) {
      // Landscape video - crop from center horizontally
      cropX = Math.floor((videoWidth - cropSize) / 2);
      cropY = 0;
    } else if (aspectRatio < 1) {
      // Portrait video - crop from top (weighted toward top where interesting content usually is)
      cropX = 0;
      // Take from top third instead of exact center - more likely to have faces/action
      cropY = Math.floor((videoHeight - cropSize) * 0.2); // 20% from top
    }
    // Square video - no crop needed, use as is

    return { cropX, cropY, cropSize };
  };

  // Capture first frame of video as thumbnail with smart cropping
  const captureVideoThumbnail = async (file: File): Promise<{
    thumbnailUrl: string | null;
    cropData: { x: number; y: number; width: number; height: number; zoom: number; naturalWidth: number; naturalHeight: number } | null
  }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.onloadeddata = () => {
        // Seek to 0.1 seconds to avoid black frames
        video.currentTime = 0.1;
      };

      video.onseeked = async () => {
        try {
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          // Calculate smart crop
          const { cropX, cropY, cropSize } = calculateSmartCrop(videoWidth, videoHeight);

          // Create canvas for the cropped square thumbnail
          const canvas = document.createElement('canvas');
          const outputSize = 800; // Output thumbnail size
          canvas.width = outputSize;
          canvas.height = outputSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Failed to get canvas context');
            URL.revokeObjectURL(objectUrl);
            resolve({ thumbnailUrl: null, cropData: null });
            return;
          }

          // Draw the cropped portion of the video frame to canvas
          ctx.drawImage(
            video,
            cropX, cropY, cropSize, cropSize,  // Source rectangle (from video)
            0, 0, outputSize, outputSize       // Destination rectangle (on canvas)
          );

          // Convert to blob
          canvas.toBlob(async (blob) => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              console.error('Failed to create thumbnail blob');
              resolve({ thumbnailUrl: null, cropData: null });
              return;
            }

            // Upload thumbnail to cover-images bucket
            const thumbnailFileName = `${crypto.randomUUID()}.jpg`;
            const { data: thumbnailData, error: thumbnailError } = await supabase.storage
              .from('cover-images')
              .upload(thumbnailFileName, blob, {
                cacheControl: '3600',
                upsert: false
              });

            if (thumbnailError) {
              console.error('Failed to upload thumbnail:', thumbnailError);
              resolve({ thumbnailUrl: null, cropData: null });
              return;
            }

            // Get public URL for thumbnail
            const { data: { publicUrl } } = supabase.storage
              .from('cover-images')
              .getPublicUrl(thumbnailFileName);

            const cropData = {
              x: cropX,
              y: cropY,
              width: cropSize,
              height: cropSize,
              zoom: 1.0,
              naturalWidth: videoWidth,
              naturalHeight: videoHeight
            };

            console.log('✅ Auto-generated cover image with smart crop:', {
              videoSize: `${videoWidth}x${videoHeight}`,
              aspectRatio: (videoWidth / videoHeight).toFixed(2),
              cropArea: `${cropSize}x${cropSize} at (${cropX}, ${cropY})`
            });

            resolve({ thumbnailUrl: publicUrl, cropData });
          }, 'image/jpeg', 0.9);
        } catch (error) {
          console.error('Error capturing thumbnail:', error);
          URL.revokeObjectURL(objectUrl);
          resolve({ thumbnailUrl: null, cropData: null });
        }
      };

      video.onerror = () => {
        console.error('Error loading video for thumbnail');
        URL.revokeObjectURL(objectUrl);
        resolve({ thumbnailUrl: null, cropData: null });
      };
    });
  };

  // Upload file to storage
  const uploadFile = async (attachment: FileAttachment) => {
    setAttachments(prev => prev.map(a =>
      a.id === attachment.id ? { ...a, status: 'uploading', progress: 0 } : a
    ));

    try {
      // Determine file category and storage path
      const AUDIO_EXTS = /\.(mp3|wav|flac|m4a|ogg)$/i;
      const VIDEO_EXTS = /\.(mp4|mov|avi|webm)$/i;
      const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp)$/i;

      let fileCategory: 'audio' | 'video' | 'image' = 'audio';
      let storagePath = 'audio';

      if (attachment.file.type.startsWith('video/') || VIDEO_EXTS.test(attachment.file.name)) {
        fileCategory = 'video';
        storagePath = 'video-clips'; // Separate Supabase bucket
      } else if (attachment.file.type.startsWith('image/') || IMAGE_EXTS.test(attachment.file.name)) {
        fileCategory = 'image';
        storagePath = 'cover-images';
      }

      // Generate unique filename
      const timestamp = Date.now();
      const ext = attachment.file.name.split('.').pop()?.toLowerCase() || 'bin';
      const uniqueName = `${walletAddress.substring(0, 10)}-${timestamp}.${ext}`;

      // Video uses its own bucket; audio/images use user-content bucket with subfolder
      const bucket = fileCategory === 'video' ? 'video-clips' : 'user-content';
      const filePath = fileCategory === 'video' ? uniqueName : `${storagePath}/${uniqueName}`;

      // Upload directly to Supabase Storage from the browser
      console.log('📤 Uploading to Supabase:', { bucket, filePath, type: attachment.file.type, size: attachment.file.size });

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, attachment.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('📤 Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const result = {
        url: urlData.publicUrl,
        type: fileCategory,
        filename: uniqueName,
        originalFilename: attachment.file.name,
        size: attachment.file.size,
        bpm: null as number | null,
        duration: null as number | null
      };

      setAttachments(prev => prev.map(a =>
        a.id === attachment.id ? { ...a, status: 'uploaded', url: result.url, progress: 100 } : a
      ));

      // Detect duration client-side for audio/video files
      let detectedDuration: number | null = null;
      if (attachment.type === 'audio') {
        detectedDuration = await detectAudioDuration(attachment.file);
      } else if (attachment.type === 'video') {
        detectedDuration = await detectVideoDuration(attachment.file);
      }

      // Store duration on the attachment
      if (detectedDuration) {
        setAttachments(prev => prev.map(a =>
          a.id === attachment.id ? { ...a, duration: detectedDuration! } : a
        ));
      }

      // Update extracted data based on file type
      if (attachment.type === 'audio') {
        // Check if there's already a video clip in progress - can't mix audio with video clips
        if (extractedData.content_type === 'video_clip' && extractedData.video_url) {
          showToast('⚠️ Can\'t add audio to a video clip - please start a new upload for audio content', 'warning');
          setAttachments(prev => prev.map(a =>
            a.id === attachment.id ? { ...a, status: 'error' } : a
          ));
          return;
        }

        setExtractedData(prev => {
          // Check if this is potentially a multi-file upload (loop pack or EP)
          // If we already have an audio_url, add to an array instead
          const existingAudioUrl = prev.audio_url;
          const existingLoopFiles = prev.loop_files || [];
          const existingEpFiles = prev.ep_files || [];
          const existingFilenames = prev.original_filenames || [];
          const existingDurations = prev.file_durations || [];

          // If there's already an audio file, we might be building a pack/EP
          // Store both in arrays for the chatbot to later determine the type
          if (existingAudioUrl && existingAudioUrl !== result.url) {
            // Convert to multi-file mode - store all URLs in both arrays
            // The chatbot will decide which to use based on content_type
            const allAudioFiles = [...new Set([existingAudioUrl, ...existingLoopFiles, ...existingEpFiles, result.url])];
            // Build parallel array of original filenames - maintain same order as URLs
            const allFilenames = [...existingFilenames];
            if (result.originalFilename && !allFilenames.includes(result.originalFilename)) {
              allFilenames.push(result.originalFilename);
            }
            return {
              ...prev,
              audio_url: result.url, // Keep most recent as primary
              loop_files: allAudioFiles,
              ep_files: allAudioFiles,
              original_filenames: allFilenames,
              // Track file durations for content type intelligence
              file_durations: detectedDuration
                ? [...existingDurations, detectedDuration]
                : existingDurations,
              // Store detected BPMs for validation
              ...(result.bpm && {
                bpm: result.bpm,
                // Track all detected BPMs for consistency checking
                detected_bpms: [...(prev.detected_bpms || [prev.bpm].filter(Boolean)), result.bpm]
              }),
              ...(result.duration && { duration: result.duration })
            };
          }

          // First audio file - just store normally
          return {
            ...prev,
            audio_url: result.url,
            // Store original filename for first file too
            original_filenames: result.originalFilename ? [result.originalFilename] : [],
            // Track duration
            file_durations: detectedDuration ? [detectedDuration] : [],
            // If BPM was detected, add it
            ...(result.bpm && {
              bpm: result.bpm,
              detected_bpms: [result.bpm]
            }),
            ...(result.duration && { duration: result.duration })
          };
        });
      } else if (attachment.type === 'video') {
        // Check if there's already audio uploaded - video covers aren't supported for audio content
        if (extractedData.audio_url || (extractedData.loop_files && extractedData.loop_files.length > 0)) {
          showToast('⚠️ Video covers aren\'t supported for audio content yet - use JPEG, PNG, WebP, or GIF instead', 'warning');
          // Mark as error and skip
          setAttachments(prev => prev.map(a =>
            a.id === attachment.id ? { ...a, status: 'error' } : a
          ));
          return;
        }

        // Standalone video clip - process normally
        const { thumbnailUrl, cropData } = await captureVideoThumbnail(attachment.file);

        setExtractedData(prev => ({
          ...prev,
          video_url: result.url,
          content_type: 'video_clip',
          // Use captured thumbnail
          ...(thumbnailUrl && { cover_image_url: thumbnailUrl }),
          // Save crop data for video playback
          ...(cropData && {
            video_crop_x: cropData.x,
            video_crop_y: cropData.y,
            video_crop_width: cropData.width,
            video_crop_height: cropData.height,
            video_crop_zoom: cropData.zoom,
            video_natural_width: cropData.naturalWidth,
            video_natural_height: cropData.naturalHeight
          })
        }));

        if (thumbnailUrl) {
          showToast('🎬 Cover image auto-generated from video', 'success');
        } else {
          showToast('⚠️ Could not auto-generate cover image - you can add one manually', 'warning');
        }
      } else if (attachment.type === 'image') {
        setExtractedData(prev => ({
          ...prev,
          cover_image_url: result.url,
          // Capture pre-generated thumbnail URLs from upload response
          thumb_64_url: result.thumbnails?.[64],
          thumb_160_url: result.thumbnails?.[160],
          thumb_256_url: result.thumbnails?.[256]
        }));
      }

      showToast(`✅ ${attachment.name} uploaded successfully`, 'success');

    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.message || 'Upload failed';

      setAttachments(prev => prev.map(a =>
        a.id === attachment.id ? { ...a, status: 'error' } : a
      ));

      // Show descriptive error toast
      showToast(`❌ ${attachment.name}: ${errorMessage}`, 'error');

      // Add a helpful message to the chat explaining the error
      const helpMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I noticed there was an issue uploading "${attachment.name}": **${errorMessage}**

${errorMessage.includes('too large') ? 'Try compressing the file or using a shorter clip.' : ''}
${errorMessage.includes('Unsupported') ? 'Supported formats are: MP3, WAV, FLAC, M4A for audio; MP4, MOV, WebM for video; and JPG, PNG, GIF, WebP for images.' : ''}

Feel free to try again with a different file, or let me know if you need help!`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, helpMessage]);
    }
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Send message - textOverride allows passing text directly (for voice transcription)
  const sendMessage = async (inputMode: 'voice' | 'text' = 'text', textOverride?: string) => {
    const messageText = textOverride ?? inputValue;

    if (!messageText.trim() && attachments.filter(a => a.status === 'uploaded').length === 0) {
      return;
    }

    // Track input mode for TTS response
    setLastInputMode(inputMode);

    // Hide the welcome hero when user sends first message
    setShowWelcomeHero(false);

    // Build content that includes attachment info so it's not filtered out as empty
    const uploadedAttachments = attachments.filter(a => a.status === 'uploaded');
    let messageContent = messageText;
    if (!messageText.trim() && uploadedAttachments.length > 0) {
      // Include attachment info in content so message isn't filtered out in history
      messageContent = `[Attached: ${uploadedAttachments.map(a => a.name).join(', ')}]`;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      attachments: uploadedAttachments,
      inputMode
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Clear attachments that were sent
    setAttachments(prev => prev.filter(a => a.status !== 'uploaded'));

    try {
      const response = await fetch('/api/upload-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: messageText,
          attachments: userMessage.attachments?.map(a => ({
            type: a.type,
            url: a.url,
            name: a.name,
            duration: a.duration // Include detected duration
          })),
          currentData: extractedData,
          walletAddress,
          personaId, // For agent profile loading + session tracking
          messageHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          personaMatchesFromPrevious // Include persona matches from previous response
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Chat API error:', result);
        throw new Error(result.error || result.details || 'Chat request failed');
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Speak response if user used voice input
      if (inputMode === 'voice' && result.message) {
        speakResponse(result.message);
      }

      // Update extracted data if provided
      if (result.extractedData) {
        setExtractedData(prev => ({ ...prev, ...result.extractedData }));
      }

      // Store persona matches for next message (collaborator matching flow)
      if (result.personaMatches) {
        setPersonaMatchesFromPrevious(result.personaMatches);
      } else {
        // Clear if no matches in this response
        setPersonaMatchesFromPrevious(undefined);
      }

      // Check if ready to submit
      if (result.readyToSubmit) {
        setIsReadyToSubmit(true);
      }

    } catch (error) {
      console.error('Chat error:', error);

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble processing that. Could you try rephrasing or let me know if you need help with something specific?",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage('text');
    }
  };

  // Drag and Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    // Check if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    // Only hide overlay when truly leaving the drop zone
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Hide the welcome hero when files are dropped
    setShowWelcomeHero(false);
    addInitialGreeting();

    // Filter for supported file types
    const supportedFiles = files.filter(file => {
      const isAudio = file.type.startsWith('audio/');
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      return isAudio || isVideo || isImage;
    });

    if (supportedFiles.length === 0) {
      showToast('⚠️ Please drop audio, video, or image files', 'warning');
      return;
    }

    if (supportedFiles.length < files.length) {
      showToast(`ℹ️ ${files.length - supportedFiles.length} unsupported file(s) skipped`, 'info');
    }

    // Create attachments from dropped files
    const newAttachments: FileAttachment[] = supportedFiles.map(file => {
      let type: 'audio' | 'video' | 'image' = 'audio';
      if (file.type.startsWith('video/')) type = 'video';
      if (file.type.startsWith('image/')) type = 'image';

      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        file,
        status: 'pending'
      };
    });

    setAttachments(prev => [...prev, ...newAttachments]);

    // Upload files immediately
    for (const attachment of newAttachments) {
      await uploadFile(attachment);
    }
  };

  // Submit track
  const submitTrack = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/upload-studio/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackData: extractedData,
          walletAddress,
          personaId,
          conversationId
        })
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      const result = await response.json();

      // Log the successful session
      await logSession(
        'submitted',
        result.trackId || result.tracks?.[0]?.id,
        result.packId
      );

      // Get the correct title based on content type
      const displayTitle = extractedData.content_type === 'ep'
        ? extractedData.ep_title
        : extractedData.content_type === 'loop_pack'
          ? extractedData.pack_title
          : extractedData.title;

      // Get friendly content type name
      const contentTypeName = extractedData.content_type === 'loop' ? 'loop'
        : extractedData.content_type === 'loop_pack' ? 'loop pack'
        : extractedData.content_type === 'full_song' ? 'song'
        : extractedData.content_type === 'ep' ? 'EP'
        : extractedData.content_type || 'track';

      const successMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `🎉 **Success!** Your ${contentTypeName} "${displayTitle || 'track'}" has been registered!

Your creative work is now:
• Timestamped on the blockchain
• Visible on the mixmi globe
• Ready for discovery and collaboration

Would you like to upload another track, or shall I show you where to find your new upload?`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, successMessage]);
      setIsReadyToSubmit(false);
      setExtractedData({});
      showToast('🎉 Track registered successfully!', 'success');

    } catch (error: any) {
      console.error('Submit error:', error);

      // Log the error
      await logSession('error', undefined, undefined, error.message || 'Submission failed');

      showToast('❌ Failed to register track. Please try again.', 'error');

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Something went wrong while registering your track. Don't worry - your files are safe. Want me to try again?",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get cover image URL from extractedData or from uploaded image attachments
  const getCoverImageUrl = () => {
    // First check extractedData
    if (extractedData.cover_image_url) return extractedData.cover_image_url;

    // Then check for uploaded image attachments
    const imageAttachment = attachments.find(a => a.type === 'image' && a.status === 'uploaded' && a.url);
    if (imageAttachment?.url) return imageAttachment.url;

    // For video clips, we might have a video but no cover yet
    const videoAttachment = attachments.find(a => a.type === 'video' && a.status === 'uploaded' && a.url);
    if (videoAttachment?.url && extractedData.content_type === 'video_clip') {
      // Could show video thumbnail, but for now just return null
      return null;
    }

    return null;
  };

  return (
    <div className="flex h-[calc(100vh-80px)] max-w-6xl mx-auto gap-6 px-4">
      {/* File Drop Zone - Left Side, stays visible until ready to submit */}
      {!isReadyToSubmit && (
        <div className="hidden lg:flex flex-col justify-end pb-32">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`w-[160px] h-[200px] rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
              isDragOver
                ? 'border-[#81E4F2] bg-[#81E4F2]/10'
                : 'border-slate-600 hover:border-slate-500 bg-slate-800/30 hover:bg-slate-800/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isDragOver ? 'bg-[#81E4F2]/20' : 'bg-slate-700/50'
            }`}>
              <Upload size={24} className={isDragOver ? 'text-[#81E4F2]' : 'text-gray-400'} />
            </div>
            <div className="text-center px-3">
              {attachments.filter(a => a.status === 'uploaded').length > 0 ? (
                <>
                  <p className="text-sm font-medium mb-1 text-green-400">
                    {attachments.filter(a => a.status === 'uploaded').length} file{attachments.filter(a => a.status === 'uploaded').length !== 1 ? 's' : ''} added
                  </p>
                  <p className="text-xs text-gray-500">Drop more or</p>
                </>
              ) : (
                <>
                  <p className={`text-sm font-medium mb-1 ${isDragOver ? 'text-[#81E4F2]' : 'text-gray-300'}`}>
                    Drop files here
                  </p>
                  <p className="text-xs text-gray-500">or</p>
                </>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-4 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Browse Files
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Container */}
      <div
        className="flex flex-col flex-1 max-w-4xl relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
      {/* Drag Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-[#0a0e1a]/90 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-[#81E4F2] rounded-xl m-2">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#81E4F2]/20 flex items-center justify-center">
              <Upload size={40} className="text-[#81E4F2]" />
            </div>
            <p className="text-xl font-semibold text-white mb-2">Drop your files here</p>
            <p className="text-gray-400">Audio, video, or images</p>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Upload Studio</h1>
            <p className="text-sm text-gray-400">Chat with AI to register your music</p>
          </div>

          {/* Data Preview Badge */}
          {Object.keys(extractedData).length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#81E4F2]/10 border border-[#81E4F2]/30 rounded-full">
              <div className="w-2 h-2 bg-[#81E4F2] rounded-full animate-pulse"></div>
              <span className="text-sm text-[#81E4F2]">
                {extractedData.title || extractedData.content_type || 'Collecting info...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
      >
        {/* Welcome Hero - shows before any interaction */}
        {showWelcomeHero && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center transition-all duration-500 ease-out">
            {/* Glowing orb icon */}
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#81E4F2]/30 to-[#A084F9]/30 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#81E4F2] to-[#A084F9] flex items-center justify-center shadow-lg shadow-[#81E4F2]/20">
                  <Globe size={32} className="text-white" />
                </div>
              </div>
              {/* Subtle pulse animation */}
              <div className="absolute inset-0 w-24 h-24 rounded-full bg-[#81E4F2]/20 animate-ping opacity-30" />
            </div>

            {/* Main headline */}
            <h2 className="text-3xl font-bold text-white mb-4">
              Add Your Work
            </h2>

            {/* Subheadline */}
            <p className="text-lg text-gray-300 mb-8 max-w-lg">
              I'll help you get credited and placed on the globe
            </p>

            {/* What you can upload */}
            <div className="text-sm text-gray-500 space-y-1">
              <p>Loops, loop packs, songs, EPs, video clips</p>
              <p>Set pricing, splits, and licensing as we chat</p>
            </div>
          </div>
        )}

        {/* Chat messages - shown after first interaction */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-[#81E4F2] text-[#0a0e1a]'
                  : 'bg-slate-800/80 text-white border border-slate-700/50'
              }`}
            >
              {/* Message content with markdown-like formatting */}
              <div
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    message.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/`(.*?)`/g, '<code class="bg-slate-700/50 px-1 rounded">$1</code>')
                      .replace(/^• /gm, '• '),
                    { ALLOWED_TAGS: ['strong', 'em', 'code'], ALLOWED_ATTR: ['class'] }
                  )
                }}
              />

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map(att => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 px-2 py-1 bg-slate-700/50 rounded text-xs"
                    >
                      {att.type === 'audio' && <Music size={12} />}
                      {att.type === 'video' && <Video size={12} />}
                      <span className="truncate max-w-[100px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-[#0a0e1a]/60' : 'text-gray-500'}`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 rounded-2xl px-4 py-3 border border-slate-700/50">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-[#81E4F2]" />
                <span className="text-sm text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Attachments */}
      {attachments.length > 0 && (
        <div className="px-6 py-2 border-t border-slate-700/50">
          {/* Upload Progress Bar - shows when files are uploading */}
          {attachments.some(a => a.status === 'uploading' || a.status === 'pending') && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                <span className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-[#81E4F2]" />
                  Uploading files...
                </span>
                <span>
                  {attachments.filter(a => a.status === 'uploaded').length} of {attachments.length} ready
                </span>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#81E4F2] to-[#6BC4D4] transition-all duration-300 ease-out"
                  style={{
                    width: `${(attachments.filter(a => a.status === 'uploaded').length / attachments.length) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  att.status === 'uploading' ? 'bg-blue-900/30 border border-blue-500/30' :
                  att.status === 'uploaded' ? 'bg-green-900/30 border border-green-500/30' :
                  att.status === 'error' ? 'bg-red-900/30 border border-red-500/30' :
                  'bg-slate-800 border border-slate-700'
                }`}
              >
                {/* Image thumbnail preview */}
                {att.type === 'image' && (
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={URL.createObjectURL(att.file)}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {att.type === 'audio' && <Music size={14} />}
                {att.type === 'video' && <Video size={14} />}
                <span className="truncate max-w-[150px] text-white">{att.name}</span>

                {att.status === 'uploading' && (
                  <Loader2 size={14} className="animate-spin text-blue-400" />
                )}
                {att.status === 'uploaded' && (
                  <CheckCircle size={14} className="text-green-400" />
                )}
                {att.status === 'error' && (
                  <span className="text-red-400 text-xs">Failed</span>
                )}

                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 text-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready to Submit Banner */}
      {isReadyToSubmit && (
        <div className="px-6 py-3 bg-green-900/30 border-t border-green-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-400" size={20} />
              <div>
                <p className="text-green-300 font-medium">Ready to register!</p>
                <p className="text-green-400/70 text-sm">
                  {extractedData.title} by {extractedData.artist}
                </p>
              </div>
            </div>
            <button
              onClick={submitTrack}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Registering...
                </span>
              ) : (
                'Register Track'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-slate-700/50">
        <div className="flex items-end gap-3">
          {/* Voice Input Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing || isLoading}
            className={`p-3 rounded-xl transition-colors ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : isTranscribing
                  ? 'bg-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700'
            } disabled:opacity-50`}
            title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Voice input'}
          >
            {isTranscribing ? (
              <Loader2 size={20} className="text-[#81E4F2] animate-spin" />
            ) : (
              <Mic size={20} className={isRecording ? 'text-white' : 'text-gray-400'} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,video/*,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text Input - with location autocomplete when asking for location */}
          <div className="flex-1 relative">
            {isAskingForLocation ? (
              <>
                {/* Location input with autocomplete */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <MapPin size={18} className="text-[#81E4F2]" />
                  </div>
                  <input
                    ref={locationInputRef}
                    type="text"
                    value={locationInput}
                    onChange={(e) => handleLocationInputChange(e.target.value)}
                    onFocus={() => locationInput.length >= 2 && setShowLocationDropdown(true)}
                    onBlur={() => setTimeout(() => setShowLocationDropdown(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && locationInput.trim()) {
                        e.preventDefault();
                        handleLocationSelect(locationInput.trim());
                      }
                    }}
                    placeholder="Start typing a city, country, or region..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-[#81E4F2]/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#81E4F2] transition-colors"
                    autoFocus
                  />
                  {isLoadingLocations && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin text-[#81E4F2]" />
                    </div>
                  )}
                </div>

                {/* Location suggestions dropdown */}
                {showLocationDropdown && locationSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-600 rounded-xl shadow-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto">
                    {locationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleLocationSelect(suggestion.place_name);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-700 last:border-0"
                      >
                        <MapPin size={14} className="text-[#81E4F2] flex-shrink-0" />
                        <span className="text-white text-sm truncate">{suggestion.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Or type manually hint */}
                <p className="text-xs text-gray-500 mt-1">
                  Select from suggestions or type your own location
                </p>
              </>
            ) : (
              <textarea
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  // Stop TTS and switch to text mode when user types
                  if (isSpeaking) stopSpeaking();
                  setLastInputMode('text');
                }}
                onKeyDown={handleKeyDown}
                placeholder={attachments.length > 0 ? "Hit send when you're done uploading, or type here..." : "Type here or use the mic to chat by voice..."}
                rows={1}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[#81E4F2] transition-colors"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={isAskingForLocation && locationInput.trim()
              ? () => handleLocationSelect(locationInput.trim())
              : () => sendMessage('text')
            }
            disabled={isLoading ||
              attachments.some(a => a.status === 'uploading' || a.status === 'pending') || (
              isAskingForLocation
                ? !locationInput.trim()
                : (!inputValue.trim() && attachments.filter(a => a.status === 'uploaded').length === 0)
            )}
            className="p-3 bg-[#81E4F2] hover:bg-[#6BC4D4] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={attachments.some(a => a.status === 'uploading' || a.status === 'pending') ? 'Wait for uploads to complete' : 'Send message'}
          >
            <Send size={20} className="text-[#0a0e1a]" />
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2 text-center">
          Type or speak • Enter to send • Shift+Enter for new line
        </p>
      </div>
      </div>

      {/* Preview Card - Right Side, positioned near chat input */}
      <div className="hidden lg:flex flex-col justify-end pb-32">
        <UploadPreviewCard
          data={extractedData}
          coverImageUrl={getCoverImageUrl() || undefined}
        />
      </div>
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Upload, Music, Video, Loader2, CheckCircle, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
}

interface FileAttachment {
  id: string;
  name: string;
  type: 'audio' | 'video' | 'image';
  file: File;
  url?: string; // After upload
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress?: number;
}

interface ExtractedTrackData {
  // Will be populated as conversation progresses
  content_type?: string;
  title?: string;
  artist?: string;
  description?: string;
  tags?: string[];
  bpm?: number;
  key?: string;
  loop_category?: string;
  tell_us_more?: string;
  location?: string;
  ai_assisted_idea?: boolean;
  ai_assisted_implementation?: boolean;
  allow_downloads?: boolean;
  download_price_stx?: number;
  open_to_collaboration?: boolean;
  open_to_commercial?: boolean;
  // Splits
  composition_splits?: Array<{ wallet?: string; name?: string; percentage: number }>;
  production_splits?: Array<{ wallet?: string; name?: string; percentage: number }>;
  // Files
  audio_url?: string;
  video_url?: string;
  cover_image_url?: string;
  // For packs
  pack_title?: string;
  loop_files?: string[];
  ep_files?: string[];
}

interface ConversationalUploaderProps {
  walletAddress: string;
}

export default function ConversationalUploader({ walletAddress }: ConversationalUploaderProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedTrackData>({});
  const [conversationId, setConversationId] = useState<string>('');
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize conversation
  useEffect(() => {
    const initConversation = async () => {
      const newConversationId = crypto.randomUUID();
      setConversationId(newConversationId);

      // Send initial greeting
      const initialMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Hey! 👋 Welcome to the Upload Studio. I'm here to help you register your creative work on mixmi.

What are you uploading today? You can tell me about:
• **8-Bar Loops** - Perfect for remixing and collaboration
• **Loop Packs** - Bundle of 2-5 loops together
• **Songs** - Full tracks for streaming
• **EPs** - Collection of 2-5 songs
• **Video Clips** - 5-second visual loops

Just describe what you've got, or drop your files here and we'll figure it out together!`,
        timestamp: new Date()
      };

      setMessages([initialMessage]);
    };

    initConversation();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

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

  // Upload file to storage
  const uploadFile = async (attachment: FileAttachment) => {
    setAttachments(prev => prev.map(a =>
      a.id === attachment.id ? { ...a, status: 'uploading', progress: 0 } : a
    ));

    try {
      const formData = new FormData();
      formData.append('file', attachment.file);
      formData.append('type', attachment.type);
      formData.append('walletAddress', walletAddress);

      const response = await fetch('/api/upload-studio/upload-file', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      setAttachments(prev => prev.map(a =>
        a.id === attachment.id ? { ...a, status: 'uploaded', url: result.url, progress: 100 } : a
      ));

      // Update extracted data based on file type
      if (attachment.type === 'audio') {
        setExtractedData(prev => ({
          ...prev,
          audio_url: result.url,
          // If BPM was detected, add it
          ...(result.bpm && { bpm: result.bpm }),
          ...(result.duration && { duration: result.duration })
        }));
      } else if (attachment.type === 'video') {
        setExtractedData(prev => ({
          ...prev,
          video_url: result.url,
          content_type: 'video_clip',
          // Auto-generated thumbnail
          ...(result.thumbnailUrl && { cover_image_url: result.thumbnailUrl })
        }));
      } else if (attachment.type === 'image') {
        setExtractedData(prev => ({
          ...prev,
          cover_image_url: result.url
        }));
      }

      showToast(`✅ ${attachment.name} uploaded successfully`, 'success');

    } catch (error) {
      console.error('Upload error:', error);
      setAttachments(prev => prev.map(a =>
        a.id === attachment.id ? { ...a, status: 'error' } : a
      ));
      showToast(`❌ Failed to upload ${attachment.name}`, 'error');
    }
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() && attachments.filter(a => a.status === 'uploaded').length === 0) {
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      attachments: attachments.filter(a => a.status === 'uploaded')
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
          message: inputValue,
          attachments: userMessage.attachments?.map(a => ({
            type: a.type,
            url: a.url,
            name: a.name
          })),
          currentData: extractedData,
          walletAddress,
          messageHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const result = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update extracted data if provided
      if (result.extractedData) {
        setExtractedData(prev => ({ ...prev, ...result.extractedData }));
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
      sendMessage();
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
          conversationId
        })
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      const result = await response.json();

      const successMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `🎉 **Success!** Your ${extractedData.content_type === 'loop' ? 'loop' : extractedData.content_type === 'full_song' ? 'song' : extractedData.content_type || 'track'} "${extractedData.title}" has been registered!

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

    } catch (error) {
      console.error('Submit error:', error);
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

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto">
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
                  __html: message.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`(.*?)`/g, '<code class="bg-slate-700/50 px-1 rounded">$1</code>')
                    .replace(/^• /gm, '• ')
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
          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            title="Upload files"
          >
            <Upload size={20} className="text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,video/*,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your track, ask questions, or drop files..."
              rows={1}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[#81E4F2] transition-colors"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={isLoading || (!inputValue.trim() && attachments.filter(a => a.status === 'uploaded').length === 0)}
            className="p-3 bg-[#81E4F2] hover:bg-[#6BC4D4] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} className="text-[#0a0e1a]" />
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

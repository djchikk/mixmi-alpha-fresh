"use client";

import React, { createContext, useContext, useState } from 'react';
import Toast from '@/components/ui/Toast';
import { celebrate, epicCelebration, celebrateContentUpload } from '@/lib/celebrations';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    visible: boolean;
    duration: number;
  }>({
    message: '',
    type: 'success',
    visible: false,
    duration: 3000
  });
  
  const showToast = (message: string, type: ToastType = 'success', duration: number = 3000) => {
    // 🎊 AUTO-TRIGGER CONFETTI for upload success messages!
    if (type === 'success' && message.toLowerCase().includes('saved')) {
      console.log('🎊 AUTO-CONFETTI triggered for:', message);
      
      // Detect content type from message and trigger appropriate celebration
      if (message.includes('EP')) {
        celebrateContentUpload('ep');
      } else if (message.includes('Loop Pack')) {
        celebrateContentUpload('loop_pack');
      } else if (message.includes('Track')) {
        celebrateContentUpload('full_song');
      } else {
        // Fallback celebration for any other success
        celebrate();
      }
      
      // Upload success messages should last longer for users to read while enjoying confetti!
      duration = 9000; // 3x longer (3 seconds → 9 seconds)
    }
    
    setToast({
      message,
      type,
      visible: true,
      duration
    });
  };
  
  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };
  
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        visible={toast.visible}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
} 
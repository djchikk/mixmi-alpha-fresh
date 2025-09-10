"use client";

import React, { useEffect, useState } from 'react';
import { celebrateContentUpload } from '@/lib/celebrations';
import { ContentType } from '@/types';

interface CelebrationDisplayProps {
  show: boolean;
  contentType: ContentType;
  songCount?: number;
  onComplete: () => void;
}

export default function CelebrationDisplay({ 
  show, 
  contentType, 
  songCount, 
  onComplete 
}: CelebrationDisplayProps) {
  const [currentStage, setCurrentStage] = useState<'celebrating' | 'instruction' | 'complete'>('celebrating');
  
  useEffect(() => {
    if (!show) {
      setCurrentStage('celebrating');
      return;
    }
    
    // Stage 1: Immediate confetti + celebration text
    celebrateContentUpload(contentType, songCount);
    setCurrentStage('celebrating');
    
    // Stage 2: After 2 seconds, show instruction
    const instructionTimer = setTimeout(() => {
      setCurrentStage('instruction');
    }, 2000);
    
    // Stage 3: After 5 seconds total, complete
    const completeTimer = setTimeout(() => {
      setCurrentStage('complete');
      onComplete();
    }, 5000);
    
    return () => {
      clearTimeout(instructionTimer);
      clearTimeout(completeTimer);
    };
  }, [show, contentType, songCount, onComplete]);

  if (!show || currentStage === 'complete') return null;

  const getContentEmoji = () => {
    switch (contentType) {
      case 'ep': return '🎤';
      case 'loop_pack': return '📦';
      case 'full_song': return '🎵';
      case 'loop': return '🔄';
      default: return '🎉';
    }
  };

  const getCelebrationText = () => {
    switch (contentType) {
      case 'ep': return `Epic! Your EP is saved! 🎤`;
      case 'loop_pack': return `Sweet! Your loop pack is saved! 📦`;
      case 'full_song': return `Awesome! Your song is saved! 🎵`;
      case 'loop': return `Nice! Your loop is saved! 🔄`;
      default: return `Yay! Your track is saved! 🎉`;
    }
  };

  return (
    <div 
      className="fixed right-8 z-50 pointer-events-none"
      style={{ 
        top: '50%', 
        transform: 'translateY(-50%)'
      }}
    >
      {/* Celebration Card */}
      <div 
        className={`
          bg-gradient-to-r from-green-600/90 to-green-500/90 
          backdrop-blur-md rounded-lg p-4 shadow-xl border border-green-400/30
          transition-all duration-500 ease-out
          ${currentStage === 'celebrating' 
            ? 'animate-bounce scale-100 opacity-100' 
            : 'scale-95 opacity-90'
          }
        `}
      >
        {currentStage === 'celebrating' && (
          <div className="text-center animate-pulse">
            <div className="text-3xl mb-2">{getContentEmoji()}</div>
            <div className="text-white font-bold text-lg">
              {getCelebrationText()}
            </div>
          </div>
        )}
        
        {currentStage === 'instruction' && (
          <div className="text-center animate-fade-in">
            <div className="text-2xl mb-2">✨</div>
            <div className="text-white font-medium">
              Refresh the page to see your music on the globe!
            </div>
            <div className="text-green-100 text-sm mt-1">
              Thanks to CC#2's performance magic! ✨
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
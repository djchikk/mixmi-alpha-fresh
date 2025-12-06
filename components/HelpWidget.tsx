"use client";

import React, { useState, useRef } from 'react';
import { HelpCircle, X, Play, Pause, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

interface HelpVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
}

// Placeholder videos - replace with actual video URLs when available
const helpVideos: HelpVideo[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn how to navigate the globe and discover music',
    videoUrl: '',
    thumbnailUrl: ''
  },
  {
    id: 'mixer-basics',
    title: 'Using the Mixer',
    description: 'Mix loops, songs, and radio together',
    videoUrl: '',
    thumbnailUrl: ''
  },
  {
    id: 'uploading',
    title: 'Upload Your Music',
    description: 'Share your loops, songs, and radio stations',
    videoUrl: '',
    thumbnailUrl: ''
  }
];

export default function HelpWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLargeMode, setIsLargeMode] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentVideo = helpVideos[currentVideoIndex];
  const hasVideos = helpVideos.some(v => v.videoUrl);

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(error => {
          console.error('Video playback failed:', error);
          setIsPlaying(false);
        });
    }
  };

  const handlePrevVideo = () => {
    setCurrentVideoIndex(prev =>
      prev === 0 ? helpVideos.length - 1 : prev - 1
    );
    setIsPlaying(false);
  };

  const handleNextVideo = () => {
    setCurrentVideoIndex(prev =>
      prev === helpVideos.length - 1 ? 0 : prev + 1
    );
    setIsPlaying(false);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setIsLargeMode(false);
    setIsPlaying(false);
  };

  // Large mode - centered modal
  if (isLargeMode) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Large Video Container */}
        <div className="relative z-10 w-full max-w-4xl mx-4">
          <div className="help-widget-large">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-gray-300" />
                <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Help & Tutorials
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Minimize Button */}
                <button
                  onClick={() => setIsLargeMode(false)}
                  className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                  title="Minimize"
                >
                  <Minimize2 className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>

                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>

            {/* Large Video Area */}
            {hasVideos && currentVideo.videoUrl ? (
              <div className="video-container-large mb-4 rounded-lg overflow-hidden relative">
                <video
                  ref={videoRef}
                  src={currentVideo.videoUrl}
                  poster={currentVideo.thumbnailUrl}
                  className="w-full h-auto"
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Play/Pause Overlay */}
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-20 h-20 text-white/80" fill="currentColor" />
                  ) : (
                    <Play className="w-20 h-20 text-white/80" fill="currentColor" />
                  )}
                </button>
              </div>
            ) : (
              /* Large Placeholder */
              <div className="video-placeholder-large mb-4 rounded-lg flex flex-col items-center justify-center">
                <HelpCircle className="w-16 h-16 text-gray-600 mb-3" />
                <p className="text-base text-gray-500 text-center">
                  Video tutorials coming soon
                </p>
              </div>
            )}

            {/* Video Info */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">
                {currentVideo.title}
              </h3>
              <p className="text-sm text-gray-400">
                {currentVideo.description}
              </p>
            </div>

            {/* Navigation */}
            {helpVideos.length > 1 && (
              <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                <button
                  onClick={handlePrevVideo}
                  className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
                  title="Previous video"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="flex gap-2">
                  {helpVideos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentVideoIndex(index);
                        setIsPlaying(false);
                      }}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentVideoIndex
                          ? 'bg-cyan-400'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                      title={helpVideos[index].title}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNextVideo}
                  className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
                  title="Next video"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Large Mode Styles */}
        <style jsx>{`
          .help-widget-large {
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(12px);
            border-radius: 1rem;
            padding: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(51, 65, 85, 0.5);
          }

          .video-container-large {
            aspect-ratio: 16 / 9;
            background: #0f172a;
          }

          .video-placeholder-large {
            aspect-ratio: 16 / 9;
            background: rgba(15, 23, 42, 0.5);
            border: 2px dashed #475569;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed top-1/2 right-6 -translate-y-1/2 z-[999]">
      {/* Help Icon Button - Always Visible */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="p-1.5 hover:bg-[#1E293B] rounded transition-colors"
          title="Help & Tutorials"
        >
          <HelpCircle className="w-6 h-6 text-gray-200" strokeWidth={2.5} />
        </button>
      )}

      {/* Expanded Help Widget (Small Mode) */}
      {isExpanded && (
        <div className="help-widget-container">
          {/* Header with Expand/Close */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-gray-300" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Help & Tutorials
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Expand Button */}
              <button
                onClick={() => setIsLargeMode(true)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title="Expand"
              >
                <Maximize2 className="w-4 h-4 text-gray-400 hover:text-white" />
              </button>

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-white" />
              </button>
            </div>
          </div>

          {/* Video Area */}
          {hasVideos && currentVideo.videoUrl ? (
            <div className="video-container mb-3 rounded-lg overflow-hidden relative">
              <video
                ref={videoRef}
                src={currentVideo.videoUrl}
                poster={currentVideo.thumbnailUrl}
                className="w-full h-auto"
                onEnded={() => setIsPlaying(false)}
              />

              {/* Play/Pause Overlay */}
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-12 h-12 text-white/80" fill="currentColor" />
                ) : (
                  <Play className="w-12 h-12 text-white/80" fill="currentColor" />
                )}
              </button>
            </div>
          ) : (
            /* Placeholder when no videos available */
            <div className="video-placeholder mb-3 rounded-lg flex flex-col items-center justify-center">
              <HelpCircle className="w-10 h-10 text-gray-600 mb-2" />
              <p className="text-xs text-gray-500 text-center px-4">
                Video tutorials coming soon
              </p>
            </div>
          )}

          {/* Video Info */}
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">
              {currentVideo.title}
            </h3>
            <p className="text-xs text-gray-400">
              {currentVideo.description}
            </p>
          </div>

          {/* Navigation */}
          {helpVideos.length > 1 && (
            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <button
                onClick={handlePrevVideo}
                className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
                title="Previous video"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex gap-1">
                {helpVideos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentVideoIndex(index);
                      setIsPlaying(false);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentVideoIndex
                        ? 'bg-cyan-400'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                    title={helpVideos[index].title}
                  />
                ))}
              </div>

              <button
                onClick={handleNextVideo}
                className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
                title="Next video"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Help Widget Styles */}
      <style jsx>{`
        .help-widget-container {
          position: relative;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(8px);
          border-radius: 0.75rem;
          width: 280px;
          padding: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(51, 65, 85, 0.5);
        }

        .video-container {
          aspect-ratio: 16 / 9;
          background: #0f172a;
        }

        .video-placeholder {
          aspect-ratio: 16 / 9;
          background: rgba(15, 23, 42, 0.5);
          border: 2px dashed #475569;
        }
      `}</style>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import Header from "@/components/layout/Header";
import Crate from "@/components/shared/Crate";
import { TrackNode } from "@/components/globe/types";
import { fetchGlobeTracksFromSupabase, fallbackGlobeNodes } from "@/lib/globeDataSupabase";

const SimplifiedMixer = dynamic(
  () => import('@/components/mixer/SimplifiedMixer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p>Loading Mixer...</p>
        </div>
      </div>
    )
  }
);

const GlobeSearch = dynamic(() => import('@/components/globe/GlobeSearch'), {
  ssr: false
});

export default function MixerRoute() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [globeNodes, setGlobeNodes] = useState<TrackNode[]>(fallbackGlobeNodes);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const tracks = await fetchGlobeTracksFromSupabase();
        if (tracks.length > 0) {
          setGlobeNodes(tracks);
        }
      } catch (error) {
        console.error('Error loading tracks for search:', error);
      }
    };
    loadTracks();
  }, []);

  const handlePlayPreview = (trackId: string, audioUrl: string) => {
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }

    if (playingTrackId === trackId) {
      currentAudio?.pause();
      setPlayingTrackId(null);
      setCurrentAudio(null);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
    }

    const audio = new Audio(audioUrl);
    audio.volume = 0.5;
    audio.play();
    setCurrentAudio(audio);
    setPlayingTrackId(trackId);

    const timeout = setTimeout(() => {
      audio.pause();
      setPlayingTrackId(null);
      setCurrentAudio(null);
    }, 30000);

    setPreviewTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
    };
  }, [currentAudio, previewTimeout]);

  if (!isClient) {
    return (
      <div className="w-full h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p>Initializing Mixer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#151C2A] to-[#101726] pt-16">
      <Header />

      <GlobeSearch
        nodes={globeNodes}
        onPlayPreview={handlePlayPreview}
        playingTrackId={playingTrackId}
      />

      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px - 100px)' }}>
        <div className="relative">
          {/* Sandbox Explanation - Positioned above mixer, left-aligned */}
          <div className="absolute bottom-full mb-6" style={{ width: '256px' }}>
            <h1 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Sandbox Mixer
            </h1>
            <p className="text-gray-400 text-xs leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Experiment with Loops
            </p>
            <p className="text-gray-500 text-xs leading-relaxed" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Explore advanced mixing features with loops. Try effects and record mixes.
            </p>
          </div>

          <SimplifiedMixer />
        </div>
      </div>

      <Crate />
    </div>
  );
}
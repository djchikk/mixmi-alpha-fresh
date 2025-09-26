"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import Header from "@/components/layout/Header";
import Crate from "@/components/shared/Crate";

const SimplifiedMixer = dynamic(
  () => import('@/components/mixer/SimplifiedMixer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p>Loading Big Mixer...</p>
        </div>
      </div>
    )
  }
);

export default function MixerRoute() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Big Mixer</h1>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-cyan-500 rounded-lg hover:bg-cyan-600 transition-colors text-white font-semibold"
          >
            ← Back to Globe
          </button>
        </div>
        <SimplifiedMixer className="mx-auto" />
      </div>
      <Crate />
    </div>
  );
}
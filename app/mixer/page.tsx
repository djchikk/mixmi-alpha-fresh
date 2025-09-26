"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import Header from "@/components/layout/Header";
import Crate from "@/components/shared/Crate";

const MixerPage = dynamic(
  () => import('@/components/mixer/MixerPage'),
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
    <>
      <Header />
      <MixerPage onExit={() => router.push("/")} />
      <Crate />
    </>
  );
}
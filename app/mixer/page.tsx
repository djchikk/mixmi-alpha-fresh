"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MixerTest() {
  const router = useRouter();

  useEffect(() => {
    console.log('✅ Mixer route mounted successfully');
    return () => console.log('✅ Mixer route unmounting cleanly');
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">🎛️ Mixer Route Test</h1>
      <p className="mb-4 text-lg">If you see this, routing works! 🎉</p>
      <p className="mb-6 text-gray-400">Next step: Add Big Mixer components</p>
      <button
        onClick={() => router.push('/')}
        className="px-6 py-3 bg-cyan-500 rounded-lg hover:bg-cyan-600 transition-colors font-semibold"
      >
        ← Back to Globe
      </button>
    </div>
  );
}
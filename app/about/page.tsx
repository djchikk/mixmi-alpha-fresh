"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AboutRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/welcome');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ 
      background: 'linear-gradient(135deg, #0a0f1c 0%, #1a1f2e 100%)',
      color: '#ffffff'
    }}>
      <p>Redirecting to Welcome...</p>
    </div>
  );
} 
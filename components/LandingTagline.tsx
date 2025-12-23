'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mixmi-tagline-shown';

export default function LandingTagline() {
  const [isVisible, setIsVisible] = useState(false);
  const [line1Visible, setLine1Visible] = useState(false);
  const [line2Visible, setLine2Visible] = useState(false);
  const [line3Visible, setLine3Visible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Always show on page load (for testing/iteration)
    // TODO: Before launch, switch to localStorage to show only on first visit ever
    if (typeof window !== 'undefined') {
      // Start the animation sequence
      setIsVisible(true);

      // Line 1 fades in immediately
      setTimeout(() => setLine1Visible(true), 100);

      // Line 2 fades in after 0.8s delay (after line 1 starts)
      setTimeout(() => setLine2Visible(true), 900);

      // Line 3 fades in after another 0.8s delay
      setTimeout(() => setLine3Visible(true), 1700);

      // Hold for 3.5s after all lines visible, then fade out
      setTimeout(() => setIsFadingOut(true), 5800);

      // Remove from DOM after fade out completes (2.4s)
      setTimeout(() => setIsVisible(false), 8200);
    }
  }, []);

  if (!isVisible) return null;

  // Get opacity for a line based on state
  const getOpacity = (lineVisible: boolean) => {
    if (isFadingOut) return 0;
    return lineVisible ? 1 : 0;
  };

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: '5%',
        top: '22%',
      }}
    >
      {/* Line 1: vibes from everywhere */}
      <div
        style={{
          fontFamily: 'var(--font-sora), sans-serif',
          fontWeight: 700,
          fontSize: '64px',
          color: '#F5F4F0',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          opacity: getOpacity(line1Visible),
          transition: 'opacity 2.4s ease-out',
        }}
      >
        vibes from everywhere
      </div>

      {/* Line 2: create, mix, share */}
      <div
        style={{
          fontFamily: 'var(--font-sora), sans-serif',
          fontWeight: 400,
          fontSize: '36px',
          color: '#FAFAFA',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginTop: '16px',
          opacity: getOpacity(line2Visible),
          transition: 'opacity 2.4s ease-out',
        }}
      >
        create, mix, share
      </div>

      {/* Line 3: Get paid. Fair. */}
      <div
        style={{
          fontFamily: 'var(--font-unbounded), sans-serif',
          fontWeight: 500,
          fontSize: '48px',
          color: '#F5F4F0',
          letterSpacing: '0',
          lineHeight: 1.1,
          marginTop: '20px',
          opacity: getOpacity(line3Visible),
          transition: 'opacity 2.4s ease-out',
        }}
      >
        Get paid. Fair.
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

const SUBLINE_TEXT = "where every remix remembers where it came from";
const TYPING_SPEED = 60; // ms per character

export default function LandingTagline() {
  const [isVisible, setIsVisible] = useState(false);
  const [headlineVisible, setHeadlineVisible] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if intro has already played this session
      if (sessionStorage.getItem('intro-played') === 'true') {
        // Skip animation, just ensure UI is visible
        document.body.classList.add('intro-complete');
        return;
      }

      // Mark intro as played for this session
      sessionStorage.setItem('intro-played', 'true');

      // Add intro mode class to hide UI elements
      document.body.classList.add('intro-mode');

      // Start the animation sequence
      setIsVisible(true);

      // Headline fades in after 500ms
      setTimeout(() => setHeadlineVisible(true), 500);

      // Start typing after headline is visible (1.5s after headline appears)
      setTimeout(() => {
        setShowCursor(true);
        let charIndex = 0;

        const typeInterval = setInterval(() => {
          if (charIndex < SUBLINE_TEXT.length) {
            setTypedText(SUBLINE_TEXT.slice(0, charIndex + 1));
            charIndex++;
          } else {
            clearInterval(typeInterval);

            // After typing completes, wait 2s then fade out
            setTimeout(() => {
              setIsFadingOut(true);
              setShowCursor(false);

              // Remove intro mode to show UI elements
              setTimeout(() => {
                document.body.classList.remove('intro-mode');
                document.body.classList.add('intro-complete');
              }, 800); // Start showing UI as tagline fades

              // Hide tagline completely
              setTimeout(() => setIsVisible(false), 2000);
            }, 2000);
          }
        }, TYPING_SPEED);

        return () => clearInterval(typeInterval);
      }, 2000);
    }

    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined') {
        document.body.classList.remove('intro-mode');
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: '5%',
        top: '28%',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 1.5s ease-out',
      }}
    >
      {/* Line 1: vibes from everywhere */}
      <div
        style={{
          fontFamily: 'var(--font-sora), sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(40px, 5vw, 64px)',
          color: '#F5F4F0',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          opacity: headlineVisible ? 1 : 0,
          transform: headlineVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 1.2s ease-out, transform 1.2s ease-out',
        }}
      >
        vibes from everywhere
      </div>

      {/* Line 2: Typing subline */}
      <div
        style={{
          fontFamily: 'var(--font-geist-mono), monospace',
          fontWeight: 400,
          fontSize: 'clamp(16px, 2vw, 22px)',
          color: 'rgba(255, 255, 255, 0.7)',
          letterSpacing: '0.02em',
          lineHeight: 1.4,
          marginTop: '20px',
          minHeight: '1.4em', // Prevent layout shift
        }}
      >
        {typedText}
        {showCursor && (
          <span
            className="typing-cursor"
            style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              backgroundColor: '#81E4F2',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'blink 0.8s step-end infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}

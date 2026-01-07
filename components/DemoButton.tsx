"use client";

import React, { useState } from 'react';

interface DemoButtonProps {
  onToggle: (isOn: boolean) => void;
  isOn: boolean;
}

export default function DemoButton({ onToggle, isOn }: DemoButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    onToggle(!isOn);
  };

  return (
    <div
      className="fixed top-1/2 right-16 -translate-y-1/2 z-[998] demo-button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main demo button - green glow style, vertically centered */}
      <button
        onClick={handleClick}
        className="relative overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: '#000000'
        }}
      >
        {/* Green radial gradient glow */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: 'radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)',
            opacity: isOn ? 1 : 0.5
          }}
        />
      </button>

      {/* Text label - positioned below button, doesn't affect vertical centering */}
      <div
        className={`
          absolute top-full left-1/2 -translate-x-1/2 mt-2
          text-[9px] font-bold uppercase tracking-wider whitespace-nowrap
          transition-all duration-200 text-white
          ${isOn || isHovered ? 'opacity-100' : 'opacity-0'}
        `}
      >
        {isOn ? 'RESET' : 'SHOW ME'}
      </div>
    </div>
  );
}

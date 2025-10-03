import React from 'react';

interface InfoIconProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  title?: string;
}

export default function InfoIcon({ 
  size = 'md', 
  onClick, 
  className = '',
  title = 'View details'
}: InfoIconProps) {
  // Size configurations for different card sizes
  const sizeConfig = {
    sm: { // For 64px collection bar cards
      text: 'text-sm',
      container: 'w-4 h-4'
    },
    md: { // For 160px store cards
      text: 'text-base',
      container: 'w-5 h-5'
    },
    lg: { // For 280px modal cards
      text: 'text-xl',
      container: 'w-8 h-8'
    }
  };

  const config = sizeConfig[size];

  return (
    <button
      onClick={onClick}
      className={`
        ${config.container}
        flex
        items-center
        justify-center
        transition-all
        hover:scale-110
        group
        ${className}
      `}
      title={title}
      style={{
        pointerEvents: onClick ? 'all' : 'none',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <span className={`${config.text} font-bold select-none leading-none transition-colors`}>
        i
      </span>
    </button>
  );
}
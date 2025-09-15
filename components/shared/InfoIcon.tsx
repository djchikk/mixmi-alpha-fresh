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
      container: 'w-5 h-5',
      text: 'text-xs'
    },
    md: { // For 160px store cards  
      container: 'w-7 h-7',
      text: 'text-sm'
    },
    lg: { // For 280px modal cards
      container: 'w-8 h-8',
      text: 'text-base'
    }
  };

  const config = sizeConfig[size];

  return (
    <button
      onClick={onClick}
      className={`
        ${config.container}
        rounded 
        bg-black/70 
        hover:bg-black/90
        border border-transparent
        hover:border-[#81E4F2]
        flex 
        items-center 
        justify-center 
        transition-all
        ${className}
      `}
      title={title}
      style={{ 
        pointerEvents: onClick ? 'all' : 'none',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <span className={`${config.text} text-white font-bold select-none`}>
        i
      </span>
    </button>
  );
}
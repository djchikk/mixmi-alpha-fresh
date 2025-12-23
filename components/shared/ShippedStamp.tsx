import React from 'react';

interface ShippedStampProps {
  /** UTC timestamp in format: "17-SEP-2025 • 00:36 UTC" */
  timestamp?: string;
  /** Custom rotation angle in degrees */
  rotation?: number;
  /** Custom size scale */
  scale?: number;
}

export default function ShippedStamp({ 
  timestamp = "17-SEP-2025 • 00:36 UTC", 
  rotation = -15,
  scale = 1 
}: ShippedStampProps) {
  return (
    <div 
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        transform: `rotate(${rotation}deg) scale(${scale})`,
      }}
    >
      <div 
        style={{
          border: '4px double #81E4F2',
          padding: '12px 20px',
          borderRadius: '10px',
          backgroundColor: 'rgba(10, 14, 26, 0.95)',
          opacity: '0.9',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
        }}
      >
        {/* DONE! Text */}
        <div 
          style={{
            fontSize: '28px',
            fontWeight: '900',
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: '#81E4F2',
            textShadow: '2px 2px 0px rgba(0,0,0,0.8)',
            letterSpacing: '2px',
            lineHeight: '1',
            marginBottom: '4px'
          }}
        >
          DONE!
        </div>
        
        {/* Timestamp */}
        <div 
          style={{
            fontSize: '11px',
            fontWeight: '600',
            fontFamily: 'Monaco, Courier New, monospace',
            color: '#81E4F2',
            textShadow: '1px 1px 0px rgba(0,0,0,0.8)',
            letterSpacing: '0.5px',
            opacity: '0.9'
          }}
        >
          {timestamp}
        </div>
      </div>
    </div>
  );
}
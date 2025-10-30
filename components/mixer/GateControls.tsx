"use client";

import React from 'react';

interface GateControlsProps {
  activeGate: number | null; // 0-5 for the 6 patterns, null for none
  onGateChange: (gateIndex: number | null) => void;
  disabled?: boolean;
}

// 6 gate patterns with subtle gradient colors from purple-blue (#4D5DE8 to #4AC6FF)
const GATE_COLORS = [
  { r: 77, g: 93, b: 232 },   // #4D5DE8 - Purple
  { r: 71, g: 108, b: 235 },  // Interpolated
  { r: 65, g: 123, b: 238 },  // Interpolated
  { r: 59, g: 138, b: 241 },  // Interpolated
  { r: 53, g: 153, b: 244 },  // Interpolated
  { r: 74, g: 196, b: 255 }   // #4AC6FF - Cyan
];

export default function GateControls({ activeGate, onGateChange, disabled = false }: GateControlsProps) {
  const handleGateClick = (index: number) => {
    if (disabled) return;

    // Toggle: if clicking active gate, deactivate it
    if (activeGate === index) {
      onGateChange(null);
    } else {
      onGateChange(index);
    }
  };

  return (
    <div className="gate-controls flex flex-col gap-1.5">
      {/* Row 1 */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(index => {
          const color = GATE_COLORS[index];
          const isActive = activeGate === index;
          const opacity = isActive ? 0.35 : 0.15;
          const borderOpacity = isActive ? 0.5 : 0.25;

          return (
            <button
              key={index}
              onClick={() => handleGateClick(index)}
              disabled={disabled}
              className={`gate-btn w-7 h-7 rounded transition-all ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
              style={{
                backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`,
                border: `1px solid rgba(${color.r}, ${color.g}, ${color.b}, ${borderOpacity})`,
                boxShadow: isActive
                  ? `0 0 10px rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`
                  : 'none'
              }}
              title={`Gate ${index + 1}${isActive ? ' (Active)' : ''}`}
            />
          );
        })}
      </div>

      {/* Row 2 */}
      <div className="flex gap-1.5">
        {[3, 4, 5].map(index => {
          const color = GATE_COLORS[index];
          const isActive = activeGate === index;
          const opacity = isActive ? 0.35 : 0.15;
          const borderOpacity = isActive ? 0.5 : 0.25;

          return (
            <button
              key={index}
              onClick={() => handleGateClick(index)}
              disabled={disabled}
              className={`gate-btn w-7 h-7 rounded transition-all ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
              style={{
                backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`,
                border: `1px solid rgba(${color.r}, ${color.g}, ${color.b}, ${borderOpacity})`,
                boxShadow: isActive
                  ? `0 0 10px rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`
                  : 'none'
              }}
              title={`Gate ${index + 1}${isActive ? ' (Active)' : ''}`}
            />
          );
        })}
      </div>

      <style jsx>{`
        .gate-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .gate-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
}

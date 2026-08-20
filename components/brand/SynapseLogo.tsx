'use client';

import React from 'react';
import Image from 'next/image';

interface SynapseLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
  variant?: 'silver' | 'white' | 'color';
}

export const SynapseLogo: React.FC<SynapseLogoProps> = ({
  size = 'md',
  showText = false,
  showTagline = false,
  className = '',
  variant = 'silver',
}) => {
  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const pixelMap = {
    xs: 20,
    sm: 28,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const imgSrc = variant === 'color' ? '/logo-color.png' : '/logo.png';
  const px = pixelMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* 3D Beveled Obsidian Logo Badge — always high-contrast & visible in both day and night modes */}
      <div
        className={`${sizeMap[size]} synapse-logo-badge rounded-xl flex items-center justify-center p-1 shadow-3d-sm shrink-0 overflow-hidden group relative`}
        style={{
          backgroundColor: '#141414',
          borderColor: '#2e2e2e',
          borderWidth: '1px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        <Image
          src={imgSrc}
          alt="SYNAPSE AI"
          width={px}
          height={px}
          className="w-full h-full object-contain filter drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform"
          priority
        />
      </div>

      {/* Brand Text */}
      {(showText || showTagline) && (
        <div className="flex flex-col min-w-0">
          {showText && (
            <span className="font-black text-neutral-100 tracking-wider text-sm leading-none font-sans">
              SYNAPSE AI
            </span>
          )}
          {showTagline && (
            <span className="text-[8px] font-bold text-neutral-500 tracking-widest uppercase mt-0.5 truncate">
              RESEARCH • STUDY • INNOVATION
            </span>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { BrandKey } from '../types';

interface BrandIconProps {
  brand: BrandKey | undefined;
  size?: number; // px
  className?: string;
  title?: string;
  src?: string; // optional custom icon url
}

const BrandIcon: React.FC<BrandIconProps> = ({ brand = 'generic', size = 16, className = '', title, src }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 16 16', xmlns: 'http://www.w3.org/2000/svg' } as const;

  // If a custom icon URL is provided, prefer it
  if (src) {
    // Use a fixed-size square wrapper to avoid distortion for non-square bitmaps.
    return (
      <span
        className={className}
        style={{ width: s, height: s, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label={title || 'brand'}
      >
        <img
          src={src}
          alt={title || 'brand'}
          style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 0, display: 'block' }}
        />
      </span>
    );
  }

  if (brand === 'gemini') {
    // Four-point Gemini star with blue→purple gradient
    return (
      <svg {...common} className={className} aria-hidden={!title} role={title ? 'img' : 'presentation'}>
        {title && <title>{title}</title>}
        <defs>
          <linearGradient id="g-star" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="100%" stopColor="#9B8AFB" />
          </linearGradient>
        </defs>
        <path d="M8 2 L10 8 L8 14 L6 8 Z" fill="url(#g-star)" opacity="0.95" />
        <path d="M2 8 L8 6 L14 8 L8 10 Z" fill="url(#g-star)" opacity="0.95" />
      </svg>
    );
  }
  if (brand === 'gpt') {
    // Higher-fidelity ChatGPT knot (compact path inspired by open-source glyphs)
    return (
      <svg {...common} className={className} aria-hidden={!title} role={title ? 'img' : 'presentation'}>
        {title && <title>{title}</title>}
        <path fill="#374151" d="M8 1.6c1.1-0.6 2.5-0.5 3.6 0.2 1.1 0.7 1.7 1.9 1.7 3.1v.3c.9.6 1.5 1.6 1.5 2.7 0 1.2-.6 2.2-1.6 2.8-.1 1.2-.8 2.3-1.9 2.9-1.1.6-2.5.5-3.5-.2-1 .7-2.4.8-3.5.2S1.7 11.8 1.6 10.6c-1-.6-1.6-1.7-1.6-2.9 0-1.1.6-2.1 1.5-2.7.1-1.2.8-2.3 1.9-3C4.5 1.4 6 .3 8 1.6Zm0 1.7c-1-.6-2.1-.5-3 .1-.9.6-1.4 1.6-1.3 2.6l-.8.5c-.7.4-1.1 1.1-1.1 1.9 0 .8.4 1.5 1.1 1.9l.7.4v.8c0 1 .5 2 1.4 2.6.9.6 2 .6 2.9 0l.7-.4.7.4c.9.6 2 .6 2.9 0 .9-.6 1.4-1.6 1.4-2.6v-.8l.7-.4c.7-.4 1.1-1.1 1.1-1.9 0-.8-.4-1.5-1.1-1.9l-.8-.5v-.8c0-1-.5-2-1.3-2.6-.9-.6-2-.6-3-.1l-.7.4-.7-.4Zm2.6 2.6 1.3.8-1.3.8v1.6L9.3 10l-1.3-.8-1.3.8L5.4 9.5V7.9L4.1 7.1l1.3-.8V4.7l1.3-.8 1.3.8 1.3-.8 1.3.8v1.6Z"/>
      </svg>
    );
  }
  if (brand === 'claude') {
    // Warm sun-like rosette proxy
    return (
      <svg {...common} className={className} aria-hidden={!title} role={title ? 'img' : 'presentation'}>
        {title && <title>{title}</title>}
        <circle cx="8" cy="8" r="4" fill="#F59E0B" />
        <g stroke="#F59E0B" strokeWidth="1.2">
          <line x1="8" y1="0" x2="8" y2="3" />
          <line x1="8" y1="13" x2="8" y2="16" />
          <line x1="0" y1="8" x2="3" y2="8" />
          <line x1="13" y1="8" x2="16" y2="8" />
        </g>
      </svg>
    );
  }
  // generic
  return (
    <svg {...common} className={className} aria-hidden={!title} role={title ? 'img' : 'presentation'}>
      {title && <title>{title}</title>}
      <circle cx="8" cy="8" r="6" fill="#9CA3AF" />
    </svg>
  );
};

export default BrandIcon;

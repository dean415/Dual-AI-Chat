import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

interface OptimizerRainbowProps {
  targetRef: React.RefObject<HTMLElement>;
  anchorRef?: React.RefObject<HTMLElement>; // container to align within (e.g., wrapper div)
  stage: 'idle' | 'start' | 'active' | 'end';
  thickness?: number; // stroke width in px
  speedSec?: number;  // rotation period in seconds
}

// SVG-based animated rainbow ring (SMIL, no CSS keyframes).
// Draws a rounded-rect stroke that matches the target element's box, with an
// animated gradient rotating around the border.
const OptimizerRainbow: React.FC<OptimizerRainbowProps> = ({ targetRef, anchorRef, stage, thickness = 3, speedSec = 1.6 }) => {
  const svgId = useId().replace(/:/g, '-');
  const [box, setBox] = useState<{ w: number; h: number; rx: number }>({ w: 0, h: 0, rx: 0 });
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const startAnimRef = useRef<SVGAnimateElement | null>(null);
  const endAnimRef = useRef<SVGAnimateElement | null>(null);

  // Measure target element and re-measure on resize
  useLayoutEffect(() => {
    let raf = 0;
    let roTarget: ResizeObserver | null = null;
    let roAnchor: ResizeObserver | null = null;
    const measure = () => {
      const el = targetRef.current as HTMLElement | null;
      const anchor = (anchorRef && anchorRef.current) ? anchorRef.current : null;
      if (!el) return; // next frame retry will handle
      const r = el.getBoundingClientRect();
      const w = Math.max(0, Math.floor(r.width));
      const h = Math.max(0, Math.floor(r.height));
      const rx = Math.max(0, Math.floor(h / 2));
      setBox({ w, h, rx });
      if (anchor) {
        const a = anchor.getBoundingClientRect();
        setOffset({ x: Math.floor(r.left - a.left), y: Math.floor(r.top - a.top) });
      } else {
        setOffset({ x: 0, y: 0 });
      }
    };
    const tryMeasure = () => {
      if (!targetRef.current) { raf = window.requestAnimationFrame(tryMeasure); return; }
      measure();
      // observers
      try {
        if (targetRef.current) {
          roTarget = new ResizeObserver(() => measure());
          roTarget.observe(targetRef.current as Element);
        }
      } catch {}
      try {
        if (anchorRef && anchorRef.current) {
          roAnchor = new ResizeObserver(() => measure());
          roAnchor.observe(anchorRef.current as Element);
        }
      } catch {}
      window.addEventListener('resize', measure);
    };
    tryMeasure();
    return () => {
      try { if (raf) window.cancelAnimationFrame(raf); } catch {}
      try { roTarget && roTarget.disconnect(); } catch {}
      try { roAnchor && roAnchor.disconnect(); } catch {}
      window.removeEventListener('resize', measure);
    };
  }, [targetRef, anchorRef, stage]);

  // Drive start/end opacity animations via SMIL beginElement
  useEffect(() => {
    if (stage === 'start') {
      try { startAnimRef.current?.beginElement(); } catch {}
    } else if (stage === 'end') {
      try { endAnimRef.current?.beginElement(); } catch {}
    }
  }, [stage]);

  if (!box.w || !box.h) return null;
  const inset = thickness; // keep ring inside the element bounds
  const innerW = Math.max(0, box.w - inset * 2);
  const innerH = Math.max(0, box.h - inset * 2);
  const rx = Math.max(0, box.rx - inset);

  // LIGHT/DARK theme detection for glow boost
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const processing = stage === 'start' || stage === 'active';

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      <svg
        width={box.w}
        height={box.h}
        viewBox={`0 0 ${box.w} ${box.h}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: stage === 'idle' ? 'none' : 'block', position: 'absolute', left: offset.x, top: offset.y }}
      >
        <defs>
          {/* Glow + saturation/brightness boost for stronger visibility */}
          <filter id={`glow-${svgId}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isDark ? 4.5 : 3.0} result="blur" />
            <feColorMatrix in="blur" type="saturate" values={isDark ? 1.6 : 1.25} result="sat" />
            <feComponentTransfer in="sat" result="boost">
              <feFuncR type="linear" slope={isDark ? 1.25 : 1.1} />
              <feFuncG type="linear" slope={isDark ? 1.25 : 1.1} />
              <feFuncB type="linear" slope={isDark ? 1.25 : 1.1} />
              <feFuncA type="linear" slope="1" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="boost" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Static rainbow gradient (no rotation) */}
          <linearGradient id={`grad-${svgId}`} x1="0" y1="0" x2={innerW} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF7A00" />
            <stop offset="20%" stopColor="#FFD100" />
            <stop offset="40%" stopColor="#00E5FF" />
            <stop offset="60%" stopColor="#7C4DFF" />
            <stop offset="80%" stopColor="#FF4D8D" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>

        {/* Group for start/end opacity timing + enhanced motion cues */}
        <g filter={`url(#glow-${svgId})`} opacity={stage === 'start' ? 0 : 1}>
          {/* start fade-in */}
          <animate ref={startAnimRef as any} attributeName="opacity" from="0" to="1" dur="0.24s" begin="indefinite" fill="freeze" />
          {/* end fade-out */}
          <animate ref={endAnimRef as any} attributeName="opacity" from="1" to="0" dur="0.24s" begin="indefinite" fill="freeze" />
          {/* Base continuous rainbow ring (static) */}
          <rect
            x={inset}
            y={inset}
            width={innerW}
            height={innerH}
            rx={rx}
            ry={rx}
            fill="none"
            stroke={`url(#grad-${svgId})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={processing ? (isDark ? 0.6 : 0.55) : (isDark ? 0.9 : 0.85)}
          />

          {(() => {
            const perim = Math.max(1, 2 * (innerW - 2 * rx + innerH - 2 * rx) + 2 * Math.PI * rx);
            // One or two bright highlights (white) traveling along the ring
            const dash = Math.max(24, Math.floor(perim * 0.20));
            const gap = Math.max(18, Math.floor(perim * 0.80));
            const to = -Math.max(60, Math.floor(perim));
            const half = Math.max(0.1, speedSec / 2);
            return (
              <>
                <rect
                  x={inset}
                  y={inset}
                  width={innerW}
                  height={innerH}
                  rx={rx}
                  ry={rx}
                  fill="none"
                  stroke={`url(#grad-${svgId})`}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={processing ? 0.95 : 0}
                  strokeDasharray={`${dash} ${gap}`}
                >
                  <animate attributeName="stroke-dashoffset" from="0" to={`${to}`} dur={`${speedSec}s`} repeatCount="indefinite" />
                </rect>
                {/* Second phased highlight for smoother flow */}
                <rect
                  x={inset}
                  y={inset}
                  width={innerW}
                  height={innerH}
                  rx={rx}
                  ry={rx}
                  fill="none"
                  stroke={`url(#grad-${svgId})`}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={processing ? 0.75 : 0}
                  strokeDasharray={`${dash} ${gap}`}
                >
                  <animate attributeName="stroke-dashoffset" from="0" to={`${to}`} dur={`${speedSec}s`} begin={`${half}s`} repeatCount="indefinite" />
                </rect>
              </>
            );
          })()}
        </g>
      </svg>
    </div>
  );
};

export default OptimizerRainbow;

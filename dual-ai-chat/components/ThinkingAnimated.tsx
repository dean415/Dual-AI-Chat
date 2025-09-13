import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

interface ThinkingAnimatedProps {
  sizePx?: number;           // Font size in px (matches model title)
  color?: string;            // Base text color
  delayMs?: number;          // Delay before shimmer starts
  scanDurationMs?: number;   // One left->right->left sweep duration
  className?: string;        // Container classes
  gapEm?: number;            // Space after last char in em, default 0 (normal)
}

// Self-contained SVG animation: shimmer highlight across the text and
// a blinking square caret. No external CSS required.
const ThinkingAnimated: React.FC<ThinkingAnimatedProps> = ({
  sizePx = 20,
  color = '#1f2937', // gray-800
  delayMs = 1000,
  scanDurationMs = 2600,
  className,
  gapEm = 0,
}) => {
  const gradId = useId().replace(/:/g, '-');
  const caretBlinkDur = 0.333; // ~3 times per second

  const text = 'Thinking...';

  // Refs/state for precise text measurement so caret hugs the text end.
  const baseTextRef = useRef<SVGTextElement | null>(null);
  const [caretX, setCaretX] = useState<number>(0);
  const [svgWidth, setSvgWidth] = useState<number>(() => Math.ceil((text.length + 6) * sizePx * 0.6));

  // Dimensions
  const height = Math.ceil(sizePx * 1.5);
  const baselineY = Math.ceil(sizePx * 1.1);
  const caretWidth = Math.ceil(sizePx * 0.5);
  const caretSize = Math.ceil(sizePx * 0.85);
  const gapPx = Math.max(0, Math.round(gapEm * sizePx));

  const measure = () => {
    const el = baseTextRef.current;
    if (!el) return;
    try {
      const textLen = (el as any).getComputedTextLength ? (el as any).getComputedTextLength() : el.getBBox().width;
      const x = Math.ceil(textLen + gapPx);
      setCaretX(x);
      const needed = x + caretWidth + 4; // small right padding
      setSvgWidth(prev => (needed > prev ? needed : prev));
    } catch {
      // fallback: keep approximate
    }
  };

  useLayoutEffect(() => { measure(); }, [sizePx, gapPx]);
  useEffect(() => {
    // Re-measure after fonts load to avoid early incorrect metrics
    const anyDoc = document as any;
    if (anyDoc.fonts && anyDoc.fonts.ready && typeof anyDoc.fonts.ready.then === 'function') {
      anyDoc.fonts.ready.then(() => measure());
    } else {
      // Fallback small defer
      const t = setTimeout(measure, 50);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <span role="status" aria-label="AI 正在思考" className={className} style={{ display: 'inline-block', lineHeight: 0 }}>
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* White highlight band with soft falloff; moves across text */}
          <linearGradient id={`g-${gradId}`} x1="-0.2" y1="0" x2="0" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            <animate
              attributeName="x1"
              values="-0.2; 1.2; -0.2"
              keyTimes="0; 0.5; 1"
              dur={`${scanDurationMs / 1000}s`}
              begin={`${delayMs / 1000}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="x2"
              values="0.0; 1.4; 0.0"
              keyTimes="0; 0.5; 1"
              dur={`${scanDurationMs / 1000}s`}
              begin={`${delayMs / 1000}s`}
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>

        {/* Base text in solid color */}
        <text ref={baseTextRef} x={0} y={baselineY} fontSize={sizePx} fill={color} fontFamily="Georgia, 'Times New Roman', serif">
          {text}
        </text>

        {/* Highlight overlay, same text with animated gradient fill */}
        <text x={0} y={baselineY} fontSize={sizePx} fill={`url(#g-${gradId})`} fontFamily="Georgia, 'Times New Roman', serif">
          {text}
        </text>

        {/* Blinking square caret placed after the text */}
        <rect x={caretX} y={baselineY - caretSize} width={Math.ceil(sizePx * 0.5)} height={caretSize} rx={1} ry={1} fill="#000">
          <animate attributeName="fill" values="#000; #fff; #000" dur={`${caretBlinkDur}s`} repeatCount="indefinite" />
        </rect>
      </svg>
    </span>
  );
};

export default ThinkingAnimated;

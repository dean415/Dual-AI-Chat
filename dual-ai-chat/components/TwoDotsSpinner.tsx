import React from 'react';

interface TwoDotsSpinnerProps {
  smallDiameter?: number; // px, visual minimum size
  bigDiameter?: number;   // px, visual maximum size
  durationMs?: number;    // full alternation cycle duration
  className?: string;     // extra classes to position inline
  label?: string;         // aria-label for a11y
  gapPx?: number;         // gap between dots
}

// Self-contained inline-SVG animation (no external CSS),
// guarantees the alternating scale + color pulse effect.
const TwoDotsSpinner: React.FC<TwoDotsSpinnerProps> = ({
  smallDiameter = 6,
  bigDiameter = 14,
  durationMs = 1000,
  className = '',
  label = '加载中',
  gapPx,
}) => {
  const dur = Math.max(200, durationMs);
  const rSmall = Math.max(1, smallDiameter / 2);
  const rBig = Math.max(rSmall + 0.5, bigDiameter / 2);
  // Halve again: default gap factor from ~0.3 → ~0.15 of bigDiameter
  const gap = gapPx ?? Math.round(bigDiameter * 0.15);
  const width = bigDiameter * 2 + gap; // two circles + new gap
  const height = bigDiameter;
  const cx1 = rBig; // left center uses max radius for padding
  const cx2 = rBig + gap + bigDiameter;
  const cy = rBig;

  // Colors (swapped as requested):
  // small = light blue, big = deep Google blue
  const COLOR_SMALL = '#AECBFA';
  const COLOR_BIG = '#4285F4';

  // Two-keyframe segments with ease-in-out for smoothness
  const keyTimes = '0;0.5;1';
  const keySplines = '0.4 0 0.2 1;0.4 0 0.2 1';

  return (
    <span role="status" aria-label={label} className={className} style={{ display: 'inline-block', lineHeight: 0 }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Left dot starts SMALL */}
        <circle cx={cx1} cy={cy} r={rSmall} fill={COLOR_SMALL}>
          <animate
            attributeName="r"
            dur={`${dur}ms`}
            values={`${rSmall};${rBig};${rSmall}`}
            keyTimes={keyTimes}
            calcMode="spline"
            keySplines={keySplines}
            repeatCount="indefinite"
          />
          <animate
            attributeName="fill"
            dur={`${dur}ms`}
            values={`${COLOR_SMALL};${COLOR_BIG};${COLOR_SMALL}`}
            keyTimes={keyTimes}
            calcMode="spline"
            keySplines={keySplines}
            repeatCount="indefinite"
          />
        </circle>
        {/* Right dot starts BIG */}
        <circle cx={cx2} cy={cy} r={rBig} fill={COLOR_BIG}>
          <animate
            attributeName="r"
            dur={`${dur}ms`}
            values={`${rBig};${rSmall};${rBig}`}
            keyTimes={keyTimes}
            calcMode="spline"
            keySplines={keySplines}
            repeatCount="indefinite"
          />
          <animate
            attributeName="fill"
            dur={`${dur}ms`}
            values={`${COLOR_BIG};${COLOR_SMALL};${COLOR_BIG}`}
            keyTimes={keyTimes}
            calcMode="spline"
            keySplines={keySplines}
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </span>
  );
};

export default TwoDotsSpinner;

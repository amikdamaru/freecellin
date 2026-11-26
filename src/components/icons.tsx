import type { Suit } from '../engine/card';

/** Full circle as a path segment (unioned with the rest via the nonzero fill rule). */
const circle = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

/** Each shape is drawn as its own path, so overlapping parts never cancel out. */
export const SUIT_PATHS: Record<Suit, string[]> = {
  H: ['M50 90C22 68 5 49 5 30 5 14 17 4 30 4c9 0 16 5 20 13 4-8 11-13 20-13 13 0 25 10 25 26 0 19-17 38-45 60z'],
  D: ['M50 3 88 50 50 97 12 50z'],
  S: [
    'M50 4C78 28 95 43 95 60c0 13-10 22-22 22-8 0-15-4-19-11 1 10 5 18 13 24H33c8-6 12-14 13-24-4 7-11 11-19 11C15 82 5 73 5 60 5 43 22 28 50 4z',
  ],
  C: [
    circle(50, 27, 20),
    circle(27, 58, 20),
    circle(73, 58, 20),
    circle(50, 50, 12),
    'M46 52C45 74 40 86 30 95h40C60 86 55 74 54 52z',
  ],
};

export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      {SUIT_PATHS[suit].map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

type IconProps = { className?: string };
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export const CrownIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="currentColor" fillOpacity="0.18" />
    <path d="M5 19h14" />
  </svg>
);

export const UndoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

export const RetryIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const NewGameIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="3" width="12" height="16" rx="2" />
    <path d="M8 21h10a2 2 0 0 0 2-2V7" />
    <path d="M10 8v6M7 11h6" />
  </svg>
);

export const AutoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 5l7 7-7 7" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const MovesIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M7 4v16M7 4L4 7M7 4l3 3" />
    <path d="M17 20V4M17 20l-3-3M17 20l3-3" />
  </svg>
);

export const InstallIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M5 19h14" />
  </svg>
);

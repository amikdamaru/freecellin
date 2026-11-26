import type { Suit } from '../engine/card';
import { SUIT_PATHS } from './icons';

const INK = '#1d3a26';
const RED = '#d4342f';
const BLACK = '#1b2621';

/** Four aces fanned behind the title: spade, heart, diamond, club. */
const FAN: { suit: Suit; angle: number }[] = [
  { suit: 'S', angle: -24 },
  { suit: 'H', angle: -8 },
  { suit: 'D', angle: 8 },
  { suit: 'C', angle: 24 },
];

function Suit({ suit, x, y, size }: { suit: Suit; x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 100})`}>
      {SUIT_PATHS[suit].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

/**
 * The "Freecellin" wordmark: bubbly white letters with a deep green outline,
 * a yellow "in", four fanned aces, sparkles and an underline swoosh.
 * Pure SVG (scales crisply, works offline); the font is bundled Fredoka.
 */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 720 270" role="img" aria-label="Freecellin" focusable="false">
      <g className="logo__cards">
        {FAN.map(({ suit, angle }, i) => {
          const color = suit === 'H' || suit === 'D' ? RED : BLACK;
          return (
            <g key={suit} className="logo__card" style={{ animationDelay: `${i * 70}ms` }} transform={`rotate(${angle} 360 330)`}>
              <rect x="316" y="18" width="88" height="124" rx="11" fill="#fffdf8" stroke={INK} strokeWidth="4" />
              <text x="330" y="52" fontSize="30" fontWeight="600" fill={color} fontFamily="Georgia, 'Times New Roman', serif">
                A
              </text>
              <g fill={color}>
                <Suit suit={suit} x={328} y={56} size={13} />
                <Suit suit={suit} x={338} y={70} size={46} />
              </g>
            </g>
          );
        })}
      </g>

      <g className="logo__sparkles" stroke="#f5c22b" strokeWidth="9" strokeLinecap="round">
        <path d="M66 96 72 124M26 130 52 143M18 182 46 183" />
        <path d="M654 96 648 124M694 130 668 143M702 182 674 183" />
      </g>

      <text
        className="logo__word"
        x="360"
        y="226"
        textAnchor="middle"
        textLength="560"
        lengthAdjust="spacingAndGlyphs"
        fontSize="134"
        fill="#fffdf5"
        stroke="#1f5a2e"
        strokeWidth="22"
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        Freecell<tspan fill="#f7c531">in</tspan>
      </text>

      <path d="M262 254Q360 240 458 251" fill="none" stroke="#f5c22b" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

import { useLayoutEffect, useState, type RefObject } from 'react';

export interface BoardLayout {
  cardW: number;
  cardH: number;
  gap: number;
  /** Height available to the tableau (below the free cell / foundation row). */
  tableauH: number;
}

const ASPECT = 1.4;
const MAX_CARD_W = 112;
const MIN_CARD_W = 36;

/**
 * Card size from the actual space available, not a scaled desktop layout:
 * width is bounded by 8 columns across, height by needing the top row plus a
 * readable tableau fan, so short landscape phones get smaller-but-legible cards.
 */
export function computeLayout(width: number, height: number, compact = width <= 600): BoardLayout {
  const gap = width < 480 ? 4 : width < 900 ? 8 : 14;
  // Must match .board padding/gap in game.css (compact = mobile breakpoint).
  const rowGap = compact ? 10 : 16;
  const padY = compact ? 16 : 28;
  const innerH = height - padY;
  // 8 columns, 7 gaps between them plus the board's side padding (one gap each side).
  const byWidth = (width - 9 * gap) / 8;
  // Top row (1 card) + a tableau showing one card plus ~6 fanned cards at 22%.
  const byHeight = (innerH - rowGap) / (ASPECT * (1 + 1 + 6 * 0.22));
  const cardW = Math.floor(Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, byWidth, byHeight)));
  const cardH = Math.round(cardW * ASPECT);
  return { cardW, cardH, gap, tableauH: Math.max(cardH, innerH - cardH - rowGap) };
}

export function useBoardLayout(ref: RefObject<HTMLElement | null>): BoardLayout {
  const [layout, setLayout] = useState<BoardLayout>(() => computeLayout(800, 600));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = computeLayout(el.clientWidth, el.clientHeight, window.innerWidth <= 600);
      setLayout((prev) =>
        prev.cardW === next.cardW && prev.tableauH === next.tableauH && prev.gap === next.gap ? prev : next,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return layout;
}

/** Vertical offset between fanned cards in a column of `n` cards. */
export function fanOffset(n: number, layout: BoardLayout): number {
  // The minimum still shows the full rank + suit index of every covered card.
  // Narrow (phone) cards get a wider fan when there is room: bigger touch targets.
  const max = layout.cardH * (layout.cardW < 64 ? 0.42 : 0.27);
  // Rank index font is clamp(13px, 0.29 * cardW, 28px) in card.css; never cover it.
  const rankPx = Math.min(28, Math.max(13, layout.cardW * 0.29));
  const min = Math.max(layout.cardH * 0.19, rankPx + 4);
  if (n <= 1) return max;
  const fit = (layout.tableauH - layout.cardH) / (n - 1);
  return Math.max(min, Math.min(max, fit));
}

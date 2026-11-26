/**
 * Card model.
 *
 * A card is encoded as a single integer 0..51 using the Microsoft FreeCell
 * ordering: id = (rank - 1) * 4 + suitIndex, with suits in the order
 * Clubs, Diamonds, Hearts, Spades. So 0 = A♣, 1 = A♦, 2 = A♥, 3 = A♠,
 * 4 = 2♣, ... 51 = K♠. Plain numbers keep snapshots small and serialisable.
 */

export type Card = number;

export const SUITS = ['C', 'D', 'H', 'S'] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const SUIT_NAME: Record<Suit, string> = { C: 'Clubs', D: 'Diamonds', H: 'Hearts', S: 'Spades' };

/** Rank characters indexed by rank (1 = Ace ... 13 = King). T = ten. */
const RANK_CHARS = ' A23456789TJQK';
const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

export const DECK_SIZE = 52;

export function makeCard(rank: number, suit: Suit): Card {
  return (rank - 1) * 4 + SUITS.indexOf(suit);
}

export function rankOf(card: Card): number {
  return Math.floor(card / 4) + 1;
}

export function suitIndexOf(card: Card): number {
  return card % 4;
}

export function suitOf(card: Card): Suit {
  return SUITS[card % 4];
}

export function isRed(card: Card): boolean {
  const s = suitOf(card);
  return s === 'D' || s === 'H';
}

export function isValidCard(value: unknown): value is Card {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < DECK_SIZE;
}

/** Short code such as "TD" or "AS" (Rosetta Code / fc-solve notation). */
export function cardCode(card: Card): string {
  return RANK_CHARS[rankOf(card)] + suitOf(card);
}

/** Parse a short code such as "TD", "10D" or "as". */
export function parseCard(code: string): Card {
  const c = code.trim().toUpperCase().replace(/^10/, 'T');
  if (c.length !== 2) throw new Error(`Invalid card code: ${code}`);
  const rank = RANK_CHARS.indexOf(c[0]);
  const suit = c[1] as Suit;
  if (rank < 1 || !SUITS.includes(suit)) throw new Error(`Invalid card code: ${code}`);
  return makeCard(rank, suit);
}

export function rankLabel(card: Card): string {
  return RANK_LABELS[rankOf(card)];
}

export function cardName(card: Card): string {
  return `${RANK_NAMES[rankOf(card)]} of ${SUIT_NAME[suitOf(card)]}`;
}

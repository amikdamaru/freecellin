/**
 * Independent reference layouts, copied verbatim from
 * https://rosettacode.org/wiki/Deal_cards_for_FreeCell (game #1, #617 and #11982).
 * Rows are read left to right; row 1 is the deepest card of each column.
 * These were NOT produced by this project's generator.
 */
export const REFERENCE_DEALS: Record<number, string> = {
  1: `
JD 2D 9H JC 5D 7H 7C 5H
KD KC 9S 5S AD QC KH 3H
2S KS 9D QD JS AS AH 3C
4C 5C TS QH 4H AC 4D 7S
3S TD 4S TH 8H 2C JH 7D
6D 8S 8D QS 6C 3D 8C TC
6S 9C 2H 6H`,
  617: `
7D AD 5C 3S 5S 8C 2D AH
TD 7S QD AC 6D 8H AS KH
TH QC 3H 9D 6S 8D 3D TC
KD 5H 9S 3C 8S 7H 4D JS
4C QS 9C 9H 7C 6H 2C 2S
4S TS 2H 5D JC 6C JH QH
JD KS KC 4H`,
  11982: `
AH AS 4H AC 2D 6S TS JS
3D 3H QS QC 8S 7H AD KS
KD 6H 5S 4D 9H JH 9S 3C
JC 5D 5C 8C 9D TD KH 7C
6C 2C TH QH 6D TC 4S 7S
JD 7D 8H 9C 2H QD 4C 5H
KC 8D 2S 3S`,
};

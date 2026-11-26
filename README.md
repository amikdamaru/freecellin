# Freecellin

Freecellin is a classic FreeCell solitaire game with Microsoft-compatible numbered deals, sound effects, background music, saved progress, and offline play. It can be installed from Chrome as a Progressive Web App.

The app's name is **Freecellin**. Keep it unchanged in the header, the page title, the manifest and the package name.

Stack: React 19, TypeScript, Vite, vite-plugin-pwa (Workbox), and Vitest. There is no backend, and the only runtime dependencies are `react` and `react-dom`.

## Commands

```bash
npm install
npm run dev        # development server
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build (dist/, with service worker)
npm run preview    # serve dist/ at http://localhost:4173 (test PWA/offline here)
npm run generate:sounds   # re-synthesise src/audio/sounds/*.wav
npm run generate:icons    # re-render public/*.png icons
```

> Windows note: run commands from a path with an upper-case drive letter (`C:\...`, e.g. PowerShell).
> Under Git Bash (`/c/...`), Vitest can load two copies of itself and fail with
> "Cannot read properties of undefined (reading 'config')".

Debugging: `?deal=617` in the URL opens that deal. The browser console offers
`freecell.dealNumber`, `freecell.session` and `freecell.newGame(n)`. The deal number is also shown, in small type, at the right of the statistics bar.

## Architecture

```
src/
  engine/        pure, framework-free game logic (fully unit-tested)
    card.ts            card model (0..51, Microsoft order AC AD AH AS 2C …)
    dealGenerator.ts   Microsoft numbered deals, unsolvable list, New Game pick
    gameState.ts       Board / GameSession types, timer maths
    moveValidator.ts   rules, sequence capacity (F+1)·2^C
    gameActions.ts     performMove / undo / retry / classifyMove / quick move
    autoComplete.ts    safe auto-complete condition + next move
    winCondition.ts
  controller/
    interaction.ts     input → new state + explicit effects (one sound per action)
  audio/
    soundEvents.ts     event → file mapping, move kind → event
    audioManager.ts    Web Audio playback, preload, autoplay unlock, throttling
    sounds/*.wav       original procedurally generated sounds
  services/storage.ts  versioned, validated Local Storage
  hooks/               useGame, useTimer, usePersistence, useDragAndDrop, useBoardLayout, useInstallPrompt
  components/          presentational React components
  tests/               Vitest suites
```

These layout choices differ from the suggested structure:

- `controller/interaction.ts` was added. The rule "one action → exactly one sound" therefore lives in pure code that unit tests can check, not in React effects.
- Sounds are `.wav` files, not `.mp3`. They are tiny, and generating them needs no encoder.
- `deck.ts` was folded into `card.ts` and `dealGenerator.ts`.

## Rules and design decisions

- **Sequence moves.** A run moves as one unit when its length is at most (empty free cells + 1) × 2^(empty columns). If the destination is an empty column, that column is not counted. A move into a free cell or onto a foundation is always a single card. A test also checks the formula against a brute-force model of single-card moves.
- **House rule: taking cards back from a foundation.** Unlike Microsoft FreeCell, the top card of a foundation can be moved back to the tableau, by selecting it and then the column, or by dragging it. This can help in some positions. The usual tableau rules apply: the card must go onto a card one rank higher of the opposite colour, or into an empty column. It cannot go to a free cell or another foundation. Each take-back counts as one move and can be undone. Double-clicking a foundation card does nothing, so progress is never lost by accident.
- **Sound classification.** Each successful move plays exactly one of these:
  - **Foundation**: the card goes onto a foundation pile.
  - **Arrange**: the card or run is built onto a tableau card in descending order with alternating colours.
  - **Move**: the card or run goes to a free cell or an empty column.

  Selecting a card has its own sound, and so does an invalid move. Undo, Retry, New Game and restoring a saved game are silent.
- **Background music** comes from `audio3.mp3` in the project root, imported directly by `src/audio/musicManager.ts`. It loops at volume 0.28, below the 0.55 level of the sound effects, and has no user controls.
  - It starts on the first user interaction, as browser autoplay rules require.
  - It pauses while the tab is hidden.
  - It plays from a Blob URL, so it also works offline from the service-worker cache.
  - It is streamed through an `<audio>` element rather than decoded into Web Audio, which keeps memory use low.
  - Workbox's precache size limit is raised to 8 MB to fit the 5.7 MB file.
- **Timer.** The timer is derived from wall-clock timestamps (`startedAt`, `stoppedAt`) and is never built up by ticking. It starts on the first valid move and stops when the game is won. Undo does not rewind it. Because it is based on real time, it also counts time spent in a background tab, while the device sleeps, and while the browser is closed.
- **Move counter.** The counter is stored on its own and is never derived from the undo history, so Undo never lowers it.
- **Win counter.** It goes up only when a move wins the game. A won game rejects all further moves, so the same win cannot be counted twice.
- **Auto Complete** is enabled only when every tableau column is in non-increasing rank order. Finishing is then guaranteed by foundation moves alone, and no move can block another card. Each automatic move counts as one move, with one foundation sound per card, spaced 140 ms apart.
- **Persistence.** The keys are `freecell.game` and `freecell.wins`. Both are versioned (`version: 1`), and a migration hook is in place for future formats. On every load the data is checked: each board and each undo snapshot must hold all 52 cards exactly once, a "won" status must match a finished board, and timestamps must be valid. Corrupt data leads to a new game and a visible notice, never a crash.

## Microsoft numbered deals: sources and limits

- **Algorithm.** The generator uses the Microsoft C runtime LCG: `state = (214013·state + 2531011) mod 2^31`, with `rand = state >> 16`. The deck is ordered `AC AD AH AS 2C …`. Each step picks `rand mod n`, swaps that card with the last one, and deals it. Cards are dealt row by row across 8 columns. The method is documented on [Rosetta Code](https://rosettacode.org/wiki/Deal_cards_for_FreeCell) and is the same one used by [macroxue/freecell](https://github.com/macroxue/freecell) (GPL-3.0) and [shlomif/fc-solve](https://github.com/shlomif/fc-solve) (MIT). The code here is an independent implementation; no third-party code was copied.
- **Verification.** Deals #1, #617 and #11982 are compared against layouts copied verbatim from Rosetta Code (`src/tests/fixtures.ts`). The first outputs of the random generator are compared against the known MSVC `rand()` sequence (41, 18467, 6334, …).
- **Deal #31999.** No verbatim published layout could be found for this deal, so it is checked only for structural correctness (52 unique cards, correct shape) and repeatability. Because the generator matches the three reference deals and the `rand()` sequence, it is expected to be correct for #31999 as well, but that is not independently confirmed.
- **Solvability.** New Game picks uniformly from 1..1,000,000. It skips the eight deals that macroxue/freecell lists as unsolvable (11982, 146692, 186216, 455889, 495505, 512118, 517776, 781948) and never repeats the previous deal. That list comes from macroxue's solver results for deals 1..1,000,000. The app does not check the remaining 999,992 deals itself, and it does not bundle the solution database (about 1M lines, GPL-3.0), because the game does not need it.

## PWA

The Web App Manifest uses standalone display, the ivory theme and background colours, 192/512 icons, and a maskable icon. The service worker is generated by Workbox and precaches the app shell, the icons, all six sound files and the background music. After the first visit the game works fully offline. The **Install** button appears only when Chrome fires `beforeinstallprompt`; otherwise Chrome's own install UI is used.

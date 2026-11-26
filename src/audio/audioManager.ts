/**
 * Audio service. Completely optional for the game: every failure (no Web Audio,
 * blocked autoplay, missing file, decode error) degrades to silence.
 *
 * - Sound files are fetched (preloaded) as soon as the manager is created.
 * - The AudioContext is created/resumed only after the first user gesture
 *   (autoplay policy), then the files are decoded once and reused.
 * - Each `play()` call is explicit; nothing is triggered by React renders.
 * - A per-event minimum gap prevents stacked sounds (e.g. during Auto Complete),
 *   and a short global window prevents two sounds for one action.
 */
import { SoundEvent, SOUND_SOURCES } from './soundEvents';

/** Fixed internal volume (no user controls by design). */
export const MASTER_VOLUME = 0.55;

/** Minimal subset of the Web Audio API used here (lets tests inject a fake). */
export interface AudioContextLike {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  createBufferSource(): {
    buffer: unknown;
    connect(node: unknown): unknown;
    disconnect(): void;
    start(when?: number): void;
    onended: (() => void) | null;
  };
  createGain(): { gain: { value: number }; connect(node: unknown): unknown };
}

export interface AudioManagerOptions {
  sources?: Record<SoundEvent, string>;
  createContext?: () => AudioContextLike | null;
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
  now?: () => number;
  volume?: number;
}

/** Minimum ms between two plays of the same event. */
const MIN_GAP_MS: Partial<Record<SoundEvent, number>> = {
  CARD_TO_FOUNDATION: 70,
  CARD_SELECTED: 40,
  INVALID_MOVE: 120,
};
/** Different events this close together are treated as one action; the first wins. */
const ACTION_WINDOW_MS = 25;
/** A sound requested before decoding finished is dropped if it would start later than this. */
const LATE_MS = 300;

function defaultCreateContext(): AudioContextLike | null {
  const w = globalThis as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.arrayBuffer();
}

export class AudioManager {
  private ctx: AudioContextLike | null = null;
  private master: ReturnType<AudioContextLike['createGain']> | null = null;
  private readonly raw = new Map<SoundEvent, Promise<ArrayBuffer | null>>();
  private readonly decoded = new Map<SoundEvent, unknown>();
  private readonly lastPlayed = new Map<SoundEvent, number>();
  private lastAnyPlayed = -Infinity;
  private unlocked = false;
  private suppressed = false;
  private decoding: Promise<void> | null = null;
  private queued: { event: SoundEvent; at: number } | null = null;
  private readonly opts: Required<AudioManagerOptions>;

  constructor(options: AudioManagerOptions = {}) {
    this.opts = {
      sources: options.sources ?? SOUND_SOURCES,
      createContext: options.createContext ?? defaultCreateContext,
      fetchArrayBuffer: options.fetchArrayBuffer ?? defaultFetch,
      now: options.now ?? (() => performance.now()),
      volume: options.volume ?? MASTER_VOLUME,
    };
    this.preload();
  }

  /** Start downloading every sound file (no AudioContext needed yet). */
  private preload(): void {
    for (const [event, url] of Object.entries(this.opts.sources) as [SoundEvent, string][]) {
      const p = this.opts.fetchArrayBuffer(url).catch(() => null);
      this.raw.set(event, p);
    }
  }

  /** Call from a user-gesture handler. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = this.opts.createContext();
        if (!this.ctx) return;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.opts.volume;
        this.master.connect(this.ctx.destination);
        this.decoding = this.decodeAll().finally(() => {
          this.decoding = null;
        });
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      this.unlocked = true;
    } catch {
      /* audio unavailable: stay silent */
    }
  }

  private async decodeAll(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    await Promise.all(
      [...this.raw.entries()].map(async ([event, p]) => {
        try {
          const data = await p;
          // decodeAudioData detaches the buffer, so pass a copy.
          if (data) this.decoded.set(event, await ctx.decodeAudioData(data.slice(0)));
        } catch {
          /* undecodable file: that event stays silent */
        }
      }),
    );
  }

  /** While suppressed (e.g. restoring a saved game), play() is a no-op. */
  setSuppressed(value: boolean): void {
    this.suppressed = value;
  }

  isReady(event: SoundEvent): boolean {
    return this.decoded.has(event);
  }

  /**
   * Play a sound. Returns true if a sound was started (or, on the very first
   * gesture while files are still decoding, queued for at most LATE_MS).
   */
  play(event: SoundEvent): boolean {
    if (this.suppressed || !this.unlocked || !this.ctx || !this.master) return false;
    const buffer = this.decoded.get(event);
    if (!buffer) {
      if (!this.decoding) return false;
      // Only the most recent request is kept: it reflects the latest action.
      const request = { event, at: this.opts.now() };
      this.queued = request;
      void this.decoding.then(() => {
        if (this.queued !== request) return;
        this.queued = null;
        const buf = this.decoded.get(event);
        // Played late, so it is time-stamped with its request time and cannot
        // swallow the sound of an action that follows right after.
        if (buf && this.opts.now() - request.at <= LATE_MS) this.start(event, buf, request.at);
      });
      return true;
    }

    const now = this.opts.now();
    const last = this.lastPlayed.get(event) ?? -Infinity;
    if (now - last < (MIN_GAP_MS[event] ?? 0)) return false;
    if (now - this.lastAnyPlayed < ACTION_WINDOW_MS) return false;
    return this.start(event, buffer, now);
  }

  private start(event: SoundEvent, buffer: unknown, stamp: number): boolean {
    if (!this.ctx || !this.master) return false;
    const now = stamp;
    try {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.master);
      src.onended = () => {
        src.onended = null;
        src.disconnect();
      };
      src.start();
      this.lastPlayed.set(event, now);
      this.lastAnyPlayed = now;
      return true;
    } catch {
      return false;
    }
  }
}

let shared: AudioManager | null = null;

/** Lazily created app-wide instance. */
export function getAudioManager(): AudioManager {
  shared ??= new AudioManager();
  return shared;
}

/**
 * Background music (audio3.mp3), always on, looping, no user controls.
 *
 * - Streams through an <audio> element (a multi-minute track decoded into
 *   Web Audio would cost tens of MB of RAM).
 * - Starts only after the first user gesture (autoplay policy).
 * - The file is loaded as a Blob and played from an object URL, so it also
 *   works offline from the service-worker cache (media elements send Range
 *   requests that a precache would not answer with 206 on every browser).
 * - Pauses while the page is hidden and resumes when it is visible again.
 * - Any failure leaves the game silent but fully playable.
 */
import musicUrl from '../../audio3.mp3';

/** Kept below the sound-effect level so card sounds stay clearly audible. */
export const MUSIC_VOLUME = 0.28;

export interface MediaLike {
  src: string;
  loop: boolean;
  volume: number;
  preload: string;
  paused: boolean;
  play(): Promise<void> | void;
  pause(): void;
}

export interface MusicOptions {
  url?: string;
  createElement?: () => MediaLike | null;
  loadBlobUrl?: (url: string) => Promise<string>;
  doc?: Pick<Document, 'visibilityState' | 'addEventListener'>;
}

async function defaultLoadBlobUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

function defaultCreateElement(): MediaLike | null {
  try {
    return typeof Audio === 'undefined' ? null : new Audio();
  } catch {
    return null;
  }
}

export class MusicManager {
  private el: MediaLike | null = null;
  private started = false;
  private loading: Promise<void> | null = null;
  private readonly opts: Required<MusicOptions>;

  constructor(options: MusicOptions = {}) {
    this.opts = {
      url: options.url ?? musicUrl,
      createElement: options.createElement ?? defaultCreateElement,
      loadBlobUrl: options.loadBlobUrl ?? defaultLoadBlobUrl,
      doc: options.doc ?? document,
    };
    this.opts.doc.addEventListener('visibilitychange', () => this.syncVisibility());
  }

  private ensureElement(): MediaLike | null {
    if (this.el) return this.el;
    const el = this.opts.createElement();
    if (!el) return null;
    el.loop = true;
    el.volume = MUSIC_VOLUME;
    el.preload = 'auto';
    this.el = el;
    this.loading = this.opts
      .loadBlobUrl(this.opts.url)
      .catch(() => this.opts.url) // fall back to streaming the URL directly
      .then((src) => {
        el.src = src;
      });
    return el;
  }

  private tryPlay(): void {
    const el = this.el;
    if (!el || !this.started || this.opts.doc.visibilityState === 'hidden') return;
    try {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } catch {
      /* unsupported / blocked: stay silent */
    }
  }

  /** Call from a user-gesture handler. Safe to call repeatedly. */
  start(): void {
    if (!this.ensureElement()) return;
    if (this.started && !this.el?.paused) return;
    this.started = true;
    void this.loading?.then(() => this.tryPlay());
  }

  private syncVisibility(): void {
    if (!this.el || !this.started) return;
    if (this.opts.doc.visibilityState === 'hidden') this.el.pause();
    else this.tryPlay();
  }

  isPlaying(): boolean {
    return !!this.el && !this.el.paused;
  }
}

let shared: MusicManager | null = null;

export function getMusicManager(): MusicManager {
  shared ??= new MusicManager();
  return shared;
}

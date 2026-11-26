import { describe, expect, it, vi } from 'vitest';
import { MusicManager, MUSIC_VOLUME, type MediaLike } from '../audio/musicManager';
import { MASTER_VOLUME } from '../audio/audioManager';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { blobFails?: boolean; playRejects?: boolean; noAudio?: boolean } = {}) {
  const listeners: Record<string, () => void> = {};
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
  };
  const el: MediaLike = {
    src: '',
    loop: false,
    volume: 1,
    preload: 'none',
    paused: true,
    play: vi.fn(() => {
      if (opts.playRejects) return Promise.reject(new Error('NotAllowedError'));
      el.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      el.paused = true;
    }),
  };
  const createElement = vi.fn(() => (opts.noAudio ? null : el));
  const m = new MusicManager({
    url: '/audio3.mp3',
    createElement,
    doc: doc as unknown as Pick<Document, 'visibilityState' | 'addEventListener'>,
    loadBlobUrl: async () => {
      if (opts.blobFails) throw new Error('offline');
      return 'blob:music';
    },
  });
  return { m, el, doc, listeners, createElement };
}

describe('background music', () => {
  it('does nothing before the first user gesture', () => {
    const { createElement, el } = setup();
    expect(createElement).not.toHaveBeenCalled();
    expect(el.play).not.toHaveBeenCalled();
  });

  it('starts looping at a volume below the sound effects after the first gesture', async () => {
    const { m, el } = setup();
    m.start();
    await flush();
    expect(el.src).toBe('blob:music');
    expect(el.loop).toBe(true);
    expect(el.volume).toBe(MUSIC_VOLUME);
    expect(MUSIC_VOLUME).toBeLessThan(MASTER_VOLUME);
    expect(m.isPlaying()).toBe(true);
  });

  it('does not restart on later gestures while already playing', async () => {
    const { m, el } = setup();
    m.start();
    await flush();
    m.start();
    m.start();
    await flush();
    expect(el.play).toHaveBeenCalledTimes(1);
  });

  it('pauses while the page is hidden and resumes when visible', async () => {
    const { m, el, doc, listeners } = setup();
    m.start();
    await flush();
    doc.visibilityState = 'hidden';
    listeners.visibilitychange();
    expect(el.paused).toBe(true);
    doc.visibilityState = 'visible';
    listeners.visibilitychange();
    expect(el.paused).toBe(false);
  });

  it('falls back to the plain URL if the blob cannot be loaded', async () => {
    const { m, el } = setup({ blobFails: true });
    m.start();
    await flush();
    expect(el.src).toBe('/audio3.mp3');
  });

  it('never throws when playback is blocked or audio is unsupported', async () => {
    const blocked = setup({ playRejects: true });
    expect(() => blocked.m.start()).not.toThrow();
    await flush();
    expect(blocked.m.isPlaying()).toBe(false);
    const none = setup({ noAudio: true });
    expect(() => none.m.start()).not.toThrow();
    expect(none.m.isPlaying()).toBe(false);
  });
});

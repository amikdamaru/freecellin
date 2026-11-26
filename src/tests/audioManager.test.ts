import { describe, expect, it, vi } from 'vitest';
import { AudioManager, MASTER_VOLUME, type AudioContextLike } from '../audio/audioManager';
import { SoundEvent, SOUND_SOURCES, soundForMove } from '../audio/soundEvents';

const EVENTS = Object.values(SoundEvent);
const sources = Object.fromEntries(EVENTS.map((e) => [e, `/${e}.wav`])) as Record<SoundEvent, string>;

function fakeContext() {
  const started: unknown[] = [];
  let gainValue = -1;
  const ctx: AudioContextLike & { state: string } = {
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ decodedFrom: new TextDecoder().decode(data) })),
    createBufferSource: () => {
      const src = {
        buffer: null as unknown,
        connect: () => undefined,
        disconnect: vi.fn(),
        start: () => started.push(src.buffer),
        onended: null as (() => void) | null,
      };
      return src;
    },
    createGain: () => ({
      gain: {
        get value() {
          return gainValue;
        },
        set value(v: number) {
          gainValue = v;
        },
      },
      connect: () => undefined,
    }),
  };
  return { ctx, started, gain: () => gainValue };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function readyManager(opts: { fetchFails?: SoundEvent[]; now?: () => number } = {}) {
  const fake = fakeContext();
  const createContext = vi.fn(() => fake.ctx);
  const m = new AudioManager({
    sources,
    createContext,
    now: opts.now ?? (() => 0),
    fetchArrayBuffer: async (url) => {
      if (opts.fetchFails?.some((e) => url.includes(e))) throw new Error('404');
      return new TextEncoder().encode(url).buffer as ArrayBuffer;
    },
  });
  m.unlock();
  await flush();
  await flush();
  return { m, ...fake, createContext };
}

describe('sound files', () => {
  it('uses a different file for every event (five required + win)', () => {
    const files = EVENTS.map((e) => SOUND_SOURCES[e]);
    expect(new Set(files).size).toBe(EVENTS.length);
    expect(EVENTS).toEqual(expect.arrayContaining(['CARD_SELECTED', 'CARD_ARRANGED', 'CARD_MOVED', 'CARD_TO_FOUNDATION', 'INVALID_MOVE']));
  });

  it('maps move kinds to exactly one sound category', () => {
    expect(soundForMove('foundation')).toBe(SoundEvent.CARD_TO_FOUNDATION);
    expect(soundForMove('arrange')).toBe(SoundEvent.CARD_ARRANGED);
    expect(soundForMove('move')).toBe(SoundEvent.CARD_MOVED);
  });
});

describe('AudioManager', () => {
  it('plays nothing before the first user gesture (autoplay policy)', async () => {
    const fake = fakeContext();
    const createContext = vi.fn(() => fake.ctx);
    const m = new AudioManager({ sources, createContext, fetchArrayBuffer: async () => new ArrayBuffer(4) });
    await flush();
    expect(m.play(SoundEvent.CARD_SELECTED)).toBe(false);
    expect(createContext).not.toHaveBeenCalled();
  });

  it('creates/resumes the context on unlock, sets the fixed volume and plays the right buffer', async () => {
    let t = 0;
    const { m, ctx, started, gain } = await readyManager({ now: () => (t += 1000) });
    expect(ctx.resume).toHaveBeenCalled();
    expect(gain()).toBe(MASTER_VOLUME);
    for (const e of EVENTS) expect(m.play(e)).toBe(true);
    expect(started).toEqual(EVENTS.map((e) => ({ decodedFrom: `/${e}.wav` })));
  });

  it('never plays two sounds for one action', async () => {
    const { m, started } = await readyManager({ now: () => 5000 });
    expect(m.play(SoundEvent.CARD_MOVED)).toBe(true);
    expect(m.play(SoundEvent.CARD_ARRANGED)).toBe(false);
    expect(started.length).toBe(1);
  });

  it('throttles rapid foundation sounds (Auto Complete does not stack)', async () => {
    let t = 0;
    const { m, started } = await readyManager({ now: () => t });
    const results: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      t = i * 30; // faster than the minimum gap
      results.push(m.play(SoundEvent.CARD_TO_FOUNDATION));
    }
    expect(started.length).toBeLessThan(10);
    expect(started.length).toBeGreaterThanOrEqual(3);
    // At the auto-complete pace (140 ms) every card gets its sound.
    t = 10_000;
    const before = started.length;
    for (let i = 0; i < 5; i++) {
      t += 140;
      m.play(SoundEvent.CARD_TO_FOUNDATION);
    }
    expect(started.length - before).toBe(5);
    expect(results[0]).toBe(true);
  });

  it('stays silent but does not throw when a file fails to load', async () => {
    let t = 0;
    const { m } = await readyManager({ fetchFails: ['INVALID_MOVE'], now: () => (t += 1000) });
    expect(() => m.play(SoundEvent.INVALID_MOVE)).not.toThrow();
    expect(m.play(SoundEvent.INVALID_MOVE)).toBe(false);
    expect(m.play(SoundEvent.CARD_MOVED)).toBe(true);
  });

  it('degrades to silence when Web Audio is unsupported', async () => {
    const m = new AudioManager({ sources, createContext: () => null, fetchArrayBuffer: async () => new ArrayBuffer(4) });
    expect(() => m.unlock()).not.toThrow();
    expect(m.play(SoundEvent.CARD_MOVED)).toBe(false);
  });

  it('survives a context that throws on playback', async () => {
    let t = 0;
    const { m, ctx } = await readyManager({ now: () => (t += 1000) });
    ctx.createBufferSource = () => {
      throw new Error('boom');
    };
    expect(m.play(SoundEvent.CARD_MOVED)).toBe(false);
  });

  it('on the first gesture, plays only the latest sound requested while files decode', async () => {
    const fake = fakeContext();
    let t = 0;
    const m = new AudioManager({
      sources,
      createContext: () => fake.ctx,
      now: () => t,
      fetchArrayBuffer: async (url) => new TextEncoder().encode(url).buffer as ArrayBuffer,
    });
    m.unlock(); // decoding starts now
    expect(m.play(SoundEvent.CARD_SELECTED)).toBe(true); // queued
    t = 40;
    expect(m.play(SoundEvent.CARD_MOVED)).toBe(true); // replaces the queued select
    await flush();
    await flush();
    expect(fake.started).toEqual([{ decodedFrom: '/CARD_MOVED.wav' }]);
  });

  it('is silent while suppressed', async () => {
    let t = 0;
    const { m } = await readyManager({ now: () => (t += 1000) });
    m.setSuppressed(true);
    expect(m.play(SoundEvent.CARD_MOVED)).toBe(false);
    m.setSuppressed(false);
    expect(m.play(SoundEvent.CARD_MOVED)).toBe(true);
  });
});

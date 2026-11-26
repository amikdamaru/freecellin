/**
 * Generates the game's original sound effects as small 16-bit mono WAV files.
 * Everything is synthesised procedurally (filtered noise + decaying partials),
 * so there are no third-party audio assets or licences involved.
 *
 *   node scripts/generate-sounds.mjs
 *
 * Output: src/audio/sounds/*.wav (committed; this script is only needed to re-tune them).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'audio', 'sounds');

// Deterministic noise so regenerated files are byte-identical.
let seed = 12345;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

/** RBJ biquad filter, applied in place. */
function biquad(samples, type, freq, q = 0.707) {
  const w = (2 * Math.PI * freq) / RATE;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha]; // bandpass (constant peak gain)
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    samples[i] = y;
  }
  return samples;
}

/** Add a noise burst with attack/decay envelope starting at `at` seconds. */
function addNoise(out, { at = 0, dur, attack = 0.002, decay, gain = 1, filter }) {
  const n = buffer(dur);
  for (let i = 0; i < n.length; i++) n[i] = noise();
  for (const [type, f, q] of filter ?? []) biquad(n, type, f, q);
  const start = Math.floor(at * RATE);
  for (let i = 0; i < n.length && start + i < out.length; i++) {
    const t = i / RATE;
    const env = t < attack ? t / attack : Math.exp(-(t - attack) / decay);
    out[start + i] += n[i] * env * gain;
  }
}

/** Add a decaying sine partial, optionally gliding from f0 to f1. */
function addTone(out, { at = 0, dur, f0, f1 = f0, attack = 0.004, decay, gain = 1 }) {
  const start = Math.floor(at * RATE);
  const len = Math.ceil(dur * RATE);
  let phase = 0;
  for (let i = 0; i < len && start + i < out.length; i++) {
    const t = i / RATE;
    const f = f0 * Math.pow(f1 / f0, Math.min(1, t / dur));
    phase += (2 * Math.PI * f) / RATE;
    const env = t < attack ? t / attack : Math.exp(-(t - attack) / decay);
    out[start + i] += Math.sin(phase) * env * gain;
  }
}

/** A soft bell: fundamental plus a few inharmonic partials. */
function addBell(out, { at, freq, gain, decay = 0.35, dur = 0.6 }) {
  addTone(out, { at, dur, f0: freq, decay, gain });
  addTone(out, { at, dur, f0: freq * 2.01, decay: decay * 0.5, gain: gain * 0.25 });
  addTone(out, { at, dur, f0: freq * 3.02, decay: decay * 0.3, gain: gain * 0.08 });
}

function normalise(samples, peak) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const k = max > 0 ? peak / max : 0;
  // Short fade-out to avoid clicks at the end.
  const fade = Math.min(samples.length, Math.floor(0.008 * RATE));
  for (let i = 0; i < samples.length; i++) {
    const tail = samples.length - i;
    samples[i] *= k * (tail < fade ? tail / fade : 1);
  }
  return samples;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const sounds = {
  // Very short, soft tick: a tiny bright click.
  'card-select': () => {
    const out = buffer(0.05);
    addNoise(out, { dur: 0.03, attack: 0.0008, decay: 0.006, gain: 0.6, filter: [['bandpass', 3800, 1.2]] });
    addTone(out, { dur: 0.04, f0: 1650, attack: 0.001, decay: 0.012, gain: 0.35 });
    return normalise(out, 0.5);
  },
  // Card slid across felt, then lightly set down: airy swish with a small landing tap.
  'card-move': () => {
    const out = buffer(0.2);
    addNoise(out, { dur: 0.16, attack: 0.05, decay: 0.035, gain: 0.7, filter: [['bandpass', 2400, 0.6], ['highpass', 900]] });
    addNoise(out, { at: 0.11, dur: 0.06, attack: 0.001, decay: 0.012, gain: 0.5, filter: [['lowpass', 1800]] });
    return normalise(out, 0.7);
  },
  // Card neatly placed onto another card: rounder, woody "tock" with no slide.
  'card-arrange': () => {
    const out = buffer(0.14);
    addNoise(out, { dur: 0.05, attack: 0.0008, decay: 0.009, gain: 0.8, filter: [['lowpass', 2600], ['highpass', 200]] });
    addTone(out, { dur: 0.12, f0: 330, f1: 260, attack: 0.001, decay: 0.03, gain: 0.55 });
    addTone(out, { at: 0.003, dur: 0.06, f0: 740, attack: 0.001, decay: 0.012, gain: 0.18 });
    return normalise(out, 0.72);
  },
  // Satisfying soft two-note chime on top of a card tap.
  foundation: () => {
    const out = buffer(0.55);
    addNoise(out, { dur: 0.04, attack: 0.0008, decay: 0.008, gain: 0.35, filter: [['lowpass', 2200]] });
    addBell(out, { at: 0.0, freq: 784, gain: 0.45, decay: 0.18 }); // G5
    addBell(out, { at: 0.07, freq: 1175, gain: 0.4, decay: 0.25 }); // D6
    return normalise(out, 0.62);
  },
  // Gentle low "bonk", two soft descending tones. Not harsh.
  'invalid-move': () => {
    const out = buffer(0.24);
    addTone(out, { dur: 0.1, f0: 240, f1: 220, attack: 0.004, decay: 0.045, gain: 0.6 });
    addTone(out, { at: 0.09, dur: 0.14, f0: 185, f1: 165, attack: 0.004, decay: 0.05, gain: 0.55 });
    addTone(out, { dur: 0.22, f0: 480, f1: 330, attack: 0.003, decay: 0.03, gain: 0.08 });
    return normalise(out, 0.55);
  },
  // Short victory arpeggio (C major).
  win: () => {
    const out = buffer(1.3);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => addBell(out, { at: i * 0.11, freq: f, gain: 0.4, decay: 0.45, dur: 1.0 }));
    return normalise(out, 0.6);
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  const wav = toWav(make());
  writeFileSync(join(OUT, `${name}.wav`), wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} KB`);
}

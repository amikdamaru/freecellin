/**
 * Generates the PWA icons (PNG) without any image library:
 * an ivory tile with a classic card showing a spade, rasterised from implicit
 * shapes with 4x4 supersampling, then PNG-encoded with node:zlib.
 *
 *   node scripts/generate-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const IVORY = [245, 240, 230];
const SAGE = [226, 234, 222];
const CARD = [255, 252, 245];
const EDGE = [214, 205, 188];
const INK = [43, 44, 51];

function roundedRect(x, y, cx, cy, w, h, r) {
  const dx = Math.max(Math.abs(x - cx) - w / 2 + r, 0);
  const dy = Math.max(Math.abs(y - cy) - h / 2 + r, 0);
  return Math.hypot(dx, dy) - r; // <0 inside
}

/** Spade in unit coords (u right, v down), centred near the origin. */
function inSpade(u, v) {
  // Upside-down heart: (x^2 + y^2 - 1)^3 - x^2 y^3 <= 0 with y flipped.
  const x = u * 1.15;
  const y = v * 1.15 + 0.15;
  const a = x * x + y * y - 1;
  if (a * a * a - x * x * y * y * y <= 0) return true;
  // Stem: a flared triangle below the body.
  if (v > 0.35 && v < 1.05) {
    const half = 0.07 + (v - 0.35) * 0.42;
    if (Math.abs(u) < half) return true;
  }
  return false;
}

function render(size, { maskable }) {
  const px = new Uint8Array(size * size * 4);
  const S = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < S; sj++) {
        for (let si = 0; si < S; si++) {
          const x = (i + (si + 0.5) / S) / size; // 0..1
          const y = (j + (sj + 0.5) / S) / size;
          let c = null;
          // Background tile (full bleed for maskable, rounded otherwise).
          const tile = maskable ? -1 : roundedRect(x, y, 0.5, 0.5, 1, 1, 0.22);
          if (tile <= 0) c = maskable ? IVORY : SAGE;
          // Card (kept inside the maskable safe zone: central 80%).
          const scale = maskable ? 0.72 : 0.9;
          const cw = 0.52 * scale, ch = 0.72 * scale;
          const d = roundedRect(x, y, 0.5, 0.5, cw, ch, 0.06 * scale);
          if (d <= 0) c = d > -0.012 * scale ? EDGE : CARD;
          if (d <= -0.012 * scale) {
            const u = (x - 0.5) / (0.17 * scale);
            const v = (y - 0.47) / (0.17 * scale);
            if (inSpade(u, v)) c = INK;
          }
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 255;
          }
        }
      }
      const n = S * S;
      const k = (j * size + i) * 4;
      const cov = a / 255;
      px[k] = cov ? Math.round(r / cov) : 0;
      px[k + 1] = cov ? Math.round(g / cov) : 0;
      px[k + 2] = cov ? Math.round(b / cov) : 0;
      px[k + 3] = Math.round(a / n);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['pwa-192.png', 192, false],
  ['pwa-512.png', 512, false],
  ['pwa-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [name, size, maskable] of targets) {
  writeFileSync(join(OUT, name), png(size, render(size, { maskable })));
  console.log(`${name} ${size}x${size}`);
}

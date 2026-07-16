#!/usr/bin/env node
// Dependency-free PNG generator for Signal's app assets.
// Draws the brand mark (ascending "signal" bars in accent blue on the dark bg)
// and writes icon / adaptive-icon / splash / favicon PNGs.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Brand colors (must match src/theme).
const BG = [0x0a, 0x0b, 0x0d, 0xff];
const ACCENT = [0x4f, 0x8c, 0xff, 0xff];
const ACCENT_DIM = [0x1e, 0x2b, 0x45, 0xff];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (width * 4 + 1) + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size, { transparentBg = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = c[0];
    rgba[i + 1] = c[1];
    rgba[i + 2] = c[2];
    rgba[i + 3] = c[3];
  };
  // Background
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) put(x, y, transparentBg ? [0, 0, 0, 0] : BG);

  // Three ascending bars centered in the canvas.
  const bars = 3;
  const gap = Math.round(size * 0.05);
  const barW = Math.round(size * 0.14);
  const totalW = bars * barW + (bars - 1) * gap;
  const startX = Math.round((size - totalW) / 2);
  const baseY = Math.round(size * 0.72);
  const heights = [0.22, 0.34, 0.46].map((h) => Math.round(size * h));
  for (let b = 0; b < bars; b++) {
    const x0 = startX + b * (barW + gap);
    const h = heights[b];
    const color = b === bars - 1 ? ACCENT : ACCENT_DIM;
    for (let y = baseY - h; y < baseY; y++)
      for (let x = x0; x < x0 + barW; x++) put(x, y, b === bars - 1 ? ACCENT : color);
  }
  // Accent dot above the tallest bar (the "signal").
  const dotR = Math.round(size * 0.05);
  const dotCx = startX + (bars - 1) * (barW + gap) + Math.round(barW / 2);
  const dotCy = baseY - heights[bars - 1] - Math.round(size * 0.08);
  for (let y = -dotR; y <= dotR; y++)
    for (let x = -dotR; x <= dotR; x++)
      if (x * x + y * y <= dotR * dotR) put(dotCx + x, dotCy + y, ACCENT);

  return rgba;
}

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const outputs = [
  { name: 'icon.png', size: 1024, opts: {} },
  { name: 'adaptive-icon.png', size: 1024, opts: { transparentBg: true } },
  { name: 'splash-icon.png', size: 512, opts: { transparentBg: true } },
  { name: 'favicon.png', size: 64, opts: {} },
];

for (const o of outputs) {
  const png = encodePng(o.size, o.size, draw(o.size, o.opts));
  fs.writeFileSync(path.join(assetsDir, o.name), png);
  console.log(`wrote assets/${o.name} (${o.size}x${o.size}, ${png.length} bytes)`);
}

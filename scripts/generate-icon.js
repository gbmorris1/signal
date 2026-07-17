#!/usr/bin/env node
// Dependency-free PNG generator for ODDIQ's app assets.
// Rebuilds the brand mark (hexagonal "O" + ascending arrow) as filled polygons
// on the deep-navy field, and writes icon / adaptive-icon / splash / favicon.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Brand colors (must match src/theme).
const NAVY = [0x0e, 0x1e, 0x45, 0xff]; // icon field + hexagon
const NAVY_LT = [0x1b, 0x2f, 0x63, 0xff]; // hexagon highlight facet
const BLUE = [0x1e, 0x6f, 0xd9, 0xff];
const CYAN = [0x22, 0xc9, 0xf5, 0xff];

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
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
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
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Even-odd polygon fill. pts are [x,y] in 0..100 design space.
function fillPoly(rgba, size, pts, color) {
  const scale = size / 100;
  const P = pts.map(([x, y]) => [x * scale, y * scale]);
  let minY = size,
    maxY = 0;
  for (const [, y] of P) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.max(0, Math.floor(minY)); y < Math.min(size, Math.ceil(maxY)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i];
      const [xj, yj] = P[j];
      if (yi > yc !== yj > yc) {
        xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x < Math.min(size, Math.ceil(xs[k + 1])); x++) {
        const idx = (y * size + x) * 4;
        rgba[idx] = color[0];
        rgba[idx + 1] = color[1];
        rgba[idx + 2] = color[2];
        rgba[idx + 3] = color[3];
      }
    }
  }
}

function roundedField(rgba, size, color) {
  const r = size * 0.22; // iOS-style rounded square
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      const cx = x < r ? r : x > size - r ? size - r : x;
      const cy = y < r ? r : y > size - r ? size - r : y;
      if ((x < r || x > size - r) && (y < r || y > size - r)) {
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      }
      if (inside) {
        const i = (y * size + x) * 4;
        rgba[i] = color[0];
        rgba[i + 1] = color[1];
        rgba[i + 2] = color[2];
        rgba[i + 3] = color[3];
      }
    }
  }
}

// The ODDIQ mark, centered in 0..100 design space (matches BrandMark.tsx).
function drawMark(rgba, size) {
  // Hexagonal "O" (open on the right)
  fillPoly(rgba, size, [[34, 16], [14, 28], [14, 52], [34, 64], [44, 58], [26, 48], [26, 32], [44, 22]], NAVY_LT);
  // Arrow shaft facets
  fillPoly(rgba, size, [[40, 70], [54, 44], [62, 49], [48, 75]], BLUE);
  fillPoly(rgba, size, [[52, 60], [66, 34], [74, 39], [60, 65]], CYAN);
  // Arrowhead
  fillPoly(rgba, size, [[66, 20], [86, 26], [74, 44], [70, 34], [58, 40]], CYAN);
}

function draw(size, { field = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4); // transparent
  if (field) roundedField(rgba, size, NAVY);
  drawMark(rgba, size);
  return rgba;
}

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const outputs = [
  { name: 'icon.png', size: 1024, opts: { field: true } },
  { name: 'adaptive-icon.png', size: 1024, opts: { field: false } },
  { name: 'splash-icon.png', size: 512, opts: { field: false } },
  { name: 'favicon.png', size: 64, opts: { field: true } },
];

for (const o of outputs) {
  const png = encodePng(o.size, o.size, draw(o.size, o.opts));
  fs.writeFileSync(path.join(assetsDir, o.name), png);
  console.log(`wrote assets/${o.name} (${o.size}x${o.size}, ${png.length} bytes)`);
}

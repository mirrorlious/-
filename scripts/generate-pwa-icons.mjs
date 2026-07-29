import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const outputDir = path.join(root, 'public', 'icons');
fs.mkdirSync(outputDir, { recursive: true });

const palette = {
  cream: [247, 243, 234, 255],
  paper: [255, 253, 247, 255],
  ink: [35, 45, 55, 255],
  red: [159, 52, 49, 255],
  gold: [194, 151, 70, 255]
};

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let k = 0; k < 8; k += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[n] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createCanvas(size, color) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const offset = index * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }
  return { size, pixels };
}

function setPixel(canvas, x, y, color) {
  const { size, pixels } = canvas;
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (Math.floor(y) * size + Math.floor(x)) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const right = Math.ceil(x + width);
  const bottom = Math.ceil(y + height);
  const r = Math.max(0, radius);

  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      const nearestX = Math.max(x + r, Math.min(px + 0.5, x + width - r));
      const nearestY = Math.max(y + r, Math.min(py + 0.5, y + height - r));
      const dx = px + 0.5 - nearestX;
      const dy = py + 0.5 - nearestY;
      if ((dx * dx) + (dy * dy) <= r * r) setPixel(canvas, px, py, color);
    }
  }
}

function fillPolygon(canvas, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map(([, y]) => y))));
  const maxY = Math.min(canvas.size - 1, Math.ceil(Math.max(...points.map(([, y]) => y))));

  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const [x1, y1] = points[index];
      const [x2, y2] = points[(index + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index < intersections.length; index += 2) {
      const start = Math.ceil(intersections[index]);
      const end = Math.floor(intersections[index + 1] ?? intersections[index]);
      for (let x = start; x <= end; x += 1) setPixel(canvas, x, y, color);
    }
  }
}

function drawIcon(size, { maskable = false } = {}) {
  const canvas = createCanvas(size, palette.cream);
  const inset = maskable ? size * 0.18 : size * 0.08;
  const cardRadius = size * 0.2;

  fillRoundedRect(canvas, inset, inset, size - inset * 2, size - inset * 2, cardRadius, palette.ink);

  const bookLeft = size * (maskable ? 0.29 : 0.22);
  const bookRight = size * (maskable ? 0.71 : 0.78);
  const bookTop = size * (maskable ? 0.33 : 0.28);
  const bookBottom = size * (maskable ? 0.69 : 0.74);
  const center = size * 0.5;
  const gutter = size * 0.018;

  fillPolygon(canvas, [
    [bookLeft, bookTop],
    [center - gutter, bookTop + size * 0.055],
    [center - gutter, bookBottom],
    [bookLeft, bookBottom - size * 0.055]
  ], palette.paper);

  fillPolygon(canvas, [
    [center + gutter, bookTop + size * 0.055],
    [bookRight, bookTop],
    [bookRight, bookBottom - size * 0.055],
    [center + gutter, bookBottom]
  ], palette.paper);

  fillRoundedRect(canvas, center - size * 0.012, bookTop + size * 0.04, size * 0.024, bookBottom - bookTop - size * 0.035, size * 0.012, palette.gold);

  const bookmarkWidth = size * 0.075;
  const bookmarkTop = bookTop - size * 0.025;
  const bookmarkBottom = bookBottom - size * 0.04;
  fillPolygon(canvas, [
    [bookRight - size * 0.13, bookmarkTop],
    [bookRight - size * 0.13 + bookmarkWidth, bookmarkTop],
    [bookRight - size * 0.13 + bookmarkWidth, bookmarkBottom],
    [bookRight - size * 0.13 + bookmarkWidth / 2, bookmarkBottom - size * 0.035],
    [bookRight - size * 0.13, bookmarkBottom]
  ], palette.red);

  return canvas;
}

function encodePng(canvas) {
  const { size, pixels } = canvas;
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    chunk('IEND')
  ]);
}

const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true }
];

for (const target of targets) {
  const png = encodePng(drawIcon(target.size, { maskable: target.maskable }));
  fs.writeFileSync(path.join(outputDir, target.file), png);
  console.log(`Generated PWA icon: ${target.file}`);
}

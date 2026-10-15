const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(len, 0);

  const body = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, body, crcBuf]);
}

function createPng(width, height, pixelFn) {
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // no interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw uncompressed scanlines
  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowLen);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Draw Deep Roots Icon:
// Dark sleek background (#0E1411), rounded golden tree / root emblem (#FFC857, #9BE564, #5FE0E8)
function renderIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const rMax = Math.min(w, h) * 0.44;

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background rounded squircle / circle
  if (dist > rMax) {
    // Smooth anti-aliased edge
    if (dist < rMax + 2) {
      const alpha = Math.max(0, Math.min(255, Math.round((1 - (dist - rMax) / 2) * 255)));
      return [14, 20, 17, alpha]; // #0E1411
    }
    return [0, 0, 0, 0];
  }

  // Base background: #0E1411 with a subtle dark forest gradient
  let baseR = 14;
  let baseG = 20 + Math.round((y / h) * 6);
  let baseB = 17;

  // Outer border ring in deep forest gold (#FFC857 at 15% opacity)
  if (dist > rMax - 4) {
    return [255, 200, 87, 180];
  }

  // Center Root/Tree Network Art
  // Central core node
  const coreDist = Math.hypot(dx, dy + h * 0.04);
  if (coreDist < w * 0.08) {
    return [255, 200, 87, 255]; // Golden core (#FFC857)
  }

  // 3 Upper nodes (Knowledge branches: Culture, Tech, Language)
  const node1 = Math.hypot(dx + w * 0.18, dy + h * 0.2);
  const node2 = Math.hypot(dx, dy + h * 0.28);
  const node3 = Math.hypot(dx - w * 0.18, dy + h * 0.2);

  if (node1 < w * 0.05) return [95, 224, 232, 255]; // Cyan / Tech
  if (node2 < w * 0.05) return [212, 165, 255, 255]; // Purple / Language
  if (node3 < w * 0.05) return [255, 155, 122, 255]; // Coral / Culture

  // 3 Lower root nodes (Origins, Money, Mind & Body)
  const root1 = Math.hypot(dx + w * 0.16, dy - h * 0.2);
  const root2 = Math.hypot(dx, dy - h * 0.26);
  const root3 = Math.hypot(dx - w * 0.16, dy - h * 0.2);

  if (root1 < w * 0.05) return [155, 229, 100, 255]; // Green / Origins
  if (root2 < w * 0.05) return [255, 200, 87, 255]; // Gold / Money
  if (root3 < w * 0.05) return [122, 184, 255, 255]; // Blue / Mind

  // Connecting lines / branches (test distance to segments)
  function distToSeg(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  const dCore = { x: cx, y: cy - h * 0.04 };
  const dN1 = { x: cx - w * 0.18, y: cy - h * 0.2 };
  const dN2 = { x: cx, y: cy - h * 0.28 };
  const dN3 = { x: cx + w * 0.18, y: cy - h * 0.2 };

  const dR1 = { x: cx - w * 0.16, y: cy + h * 0.2 };
  const dR2 = { x: cx, y: cy + h * 0.26 };
  const dR3 = { x: cx + w * 0.16, y: cy + h * 0.2 };

  const lw = Math.max(2, w * 0.018);
  const segs = [
    distToSeg(x, y, dCore.x, dCore.y, dN1.x, dN1.y),
    distToSeg(x, y, dCore.x, dCore.y, dN2.x, dN2.y),
    distToSeg(x, y, dCore.x, dCore.y, dN3.x, dN3.y),
    distToSeg(x, y, dCore.x, dCore.y, dR1.x, dR1.y),
    distToSeg(x, y, dCore.x, dCore.y, dR2.x, dR2.y),
    distToSeg(x, y, dCore.x, dCore.y, dR3.x, dR3.y),
    distToSeg(x, y, dN1.x, dN1.y, dN2.x, dN2.y),
    distToSeg(x, y, dN2.x, dN2.y, dN3.x, dN3.y),
  ];

  const minD = Math.min(...segs);
  if (minD < lw) {
    const alpha = Math.max(0, Math.min(1, 1 - minD / lw));
    const gold = [255, 200, 87];
    return [
      Math.round(baseR * (1 - alpha) + gold[0] * alpha),
      Math.round(baseG * (1 - alpha) + gold[1] * alpha),
      Math.round(baseB * (1 - alpha) + gold[2] * alpha),
      255,
    ];
  }

  return [baseR, baseG, baseB, 255];
}

const publicDir = path.join(__dirname, '..', 'public');

console.log('Generating PWA icons...');
const icon192 = createPng(192, 192, renderIcon);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
console.log('Created icon-192.png');

const icon512 = createPng(512, 512, renderIcon);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
fs.writeFileSync(path.join(publicDir, 'icon.png'), icon512);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), icon192);
console.log('Created icon-512.png, icon.png, and apple-touch-icon.png');

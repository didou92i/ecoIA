import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let tableIndex = 0; tableIndex < crcTable.length; tableIndex += 1) {
  let value = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[tableIndex] = value >>> 0;
}

function crc32(content) {
  let value = 0xffffffff;
  for (const byte of content) {
    value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), data.length + 8);
  return chunk;
}

function isInsideRoundedSquare(x, y, size) {
  const inset = size * 0.08;
  const radius = size * 0.24;
  const nearestX = Math.max(inset + radius, Math.min(x, size - inset - radius));
  const nearestY = Math.max(inset + radius, Math.min(y, size - inset - radius));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function iconPixel(x, y, size) {
  if (!isInsideRoundedSquare(x, y, size)) {
    return [0, 0, 0, 0];
  }

  const normalizedX = x / size;
  const normalizedY = y / size;
  const ringDistance = Math.hypot(normalizedX - 0.49, normalizedY - 0.54);
  const ring = ringDistance >= 0.18 && ringDistance <= 0.29;
  const crossbar =
    normalizedX >= 0.44 && normalizedX <= 0.74 && normalizedY >= 0.49 && normalizedY <= 0.58;
  const leaf = Math.hypot(normalizedX - 0.67, normalizedY - 0.28) <= 0.13 && normalizedY < 0.36;

  if (ring || crossbar) {
    return [244, 250, 248, 255];
  }
  if (leaf) {
    return [94, 234, 165, 255];
  }
  return [13, 65, 67, 255];
}

function createPng(size) {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = iconPixel(x + 0.5, y + 0.5, size);
      const pixelOffset = rowOffset + 1 + x * 4;
      scanlines[pixelOffset] = pixel[0];
      scanlines[pixelOffset + 1] = pixel[1];
      scanlines[pixelOffset + 2] = pixel[2];
      scanlines[pixelOffset + 3] = pixel[3];
    }
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
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function generateIcons(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await writeFile(path.join(outputDirectory, `icon-${size}.png`), createPng(size));
  }
}

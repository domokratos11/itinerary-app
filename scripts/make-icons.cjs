/* eslint-disable @typescript-eslint/no-require-imports */
// Writes the app icons as plain PNG files (solid brand green). Run once:
//   node scripts/make-icons.cjs
// Replace public/icon-*.png with real artwork later; the names stay the same.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const GREEN = [22, 163, 74]; // #16a34a, the primary colour in globals.css

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function solidPng(size) {
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row.set(GREEN, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, "..", "public");
for (const size of [180, 192, 512]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  fs.writeFileSync(path.join(out, name), solidPng(size));
  console.log("wrote", name);
}

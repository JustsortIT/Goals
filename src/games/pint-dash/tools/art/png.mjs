/**
 * Just enough PNG reading and writing to put a sprite on a bigger canvas, so the project
 * needs no image library. Handles what PixelLab returns: 8-bit RGBA, not interlaced.
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = 4;

/** Returns `{ width, height, pixels }`, where `pixels` is RGBA bytes, row by row. */
export function decodePng(file) {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG file.');

  let header = null;
  const compressed = [];
  for (let offset = 8; offset < file.length;) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === 'IDAT') {
      compressed.push(body);
    }
    offset += 12 + length;
  }
  if (!header || header.depth !== 8 || header.colorType !== 6 || header.interlace !== 0) {
    throw new Error('Only 8-bit RGBA PNGs without interlacing are supported.');
  }

  // Each row is stored as a filter type followed by the row's bytes, each one written as
  // its difference from a prediction made from the bytes to the left and above.
  const { width, height } = header;
  const stride = width * CHANNELS;
  const rows = inflateSync(Buffer.concat(compressed));
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = rows[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const left = x >= CHANNELS ? pixels[y * stride + x - CHANNELS] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= CHANNELS && y > 0 ? pixels[(y - 1) * stride + x - CHANNELS] : 0;

      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const [dLeft, dUp, dUpLeft] = [left, up, upLeft].map((v) => Math.abs(estimate - v));
        predicted = dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft;
      }
      pixels[y * stride + x] = (rows[y * (stride + 1) + 1 + x] + predicted) & 255;
    }
  }
  return { width, height, pixels };
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, checksum]);
}

export function encodePng({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);

  // Filter type 0 (no prediction) on every row.
  const stride = width * CHANNELS;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Copies an image onto an empty canvas of the given size, with its top-left at `x`, `y`. */
export function placeOnCanvas(image, width, height, x, y) {
  const pixels = Buffer.alloc(width * height * CHANNELS);
  for (let row = 0; row < image.height; row++) {
    image.pixels.copy(
      pixels,
      ((y + row) * width + x) * CHANNELS,
      row * image.width * CHANNELS,
      (row + 1) * image.width * CHANNELS,
    );
  }
  return { width, height, pixels };
}

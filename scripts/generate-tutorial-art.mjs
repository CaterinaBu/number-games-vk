import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const input = path.resolve('public/assets/tutorial/guess-tutorial-complete.avif');
const output = path.resolve('public/assets/tutorial/guess-tutorial-complete-wide.webp');

const WIDTH = 1600;
const HEIGHT = 620;
const SUBJECT = 620;

const background = await sharp(input)
  .resize(WIDTH, WIDTH, { fit: 'cover', position: 'centre' })
  .extract({ left: 0, top: Math.floor((WIDTH - HEIGHT) / 2), width: WIDTH, height: HEIGHT })
  .blur(34)
  .modulate({ brightness: 1.12, saturation: 0.78 })
  .toBuffer();

const subject = await sharp(input)
  .resize(SUBJECT, SUBJECT, { fit: 'cover', position: 'centre' })
  .toBuffer();

const leftWash = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f8faff" stop-opacity="0.98"/>
      <stop offset="35%" stop-color="#f8faff" stop-opacity="0.92"/>
      <stop offset="57%" stop-color="#f8faff" stop-opacity="0.56"/>
      <stop offset="72%" stop-color="#f8faff" stop-opacity="0.16"/>
      <stop offset="84%" stop-color="#f8faff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="seam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f8faff" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#f8faff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash)"/>
  <rect x="900" y="0" width="220" height="${HEIGHT}" fill="url(#seam)"/>
</svg>
`);

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 3,
    background: '#edf4ff'
  }
})
  .composite([
    { input: background, left: 0, top: 0 },
    { input: subject, left: WIDTH - SUBJECT, top: 0 },
    { input: leftWash, left: 0, top: 0 }
  ])
  .webp({ quality: 88, effort: 5 })
  .toFile(output);

const stat = await fs.stat(output);
console.log(`Generated ${output} (${WIDTH}×${HEIGHT}, ${stat.size} bytes)`);

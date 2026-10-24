import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('assets-src/tutorial/complete');
const output = path.resolve('public/assets/tutorial/guess-tutorial-complete-v4.webp');

const partNames = [
  'part-00.b64',
  'part-01.b64',
  'part-02a.b64',
  'part-02b.b64',
  'part-03.b64',
];

const parts = await Promise.all(
  partNames.map(async (name) => (await fs.readFile(path.join(root, name), 'utf8')).trim())
);

const bytes = Buffer.from(parts.join(''), 'base64');
const hash = crypto.createHash('sha256').update(bytes).digest('hex');

if (bytes.length !== 58786) {
  throw new Error(`Unexpected completion artwork size: ${bytes.length}`);
}

if (hash !== '6be463dd59b1ad58e3e4845c55400f4d715df00b20d2a88fbd9750b2c6a9bc07') {
  throw new Error(`Completion artwork hash mismatch: ${hash}`);
}

if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
  throw new Error('Completion artwork is not a valid WebP container');
}

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, bytes);
console.log(`Restored completion artwork: ${output} (${bytes.length} bytes)`);

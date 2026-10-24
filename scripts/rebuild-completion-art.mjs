import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('assets-src/tutorial/complete');
const output = path.resolve('public/assets/tutorial/guess-tutorial-complete-built.webp');

const parts = await Promise.all(
  [0, 1, 2, 3].map(async (index) => {
    const name = `part-${String(index).padStart(2, '0')}.b64`;
    return (await fs.readFile(path.join(root, name), 'utf8')).trim();
  })
);

const bytes = Buffer.from(parts.join(''), 'base64');
const hash = crypto.createHash('sha256').update(bytes).digest('hex');

if (bytes.length !== 19592) {
  throw new Error(`Unexpected completion artwork size: ${bytes.length}`);
}

if (hash !== '6148539c6684027858f1cea8ddcbf1f4e7bf72d7b49457f8ad8b4ce2137def8a') {
  throw new Error(`Completion artwork hash mismatch: ${hash}`);
}

if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
  throw new Error('Completion artwork is not a valid WebP container');
}

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, bytes);
console.log(`Restored completion artwork: ${output} (${bytes.length} bytes)`);

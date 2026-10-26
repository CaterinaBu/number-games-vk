import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const assets = [
  {
    source: 'guess-result-0-25',
    parts: ['part-00.b64', 'part-01.b64', 'part-02.b64', 'part-03.b64'],
    output: 'guess-result-0-25-v2.webp',
    bytes: 16518,
    sha256: '2f4fd74804fc9bc0298d2f2bd6432d1cd09c88ede93cd70eb017580412ff65d5'
  },
  {
    source: 'guess-result-26-50',
    parts: ['part-00.b64', 'part-01.b64', 'part-02.b64', 'part-03.b64', 'part-04.b64'],
    output: 'guess-result-26-50-v2.webp',
    bytes: 18340,
    sha256: '969d1310676f05a9a65814f1f822cda4c2b29dd0ec50f72db1157479aea0e854'
  },
  {
    source: 'guess-result-51-75',
    parts: ['part-00.b64', 'part-01.b64', 'part-02.b64'],
    output: 'guess-result-51-75-v2.webp',
    bytes: 13038,
    sha256: 'fa26789108eec9162994b53d17ab554bda3c6b433331c707d1716ce68c769b99'
  },
  {
    source: 'guess-result-76-100',
    parts: ['part-00.b64', 'part-01.b64', 'part-02.b64', 'part-03.b64'],
    output: 'guess-result-76-100-v2.webp',
    bytes: 15302,
    sha256: 'bae7efe6b3d04dc80fc29130fc66909b585df0d01b9b68de9a906ab7d39462cf'
  },
  {
    source: 'guess-try-another',
    parts: ['part-00.b64', 'part-01.b64'],
    output: 'guess-try-another-v2.webp',
    bytes: 7146,
    sha256: '0781c9db094e9d6b3b70ea0572ab16b0b8362a079aa7f1653cd90fdb602bd6d9'
  }
];

const outputRoot = path.resolve('public/assets/results');
await fs.mkdir(outputRoot, { recursive: true });

for (const asset of assets) {
  const sourceRoot = path.resolve('assets-src/results', asset.source);
  const chunks = await Promise.all(
    asset.parts.map(async (name) => (await fs.readFile(path.join(sourceRoot, name), 'utf8')).trim())
  );
  const bytes = Buffer.from(chunks.join(''), 'base64');

  if (bytes.length !== asset.bytes) {
    throw new Error(`${asset.source}: expected ${asset.bytes} bytes, got ${bytes.length}`);
  }

  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== asset.sha256) {
    throw new Error(`${asset.source}: SHA-256 mismatch (${hash})`);
  }

  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${asset.source}: invalid WebP header`);
  }

  await fs.writeFile(path.join(outputRoot, asset.output), bytes);
  console.log(`Rebuilt ${asset.output} (${bytes.length} bytes)`);
}

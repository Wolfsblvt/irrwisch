// Writes the Workers Static Assets upload manifest for artifacts/site to stdout.
// Used by the connection-based publication route in docs/DEPLOYMENT.md, where no Wrangler credential exists.
// `_headers` is left out on purpose: its text travels in the script metadata as `assets.config._headers`.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../artifacts/site/', import.meta.url));
const manifest = {};

function walk(directory) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    const route = `/${relative(root, path).split(sep).join('/')}`;
    if (route === '/_headers') continue;
    const bytes = readFileSync(path);
    const hash = createHash('sha256').update(bytes).update(extname(path)).digest('hex').slice(0, 32);
    manifest[route] = { hash, size: bytes.length };
  }
}

walk(root);
process.stdout.write(`${JSON.stringify({ manifest }, null, 2)}\n`);

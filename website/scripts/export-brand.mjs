/**
 * Export the Irrwisch identity set from brand/source into brand/bundle and
 * copy the two projections the website serves. Deterministic; safe to rerun.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const website = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(website, '..');
const source = resolve(repo, 'brand/source/irrwisch');
const bundle = resolve(repo, 'brand/bundle/irrwisch/assets');

const exports = [
  { role: 'mark', appearance: 'universal', file: 'mark.svg', width: 512 },
  { role: 'wordmark', appearance: 'on-dark', file: 'wordmark-on-dark.svg', width: 1176 },
  { role: 'wordmark', appearance: 'on-light', file: 'wordmark-on-light.svg', width: 1176 },
];

for (const item of exports) {
  const directory = resolve(bundle, item.role);
  mkdirSync(directory, { recursive: true });
  const svg = readFileSync(resolve(source, item.file));
  writeFileSync(resolve(directory, `${item.appearance}.svg`), svg);
  await sharp(svg, { density: 300 }).resize({ width: item.width }).png().toFile(resolve(directory, `${item.appearance}.png`));
}

// Browser projections the site serves directly.
copyFileSync(resolve(source, 'mark.svg'), resolve(website, 'public/favicon.svg'));
copyFileSync(resolve(source, 'wordmark-on-dark.svg'), resolve(website, 'public/wordmark.svg'));
console.log('[brand] exported mark and wordmark to brand/bundle and website/public');

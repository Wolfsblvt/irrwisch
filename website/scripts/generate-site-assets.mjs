import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import site from '../site.config.mjs';
import publicPages from '../src/data/public-pages.mjs';
import { assetPath, assetUrl, siteBasePath } from './identity-model.mjs';
import { resolvedPages } from './site-pages.mjs';
import { renderSocialCardSvg, socialCardPath } from './social-preview-model.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(projectRoot, 'public');
const pages = resolvedPages(site, publicPages, projectRoot);
const cards = [...pages.values()].filter((page) => page.generateCard);
const cardPaths = new Set();
for (const page of cards) {
  const output = socialCardPath(page.path);
  if (cardPaths.has(output)) throw new Error(`Generated social card path collides: ${output}`);
  cardPaths.add(output);
}

rmSync(resolve(publicRoot, 'social/generated'), { recursive: true, force: true });
rmSync(resolve(publicRoot, 'manifest.webmanifest'), { force: true });
rmSync(resolve(publicRoot, 'robots.txt'), { force: true });
await generateIdentityIcons();
generateManifest();
generateRobots();
generateHeaders();
for (const page of cards) await generateCard(page);
console.log(`[assets] generated ${cards.length} social card${cards.length === 1 ? '' : 's'} with site identity assets`);

function generateManifest() {
  const install = site.identity.install;
  if (install.kind !== 'application') return;
  const required = ['id', 'startUrl', 'scope', 'name', 'shortName', 'display', 'icon192', 'icon512', 'maskable512'];
  for (const key of required) {
    if (typeof install[key] !== 'string' || !install[key].trim()) {
      throw new Error(`Application manifest needs identity.install.${key}.`);
    }
  }
  const manifest = {
    id: assetPath(site, install.id),
    start_url: assetPath(site, install.startUrl),
    scope: assetPath(site, install.scope),
    name: install.name,
    short_name: install.shortName,
    display: install.display,
    theme_color: site.identity.themeColor,
    background_color: site.identity.backgroundColor,
    lang: site.identity.defaultLanguage,
    icons: [
      { src: assetPath(site, install.icon192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: assetPath(site, install.icon512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: assetPath(site, install.maskable512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    ...(Array.isArray(install.shortcuts) && install.shortcuts.length ? { shortcuts: install.shortcuts } : {}),
  };
  writeFileSync(resolve(publicRoot, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function generateRobots() {
  if (siteBasePath(site) !== '/') {
    if (site.identity.robots !== 'origin-owned') {
      throw new Error('A subpath site needs identity.robots: origin-owned; only the origin can publish /robots.txt.');
    }
    return;
  }
  writeFileSync(resolve(publicRoot, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${assetUrl(site, '/sitemap-index.xml')}\n`, 'utf8');
}

function generateHeaders() {
  const lines = [];
  for (const page of pages.values()) {
    if (page.indexing !== 'noindex') continue;
    lines.push(page.role === 'error' ? assetPath(site, '/404.html') : `${assetPath(site, page.path)}*`);
    lines.push(`  X-Robots-Tag: ${page.role === 'legal' ? 'noindex, nosnippet' : 'noindex'}`);
  }
  writeFileSync(resolve(publicRoot, '_headers'), `${lines.join('\n')}\n`, 'utf8');
}

async function generateIdentityIcons() {
  const faviconPath = resolvePublicPath(site.identity.icons.svg);
  if (!existsSync(faviconPath)) throw new Error(`Identity icon source does not exist: ${site.identity.icons.svg}`);
  await writeRaster(site.identity.icons.raster, sharp(faviconPath).resize(192, 192).png());
  await writeRaster(site.identity.icons.touch, sharp(faviconPath).resize(180, 180).flatten({ background: site.identity.backgroundColor }).png());
  if (site.identity.install.kind === 'application') {
    await writeRaster(site.identity.install.icon192, sharp(faviconPath).resize(192, 192).flatten({ background: site.identity.backgroundColor }).png());
    await writeRaster(site.identity.install.icon512, sharp(faviconPath).resize(512, 512).flatten({ background: site.identity.backgroundColor }).png());
    await writeRaster(site.identity.install.maskable512, sharp(faviconPath)
      .resize(288, 288, { fit: 'contain' })
      .extend({ top: 112, bottom: 112, left: 112, right: 112, background: site.identity.backgroundColor })
      .flatten({ background: site.identity.backgroundColor }).png());
  }
}

async function generateCard(page) {
  const svg = renderSocialCardSvg({
    title: page.pageTitle,
    surface: page.surfaceName,
    eyebrow: page.socialEyebrow,
    fact: page.socialFact,
    markText: site.identity.social.markText ?? site.identity.surfaceName,
    colors: site.identity.social.colors,
  });
  await writeRaster(socialCardPath(page.path), sharp(Buffer.from(svg)).png());
}

async function writeRaster(publicPath, pipeline) {
  const destination = resolvePublicPath(publicPath);
  mkdirSync(dirname(destination), { recursive: true });
  await pipeline.toFile(destination);
}

function resolvePublicPath(publicPath) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/')) {
    throw new Error(`Public asset path must start with /: ${String(publicPath)}`);
  }
  const destination = resolve(publicRoot, publicPath.slice(1));
  const relation = relative(publicRoot, destination);
  if (relation.startsWith('..') || isAbsolute(relation)) throw new Error(`Public asset path escapes public/: ${publicPath}`);
  return destination;
}

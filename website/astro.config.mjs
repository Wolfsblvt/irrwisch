import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './site.config.mjs';
import publicPages from './src/data/public-pages.mjs';
import { routeFromPath, siteBasePath } from './scripts/identity-model.mjs';
import { resolvedPages } from './scripts/site-pages.mjs';

const pages = resolvedPages(site, publicPages, import.meta.dirname);

export default defineConfig({
  site: new URL(site.url).origin,
  base: siteBasePath(site),
  output: 'static',
  outDir: './artifacts/site',
  integrations: [
    sitemap({
      filter: (url) => {
        const page = pages.get(routeFromPath(site, new URL(url).pathname));
        return page?.indexing === 'index' && page.canonical === url;
      },
    }),
  ],
  vite: {
    server: {
      // Local development proxies the clearing to `wrangler dev` on 8787.
      proxy: {
        '/api': { target: 'http://127.0.0.1:8787', ws: true, changeOrigin: true },
      },
    },
  },
});

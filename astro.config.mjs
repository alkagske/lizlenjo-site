// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// Marketing pages are prerendered to static HTML (output: 'static').
// Liz Notes, the Workroom and /api/* opt out per route with `export const prerender = false`.
export default defineConfig({
  site: 'https://lizlenjo.com',
  output: 'static',
  trailingSlash: 'ignore',
  adapter: cloudflare({
    // Photos used by prerendered pages are optimised at build time with sharp.
    imageService: 'compile',
    // remoteBindings: false keeps local dev fully offline (Workers AI is skipped; spam scoring falls back to heuristics).
    platformProxy: { enabled: true, remoteBindings: false },
    workerEntryPoint: { path: 'src/worker.ts' },
  }),
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !/\/(workroom|api)\b|\/404\/?$/.test(page),
    }),
  ],
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});

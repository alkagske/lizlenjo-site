/**
 * Worker entry point. Wraps Astro's fetch handler and adds the cron that
 * publishes scheduled posts (wrangler.jsonc → triggers.crons).
 */
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { handle } from '@astrojs/cloudflare/handler';
import { publishDue } from './lib/db';
import { nowIso } from './lib/format';

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      async fetch(request, env, ctx) {
        // @ts-expect-error: the adapter's handler accepts the Worker's env and context
        return handle(manifest, app, request, env, ctx);
      },
      async scheduled(_controller, env, ctx) {
        ctx.waitUntil(
          publishDue(env.DB, nowIso()).then((n) => {
            if (n) console.log(`cron: published ${n} scheduled post(s)`);
          }),
        );
      },
    } satisfies ExportedHandler<Env>,
  };
}

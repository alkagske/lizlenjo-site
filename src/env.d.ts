/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    /** Set by middleware on /workroom and /api/admin after Access verification. */
    user?: { email: string; dev?: boolean };
  }
}

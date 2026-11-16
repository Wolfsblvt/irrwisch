# Development

## Meaning

Everything in Irrwisch can be run on one machine: the static page, the Worker and the Durable Object with a local
SQLite file. This guide owns the bootstrap, run, test and reset path for `website/`; it exists so nobody re-derives
the Wrangler-plus-Astro dance from the two configuration files.

## Prerequisites

- Node.js 22.18 or newer: the rule tests run TypeScript directly through Node's built-in type stripping, which
  landed in 22.18. `.node-version` pins 22 for CI.
- npm 10 or newer (ships with Node 22).
- Nothing else. Wrangler, Astro and their browsers are repository-local dependencies.

## Bootstrap

```bash
cd website
npm ci
```

## Run and test

| Task | Command |
| --- | --- |
| Everything, as CI runs it | `npm test` (Astro check, Worker type-check, rule tests, static build) |
| Rule tests only | `npm run test:rules` |
| Site plus Worker plus Durable Object | `npm run dev:worker`, then open `http://127.0.0.1:8787/` |
| Page only with hot reload | `npm run dev` in one terminal and `npm run preview` in another; the Astro dev server proxies `/api` to the Worker on port 8787 |
| Publication guard | `npm run check:publish` (needs `WOLFSBLVT_LEGAL_OPERATOR_B64`) |
| Deploy by hand | `npm run deploy` (needs a logged-in Wrangler or `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`) |

`npm run dev:worker` builds the site first, because the Worker serves `artifacts/site/`. After changing client or
page code, rebuild and restart it; Wrangler does not pick up a replaced asset directory reliably while running.

## Local services

The only service is the Durable Object inside `wrangler dev`. Its SQLite file lives under `website/.wrangler/state/`.
The first request seeds the clearing with a well, four rooms, three things and two creatures.

The operator routes under `/api/admin/` exist only when `ADMIN_TOKEN` is set. For local work copy
`.dev.vars.example` to `.dev.vars` (ignored by Git) and put any string of 24 or more characters in it.

## Safe reset

```bash
cd website
rm -rf .wrangler artifacts .astro
```

This forgets the local world and every build output. It touches nothing deployed.

## Generated artifacts

- `artifacts/site/` is the Astro build and the Worker's asset directory. Regenerate with `npm run build`.
- `public/favicon.png`, `public/apple-touch-icon.png`, `public/_headers`, `public/robots.txt` and
  `public/social/generated/` are written by `npm run assets:generate`, which `build` runs first. They are ignored.
- `public/social/home.png` is a committed capture of a local clearing, used as the social preview.
- `public/favicon.svg` and `public/wordmark.svg` are committed copies of `brand/`; regenerate with
  `node scripts/export-brand.mjs` after changing a master.

## Common paths

- **Change a rule** (budgets, reach, height): edit `src/shared/world.ts`, add or adjust a case in
  `tests/world.test.ts`, run `npm run test:rules`. Both the Worker and the client pick the change up.
- **Change how something looks:** edit `src/client/sprites.ts` (one function per object) or `src/client/scene.ts`
  (layers, camera, picking), rebuild, restart `dev:worker`, look at it in a real browser at desktop and phone widths.
- **Add a verb:** extend `ClientMessage` and `Delta` in `src/shared/protocol.ts`, handle it in
  `worker/clearing.ts`, apply it in `src/client/view.ts`, and give it a button in `src/pages/index.astro` and
  `src/client/ui.ts`. Keep it additive.

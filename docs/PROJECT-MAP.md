# Project map

## Meaning

Irrwisch is one page that draws a shared night clearing and one Worker that keeps it. The repository is shaped so the
page, the world rules and the keeper are separate things that agree on one model. This map owns the layout and the
entry points; it exists because the split between client, shared rules and Worker is invisible from a file list.

## Layout

| Path | Holds | Why it is separate |
| --- | --- | --- |
| `website/` | The whole product: Astro site, client renderer, Worker, Durable Object, tests, Wrangler config | One deployable unit; Wolf's website default puts the component under `website/` |
| `website/src/shared/` | World model, rules, protocol and seeded helpers | Runs on both the Worker and the client so they never disagree about a valid spot |
| `website/src/client/` | Canvas renderer, sprites, camera, UI overlay, WebSocket client | Browser-only code; nothing here is trusted by the Worker |
| `website/worker/` | Worker entry and the `Clearing` Durable Object | The only code that mutates the world |
| `website/src/pages/` | `index.astro` (the clearing), `impressum/`, `privacy/`, `terms/`, `404.astro` | Astro routes; the four reading pages share `layouts/Site.astro` |
| `website/scripts/` | Identity model, site assets, publish checks, brand export, asset upload manifest | Build-time tooling adopted from the shared website starter |
| `website/tests/` | Rule tests run with `node --test` | Pure logic, no framework |
| `brand/` | Identity masters and exported asset set | Owned by the identity, consumed by the site and the README |
| `docs/` | Vision, Decisions, Architecture, Development, Deployment, this map | Durable truth that code cannot carry |
| `.github/workflows/` | Publication workflow (provisional) | Repository automation, not product code |

## Entry points

- **Run it:** `cd website && npm ci && npm run dev:worker`, then open `http://127.0.0.1:8787/`.
- **Start reading here:** `website/src/shared/world.ts` for what the clearing is, then `website/worker/clearing.ts`
  for how it changes, then `website/src/client/scene.ts` for how it is drawn.
- **Tests:** `cd website && npm test`.

## Layout decisions worth keeping

- Shared rules import with explicit `.ts` extensions so Node can run the tests without a build step; Vite and
  Wrangler handle the same imports.
- `website/public/favicon.svg` and `wordmark.svg` are committed copies of the brand exports, so a build does not
  depend on the export script.
- `artifacts/site/` is the Astro output and the Worker's asset directory; it is generated and ignored.

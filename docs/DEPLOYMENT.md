# Deployment

## Meaning

Lichtung is published as one Cloudflare Worker with static assets and one Durable Object. This document owns the
target shape, the publication routes, rollback, and the handover to Wolf Ops, who carries the first live cut, the
canonical hostname, credentials and public-Home admission. Nothing here claims a deployment has happened: as of
2026-11-06 the product has been built and verified locally only.

## Target shape

| Fact | Value |
| --- | --- |
| Account | `aa56f14b292022dd7f284e2bb0c7e259` (Wolfsblvt) |
| Worker name | `lichtung` (`website/wrangler.jsonc`) |
| Durable Object | class `Clearing`, binding `CLEARING`, instance `main`, SQLite backend, migration tag `v1` |
| Rate limit | binding `RATE_IP`, namespace `1201` (account-unique; the Works contact form uses 1101–1103), 12 connections per address per minute |
| Static assets | `website/artifacts/site/`, `not_found_handling: 404-page`, `run_worker_first: ["/api/*"]`, `_headers` carries `X-Robots-Tag` for the legal routes |
| Canonical Home | **not selected**: Wolf's choice; `website/site.config.mjs` currently carries `https://lichtung.wolfsblvt.workers.dev` as a placeholder that satisfies the publish check and must be replaced before the first publication |
| Exposure | public, indexable Home; legal routes public but `noindex, nosnippet` |

## Handover to Wolf Ops

Wolf decided on 2026-11-06 that the building session performs no deployment and that Wolf Ops carries publication.
This is the packet.

**Source.** Repository `lichtung` at the commit named in the handover message; component root `website/`; accepted
branch `main`. Node 22.18 or newer (`website/.node-version` pins 22).

**Build.**

```bash
cd website
npm ci
npm test                       # astro check, worker type-check, rule tests, static build
WOLFSBLVT_LEGAL_OPERATOR_B64='…' npm run check:publish   # refuses fixture identity and placeholders
```

The operator projection enters only through the environment of the build child; the generated legal pages exist only
in `artifacts/site/` and are never committed. The exact public artifact is `website/artifacts/site/` plus the bundled
Worker from `website/worker/index.ts`, both consumed by `wrangler deploy --config wrangler.jsonc`.

**Before the first publication.**

1. Select the canonical hostname and set `url` in `website/site.config.mjs` to it (bare non-`www`, HTTPS). Decide
   whether `workers_dev` stays `true` for a preview or becomes `false`; the current file says `true`.
2. Create the Worker by deploying once (`npm run deploy` from `website/` with a Workers-scoped token, or the
   workflow's publish step). The Durable Object namespace and rate-limit namespace are created by that deployment.
3. Attach the custom domain through the provider-native adapter and add the `www` redirect under the estate's
   canonical-host standard.
4. Set the repository secrets `CLOUDFLARE_API_TOKEN` and `WOLFSBLVT_LEGAL_OPERATOR_B64` and the variables
   `CLOUDFLARE_ACCOUNT_ID` and `WEBSITE_TARGET=workers`, then dispatch `.github/workflows/product-website.yml` once to
   prove the steady-state controller. Pull requests run `npm test` only.

**Readback that proves the Home.**

- `GET /` returns 200 with title `Lichtung`, canonical and Open Graph URLs on the selected host.
- `GET /api/world` returns JSON with `version: 1` and the seeded rooms; `GET /api/health` returns `ok: true`.
- Open the page in a browser: a figure walks in, the visit count increments, a window lights. Open it twice: the
  second watcher sees the first arrive, and a wave from one shows "someone waved at you." on the other.
- `/impressum/` and `/privacy/` return 200 with the real operator, `noindex, nosnippet` in both the HTML and the
  `X-Robots-Tag` header, and are absent from `sitemap-0.xml`. `/nope` returns the branded 404.
- Plain HTTP on the host upgrades to HTTPS before the Worker.

**Operating facts to record.** Worker version and deployment ids, custom-domain id, DNS record ids, redirect rule id,
rate-limit namespace, and the bootstrap evidence that the first visit seeded the world.

**Not part of this handover.** Monitoring, public status and atlas admission under the shared Wolf Ops declaration
(decide at admission; a toy page may honestly not earn a public monitor), Search Console (only once a canonical Home
exists), and any content, rule or identity change (those return to the product).

## Rollback and recovery

Workers keep previous versions. `wrangler versions list` shows them and `wrangler rollback` returns the Worker to an
earlier one; the Durable Object's data is untouched by a code rollback. For the world itself, Cloudflare keeps
thirty days of point-in-time recovery on SQLite-backed objects, and `GET /api/world` is a credential-free export of
the whole clearing. **No restore has been exercised.** If the world is ever damaged, take the export first, then use
the storage API's point-in-time methods from a one-off script inside the object.

## Steady state through GitHub Actions

`.github/workflows/product-website.yml` publishes accepted `main` whenever a consumed input under `website/` or the
workflow itself changes, using the native `paths` filter so unrelated pushes start no run. Production runs do not
cancel each other and build current `main` inside their concurrency slot. It is inactive until the secrets and
variables above exist. Manual dispatch is the bootstrap and recovery route, not the ordinary one.

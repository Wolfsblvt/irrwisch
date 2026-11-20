# Irrwisch repository instructions

## Meaning

This is the repository-local operating boundary for Irrwisch, the shared night clearing. It names the one component,
the commands that prove it, the durable branch posture, and the facts a coworker must not infer from the tree. It
supplements the shared Leitsatz doctrine and grants no Work or authority.

## Boundary

- One product, one component: `website/` holds the Astro static site, the client renderer, the Worker and the
  Durable Object. `brand/` holds the identity masters and exports. `docs/` holds durable truth.
- The shared world rules live in `website/src/shared/` and run on both the Worker and the client. Change them in one
  place and keep `website/tests/` green.
- The visitor's device stores nothing (see `docs/DECISIONS.md`). Do not add cookies, storage or analytics.
- `website/src/data/legal-operator.example.json` is an obvious fixture. The real operator record is projected only
  into production builds through `WOLFSBLVT_LEGAL_OPERATOR_B64`; never commit or print it.
- The only deletions are the operator routes behind `ADMIN_TOKEN` (wipe a slate, remove a thing). Never add a
  visitor-facing way to remove or overwrite, and never put the secret in source, logs or `wrangler.jsonc`.
- Publication is Cloudflare only, live at `https://irrwisch.com/`. Both routes are in `docs/DEPLOYMENT.md`; keep
  routes and domains out of `wrangler.jsonc`. Later uploads must keep the `ADMIN_TOKEN` secret binding.
- Cloudflare Web Analytics and Email Address Obfuscation stay off on the zone: the Privacy page depends on it.
- Leitsatz adopted through `deploy-leitsatz-skill-mcp-v0.8.92` (source `2962234f`), last checked 2026-11-16.

## Commands

From `website/`:

```bash
npm ci                      # bootstrap
npm test                    # astro check, worker type-check, world-rule tests, static build
npm run dev:worker          # build the site, then serve site + Worker + Durable Object on http://127.0.0.1:8787
npm run check:publish       # publication guard; needs WOLFSBLVT_LEGAL_OPERATOR_B64 in the environment
```

`npm run dev:worker` is the safest useful smoke path: it touches no credentials and keeps the world in a local SQLite
file under `website/.wrangler/`. The complete guide is [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Durable branch declaration

```text
main:
  maintainer integration: direct allowed
  external contributions: not currently accepted
  required pre-integration evidence: none
  required approval/review: none
  resolved conversations: no
  automatic CI: .github/workflows/product-website.yml — provisional, not yet activated; it needs the
    repository secrets and variables named in docs/DEPLOYMENT.md
  automatic retained branch effects: Worker deployment from accepted main once the workflow is activated
  other pre-update evidence: none
```

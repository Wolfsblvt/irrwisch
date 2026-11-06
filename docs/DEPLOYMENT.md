# Deployment

## Meaning

Lichtung is published as one Cloudflare Worker with static assets and one Durable Object. This document owns the
target, the two routes to it (bootstrap by hand, steady state through GitHub Actions), rollback, and the operating
facts that are still open. Wolf Ops owns provider effects once a canonical hostname exists; until then the Worker
lives on the account's Workers subdomain as bootstrap evidence.

## Target

| Fact | Value |
| --- | --- |
| Account | `aa56f14b292022dd7f284e2bb0c7e259` (Wolfsblvt) |
| Worker | `lichtung` (`website/wrangler.jsonc`) |
| Durable Object | class `Clearing`, binding `CLEARING`, instance `main`, SQLite backend |
| Rate limit | binding `RATE_IP`, namespace `1201`, 12 connections per address per minute |
| Assets | `website/artifacts/site/`, `404-page` handling, Worker first only for `/api/*` |
| Bootstrap Home | `https://lichtung.wolfsblvt.workers.dev/` (`workers_dev: true`) |
| Canonical Home | not selected; Wolf's choice (see `docs/DECISIONS.md`) |

## Bootstrap by hand

From `website/` with a Cloudflare credential that may deploy Workers on the account:

```bash
WOLFSBLVT_LEGAL_OPERATOR_B64='…' npm run deploy
```

`npm run deploy` runs the publication guard (real identity, no placeholders, production operator record), builds
the site, and runs `wrangler deploy`. The operator record never touches the repository: it enters the build through
the environment only, and the generated legal pages exist only inside `artifacts/site/`.

## Steady state through GitHub Actions

`.github/workflows/product-website.yml` publishes accepted `main` whenever a consumed input under `website/` or the
workflow itself changes. It is **not active until** the repository has:

- the repository secret `CLOUDFLARE_API_TOKEN` (Workers Scripts edit, Durable Objects, Workers routes on this account);
- the repository secret `WOLFSBLVT_LEGAL_OPERATOR_B64` (the private production projection);
- the repository variables `CLOUDFLARE_ACCOUNT_ID` and `WEBSITE_TARGET=workers`.

Pull requests run `npm test` without credentials and never deploy. Production runs do not cancel each other.

## Rollback

Workers keep previous versions. `wrangler versions list` shows them and `wrangler rollback` returns the Worker to an
earlier one; the Durable Object's data is untouched by a code rollback. For the world itself, Cloudflare keeps
thirty days of point-in-time recovery on SQLite-backed objects, and `GET /api/world` is a credential-free export of
the whole clearing. **No restore has been exercised.** If the world is ever damaged, take the export first, then use
the storage API's point-in-time methods from a one-off script inside the object.

## Open operating facts

- Canonical hostname, `www` alias and custom-domain attachment: Wolf and Wolf Ops.
- Publication workflow activation (secrets and variables above): Wolf.
- Private monitoring, public status and atlas admission under the shared Wolf Ops declaration: not started.
- Search Console: not applicable until a canonical Home exists.

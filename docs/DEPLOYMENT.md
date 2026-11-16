# Deployment

## Meaning

Irrwisch is published as one Cloudflare Worker with static assets and one Durable Object, on Cloudflare only: no
server, no second provider. This document is the handover packet for Wolf and Wolf Ops, who carry the first live cut,
the domain, the secrets and public-Home admission. It owns the target shape, the first-publication steps, the
readback that proves the Home, moderation in operation, rollback, and what stays open. Nothing here claims a
deployment has happened: as of 2026-11-16 the product is built and verified locally only.

## Target shape

| Fact | Value |
| --- | --- |
| Provider | Cloudflare only: Workers, Workers Static Assets, one Durable Object, one rate-limit binding, one zone |
| Account | `aa56f14b292022dd7f284e2bb0c7e259` (Wolfsblvt); no Worker named `irrwisch` existed on 2026-11-16 |
| Worker | `irrwisch` (`website/wrangler.jsonc`), `workers_dev: false`, `preview_urls: false`, no routes or domains in the file |
| Durable Object | class `Clearing`, binding `CLEARING`, instance `main`, SQLite backend, migration tag `v1` |
| Rate limit | binding `RATE_IP`, namespace `1201` (the Works contact form uses 1101 to 1103), 12 arrivals per address per minute per location |
| Secret | `ADMIN_TOKEN`: at least 24 characters; enables the three operator routes. Unset means they answer 404 |
| Static assets | `website/artifacts/site/`, `404-page` handling, Worker first only for `/api/*`, `_headers` carries `X-Robots-Tag` for the legal routes |
| Canonical Home | recommended `https://irrwisch.com/` (free at Cloudflare Registrar on 2026-11-16 for 11.17 USD a year; **not bought**). `website/site.config.mjs` carries it in `url`; change that one line for another hostname |
| Exposure | public and indexable Home; `/impressum/`, `/privacy/`, `/terms/` public but `noindex, nosnippet` |
| Surface role | one canonical human-facing Home with a small live API under `/api/`; no Docs, no app, no status host |

## First publication

Everything runs from `website/` on a machine with Node 22.18 or newer and a Cloudflare credential that may deploy
Workers on the account (`wrangler login`, or `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`).

1. **Name.** Buy `irrwisch.com` at Cloudflare Registrar, which creates the zone in the account. For another
   hostname, set `url` in `site.config.mjs` and commit before building.
2. **Check the source.**

   ```bash
   npm ci
   ```

   ```bash
   npm test
   ```

3. **Deploy.** The legal operator record enters only through the environment of this one command. PowerShell:

   ```powershell
   $env:WOLFSBLVT_LEGAL_OPERATOR_B64 = '<production projection from the Wolf Ops route>'; npm run deploy; Remove-Item Env:WOLFSBLVT_LEGAL_OPERATOR_B64
   ```

   `npm run deploy` refuses fixture identity and placeholders, builds, compares the built pages with the identity
   source, then runs `wrangler deploy`. The first deployment creates the Worker, the Durable Object namespace and the
   rate-limit namespace. The first request seeds the clearing.
4. **Moderation secret.** Generate a long random value and store it where Ops keeps service-owned secrets, then:

   ```bash
   npx wrangler secret put ADMIN_TOKEN --config wrangler.jsonc
   ```

5. **Domain.** Attach `irrwisch.com` to the Worker as a custom domain (provider-native adapter; the zone must be
   active). Add the `www` name as a proxied record with one permanent redirect to the apex that keeps path and
   query. Turn on *Always Use HTTPS* for the zone.
6. **Steady state.** In the GitHub repository set the secrets `CLOUDFLARE_API_TOKEN` and
   `WOLFSBLVT_LEGAL_OPERATOR_B64` and the variables `CLOUDFLARE_ACCOUNT_ID` and `WEBSITE_TARGET=workers`, then
   dispatch `.github/workflows/product-website.yml` once. After that, accepted `main` publishes itself whenever a
   consumed input under `website/` changes; pull requests only run `npm test`.

## Readback that proves the Home

- `GET /` answers 200 with title `Irrwisch`, canonical and Open Graph URLs on the selected host, and
  `og:image` at `/social/home.png`.
- `GET /api/health` answers `ok: true`. `GET /api/world` answers JSON with `version: 1`, `growth: 0` and four seeded
  rooms around cell 48,48.
- In a browser a figure walks in, the count goes up by one and a window lights. In a second browser the first sees
  "someone just arrived."; a wave from one shows "someone waved at you." on the other.
- `/impressum/`, `/privacy/` and `/terms/` answer 200 with the real operator, `noindex, nosnippet` in the page and
  in `X-Robots-Tag`, and are absent from `sitemap-0.xml`. `/nope` answers the branded 404.
- `GET /api/admin/slates` answers 404 without the bearer secret and a text listing with it.
- Plain HTTP on apex and `www` reaches HTTPS before the Worker; `www` reaches the apex in one hop.
- `https://irrwisch.wolfsblvt.workers.dev/` does not serve the site.

Record the Worker version and deployment ids, the custom-domain id, the DNS and redirect rule ids, and the commit
that was built.

## Moderating the place

The only removals the product knows are wiping one slate and taking one thing off the ground. Both need the secret.

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://irrwisch.com/api/admin/slates
```

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "https://irrwisch.com/api/admin/wipe?room=17"
```

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "https://irrwisch.com/api/admin/remove-thing?id=42"
```

The listing prints every non-blank slate as an 8 by 8 picture (`#` white, `o` ember) with its room id, and every
thing with its id. Open visitors see a wipe or removal immediately. Reports arrive through the Works contact form
and `legal@wolfsblvt.works`, as the Terms and the about panel say; somebody has to read them.

## Limits and cost

- No new subscription. The Worker uses the account's existing Workers plan. The Works production Worker runs with
  Logpush, which suggests Workers Paid is active; the plan itself was not readable from the building session.
- Every arrival and action reads the whole world from SQLite (rooms, things, creatures, worn tiles). On Workers
  Paid that is far inside the included row reads. On Workers Free (5 million rows read a day) a world of 4,000 rows
  would stop at roughly 600 arrivals a day; the fix is an in-memory world in the object, recorded in
  `docs/ARCHITECTURE.md` as a known compromise.
- One address may arrive 12 times a minute per Cloudflare location. There is no global cap: a crowd is welcome, a
  botnet would inflate the visit count and wear the paths. Bot Fight Mode on the zone is an Ops choice.

## Rollback and recovery

Workers keep previous versions: `npx wrangler versions list` and `npx wrangler rollback` return the code to an
earlier one, and the Durable Object's data is untouched by that. For the world itself Cloudflare keeps thirty days
of point-in-time recovery on SQLite-backed objects, and `GET /api/world` is a credential-free export of the whole
clearing. **No restore has been exercised.** After real damage take the export first, then use the storage API's
point-in-time methods from a one-off script inside the object.

## Still open after tonight

- Operational admission under the shared Wolf Ops declaration: private monitor on `/api/health` and the Home marker,
  the decision whether a toy earns a public status entry, the private atlas row.
- Search Console: a Domain property for the new registrable domain and the sitemap `…/sitemap-index.xml`.
- A real social unfurl check once the Home is live; the image is a capture of a local clearing.
- Identity approval: the mark and wordmark in `brand/` are Tala's working drafts.
- Legal review: the Privacy and Terms copy is truthful to the data flows and has had no qualified review. Whether
  the page counts as a hosting service that needs a formal notice-and-action form under the Digital Services Act is
  unresolved; the page offers a contact route and operator removal.
- The Works sponsor component is not placed on this page: the page is one canvas with small links by Wolf's brief.

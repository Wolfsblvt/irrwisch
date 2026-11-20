# Deployment

## Meaning

Irrwisch is published as one Cloudflare Worker with static assets and one Durable Object, on Cloudflare only: no
server, no second provider. This document owns the live shape, how a new cut reaches the Home, the readback that
proves it, moderation in operation, rollback, and what stays open. The first cut went live on 2026-11-19 from the
building session, through Wolf's authenticated Cloudflare connection and on his direction.

## Live shape

| Fact | Value |
| --- | --- |
| Canonical Home | `https://irrwisch.com/` (public and indexable). `/impressum/`, `/privacy/`, `/terms/` are public but `noindex, nosnippet` |
| Provider | Cloudflare only: Workers, Workers Static Assets, one Durable Object, one rate-limit binding, one zone |
| Account | `aa56f14b292022dd7f284e2bb0c7e259` (Wolfsblvt) |
| Zone | `irrwisch.com`, id `775b4007819670ec649ff5ea2ec818df`, Free plan, registered at Cloudflare Registrar |
| Worker | `irrwisch`; `workers.dev` and preview URLs off |
| First cut | 2026-11-19: deployment `09126bcb-aaf1-4b96-88f0-ebe2dd295800`, version `455afbeb-079d-425a-9ac7-6f7d00c7fdc1`, built from commit `26e846c` |
| Second cut | 2026-11-20: deployment `7c618c62-0104-4885-800e-63514aab5b60`, version `1e310f96-d151-459f-83b5-fa02cc33adc6`: one allowance and one counted visit per address per night |
| Third cut | 2026-11-20: deployment `48fb887a-2324-4ac4-abda-0e0d05c6b848`, version `805c5236-9680-41f3-8e66-771a2ddd6eb0`: watch-only mode, and the visit count corrected from 18 to 9 |
| Current cut | 2026-11-20: deployment `d04609ca-4f7e-43b7-bbae-092d0f861bee`, version `db70d1fa-7318-4b6e-81dd-6adc6893ab88`: every person counted once, recognised by the `wisp` cookie and by address; first-day guests carried over |
| Custom domain | `irrwisch.com` attached to the Worker, id `17cba2736ee048e63cd81250a38bce1dff117872` |
| `www` | proxied `AAAA 100::` record `641e56d76d52a474e34532b672034f7d`; redirect ruleset `a6eb161fd2b74b289ddc5cecb8d09973`, rule `05fe78460532494893e9422768897732`: 301 to the apex, path and query kept |
| Durable Object | class `Clearing`, binding `CLEARING`, instance `main`, SQLite backend, migration tag `v1` (applied) |
| Rate limit | binding `RATE_IP`, namespace `1201` (the Works contact form uses 1101 to 1103), 12 arrivals per address per minute per location |
| Secret | `ADMIN_TOKEN`: **not set**. The three operator routes answer 404 until Wolf sets it (at least 24 characters) |
| Static assets | `website/artifacts/site/`, `404-page` handling, Worker first only for `/api/*`, `X-Robots-Tag` rules for the legal routes |
| Surface role | one canonical human-facing Home with a small live API under `/api/`; no Docs, no app, no status host |

### Zone settings that carry product promises

| Setting | Value | Why |
| --- | --- | --- |
| Web Analytics (`rum`) | **off** | Cloudflare switches its browser beacon on for every new zone. The Privacy page says the page loads nothing from third parties and runs no analytics; the beacon was injected for about an hour after the domain went live and was then switched off. Never turn it back on without changing the Privacy page first |
| Email Address Obfuscation | off | It rewrites addresses on the legal pages into script-decoded placeholders and injects a script |
| Always Use HTTPS | on | Plain HTTP reaches HTTPS before the Worker |
| Minimum TLS | 1.2 | |
| Rocket Loader | off (default) | It would rewrite the page's own module script |

## Publishing a new cut

Two routes exist. Both start the same way, from `website/` with Node 22.18 or newer:

```bash
npm ci
```

```bash
npm test
```

### Route A: Wrangler with a credential

For a machine with `wrangler login`, or `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`. The legal operator
record enters only through the environment of this one command. PowerShell:

```powershell
$env:WOLFSBLVT_LEGAL_OPERATOR_B64 = '<production projection from the Wolf Ops route>'; npm run deploy; Remove-Item Env:WOLFSBLVT_LEGAL_OPERATOR_B64
```

`npm run deploy` refuses fixture identity and placeholders, builds, compares the built pages with the identity
source, then runs `wrangler deploy`. The same route runs unattended once the GitHub repository carries the secrets
`CLOUDFLARE_API_TOKEN` and `WOLFSBLVT_LEGAL_OPERATOR_B64` and the variables `CLOUDFLARE_ACCOUNT_ID` and
`WEBSITE_TARGET=workers`: `.github/workflows/product-website.yml` then publishes accepted `main` whenever a consumed
input under `website/` changes. **That workflow is not activated.**

### Route B: an authenticated Cloudflare connection, no token

This is how the first cut was published, from an agent session that holds a Cloudflare API connection (the
Cloudflare MCP server) and may reach `api.cloudflare.com`, but has no Wrangler credential.

1. Build with the real operator record in the environment of the one command: `npm run check:publish`.
2. Bundle the Worker without deploying: `npx wrangler deploy --dry-run --minify --outdir <dir>`.
3. Write the asset manifest: `node scripts/asset-manifest.mjs`.
4. Through the connection, `POST /accounts/{account}/workers/scripts/irrwisch/assets-upload-session` with the
   manifest. The answer carries a short-lived upload token and the buckets of hashes Cloudflare does not hold yet.
5. Send each bucket to `POST /accounts/{account}/workers/assets/upload?base64=true` with that upload token as the
   bearer; each form field is named by the hash and holds the base64 file with its content type. The last answer
   carries the completion token. With nothing new to upload, step 4 answers with the completion token directly.
6. Through the connection, `PUT /accounts/{account}/workers/scripts/irrwisch` as multipart: the bundle as
   `index.js` (`application/javascript+module`) and `metadata` with `main_module`, `compatibility_date`, the three
   bindings from `wrangler.jsonc`, and `assets: { jwt, config: { not_found_handling, run_worker_first, _headers } }`
   where `_headers` is the text of `artifacts/site/_headers`.
7. Rebuild without the operator record afterwards so no real identity stays in `artifacts/`.

Two things differ from the first cut on every later one:

- **Send `keep_bindings: ["secret_text"]` in the metadata.** Without it the upload drops `ADMIN_TOKEN`.
- **Leave `migrations` out** unless a Durable Object class is added, renamed or removed. Tag `v1` is applied.

## Readback that proves the Home

**A check never walks in.** Anything that looks at the live Home to verify it uses `https://irrwisch.com/?watch=1`
(or `wss://irrwisch.com/api/ws?watch=1`), `GET /api/world` and the static routes. A watcher sees the place live and
leaves nothing: no counted visit, no walker, no light, no worn ground, no allowance. Arrival, allowance and
contribution behaviour is proven against a local Worker (`npm run dev:worker`), never by visiting production.
On the first day the building session ignored this and walked in nine times; the third cut took those nine off the
count. The ground those walks wore and the windows they lit could not be told apart from real ones and stayed.

Checked on 2026-11-20 after the first cut, from the building session:

- `GET /` answers 200 with title `Irrwisch`, canonical and Open Graph URLs on `https://irrwisch.com/`, and
  `og:image` at `/social/home.png`. `robots.txt`, `sitemap-index.xml` and the social image answer 200.
- `GET /api/health` answers `ok: true`. `GET /api/world` answers JSON with `version: 1`, `growth: 0` and the four
  seeded rooms around cell 48,48.
- In a browser a figure walks in over `wss://irrwisch.com/api/ws`, the count goes up by one and a window lights. A
  second browser makes the first show "someone just arrived."; its wave shows "someone waved at you." on the first.
- `/impressum/`, `/privacy/` and `/terms/` answer 200 with `noindex, nosnippet` in `X-Robots-Tag`. `/nope` answers
  the branded 404. The deployed legal pages were built from the real operator record and compared with it.
- `GET /api/admin/slates` answers 404 (no secret set).
- `https://www.irrwisch.com/terms/?a=1` answers 301 to `https://irrwisch.com/terms/?a=1`.
- After the zone settings above, the pages request nothing outside `irrwisch.com`.
- Fourth cut, checked without walking in: `POST /api/me` answers 204 with `wisp=<32 hex>; Max-Age=34560000; Path=/;
  Secure; HttpOnly; SameSite=Lax` and returns the same token when it is sent back; `GET /api/me` answers 405; a
  watcher gets no cookie and makes no `/api/me` call; the count stayed at 9 through the migration and the checks.
  **Recognition across addresses was proven against a local Worker only** (same cookie over IPv4, IPv6 and a new
  address; cleared cookie on a known address; a private window; a later night). Proving it live would have meant
  adding a person who is not one.
- Second cut: a connection from an address the clearing already knew that night answered `returning: true` with the
  visit count unchanged. The building session's outbound address changes on every connection, so the full
  reload-in-one-browser behaviour was proven against a local Worker and not from a single live browser.

**Not checked from the building session:** plain HTTP on port 80 and the `workers.dev` hostname. Its network could
reach neither. The API reads Always Use HTTPS as on and the `workers.dev` route as disabled.

## Moderating the place

The only removals the product knows are wiping one slate and taking one thing off the ground. Both need
`ADMIN_TOKEN`, which Wolf sets in the Worker's settings as a secret, or with Wrangler:

```bash
npx wrangler secret put ADMIN_TOKEN --config wrangler.jsonc
```

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
and `legal@wolfsblvt.works`, as the Terms and the about panel say; somebody has to read them. **Until the secret
exists, nothing on the page can be removed without a new deployment.**

## Limits and cost

- No new subscription. The zone is on the Free plan and the Worker uses the account's existing Workers plan, which
  was not readable from the building session.
- Every arrival and action reads the whole world from SQLite (rooms, things, creatures, worn tiles). On Workers
  Paid that is far inside the included row reads. On Workers Free (5 million rows read a day) a world of 4,000 rows
  would stop at roughly 600 arrivals a day; the fix is an in-memory world in the object, recorded in
  `docs/ARCHITECTURE.md` as a known compromise.
- One address may arrive 12 times a minute per Cloudflare location. There is no global cap: a crowd is welcome, a
  botnet would inflate the visit count and wear the paths. Bot Fight Mode on the zone is an Ops choice; its
  script-injecting variants would need the Privacy page to say so.

## Rollback and recovery

Workers keep previous versions: `npx wrangler versions list` and `npx wrangler rollback`, or the Versions and
Deployments view in the dashboard, return the code to an earlier one, and the Durable Object's data is untouched by
that. For the world itself Cloudflare keeps thirty days of point-in-time recovery on SQLite-backed objects, and
`GET /api/world` is a credential-free export of the whole clearing. **No restore has been exercised.** After real
damage take the export first, then use the storage API's point-in-time methods from a one-off script inside the
object.

## Still open

- `ADMIN_TOKEN` is not set, so operator removal is not available yet.
- Steady-state publishing: Route A's workflow needs a Cloudflare token as a repository secret; until then each cut
  is a manual Route B run.
- Operational admission under the shared Wolf Ops declaration: private monitor on `/api/health` and the Home marker,
  the decision whether a toy earns a public status entry, the private atlas row.
- Search Console: a Domain property for the new registrable domain and the sitemap `…/sitemap-index.xml`.
- A real social unfurl check; the image is a capture of a local clearing.
- Identity approval: the mark and wordmark in `brand/` are Tala's working drafts.
- Legal review: the Privacy and Terms copy is truthful to the data flows and has had no qualified review. Whether
  the page counts as a hosting service that needs a formal notice-and-action form under the Digital Services Act is
  unresolved; the page offers a contact route and operator removal.
- The Works sponsor component is not placed on this page: the page is one canvas with small links by Wolf's brief.

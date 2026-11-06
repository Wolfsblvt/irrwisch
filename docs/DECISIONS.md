# Decisions

## Meaning

Curated durable choices for Lichtung and why they were made: the shape of the shared clearing, the rules that keep
visitors from destroying it, the hosting and state model, and the things deliberately left out. Each entry records
what is true now, the constraint that drove it, the alternative that lost, and what would reopen it. Routine
implementation detail stays in code and `docs/ARCHITECTURE.md`; product dream stays in `docs/VISION.md`.

## One settlement in a clearing, grown by visitors

**Date:** 2026-11-06 · **Status:** Current

What visitors build together is a small night settlement of stacked rooms in a forest clearing, with ground things,
chalk signs and wandering creatures around it.

**Why.** Wolf asked for a cute, slightly scary, slightly weird place built by everyone and never destroyed, and left
the subject to Tala. A village grown one room at a time gives every verb a physical home (build on it, place beside
it, draw on it, nudge around it), reads as a place rather than a canvas, and makes "arrival leaves a trace" literal:
a window lights, the path wears.

**Rejected.** A shared pixel canvas (well-trodden, reads as a drawing tool, invites defacement rather than building).
A single growing creature made of visitors (fun, but one verb deep). A garden (gentle, but hard to make weird).

**Reopen if.** Lived use shows visitors cannot tell what they are adding to, or the settlement grammar cannot absorb
a destination in the Vision.

## No text input anywhere

**Date:** 2026-11-06 · **Status:** Current

The site accepts no free text from visitors: no names, no messages, no labels on rooms or things.

**Why.** Free text is the one input that needs moderation, retention decisions and a report route. Pixels, placements
and nudges are bounded and cannot carry a slur or a phone number. The constraint keeps the operator burden near zero
and keeps every trace honestly anonymous.

**Rejected.** A short name carved on a stone per visitor; a 12-character label on a sign. Both would make chalk
drawings the less interesting option and would need a word filter that still fails.

**Reopen if.** A real community forms around the place and asks for a way to sign work, and someone owns moderation.

## Nothing is ever deleted; change is rate-limited and additive

**Date:** 2026-11-06 · **Status:** Current

The rules allow only additions: rooms are placed, never removed; chalk cells are set, never cleared; things are placed,
never picked up; creatures are nudged one step, never removed. Per connection a visitor gets one room, one thing, a
dozen chalk cells and three nudges; the Cloudflare rate-limit binding caps actions per network address per minute.

**Why.** Wolf's boundary was "never destroy completely, never change too much". Making destruction impossible in the
rules is cheaper and more honest than detecting it. Small per-visit budgets keep one visitor from dominating the place
while still letting a minute of attention leave a visible mark.

**Rejected.** Undo for your own actions (needs identity). Erase in chalk (turns signs into a battleground). Larger
budgets per visit (a bored visitor fills a sign alone).

**Reopen if.** Budgets prove too tight to feel like contribution, or additive-only signs become unreadable grey in
practice. Both are tuning, not a change of principle.

## One Durable Object holds the whole clearing

**Date:** 2026-11-06 · **Status:** Current

The shared world lives in one SQLite-backed Cloudflare Durable Object named `main`. It validates every action,
persists state, broadcasts deltas over hibernating WebSockets, and runs the world's own clock through alarms.

**Why.** The world is one small consistent object that many clients mutate concurrently; a single actor gives
serialised rules without locks, live fan-out without a pub/sub product, and durable storage with point-in-time
recovery on the Workers Free plan. Cloudflare is the estate's preferred public front door and the account already
hosts product Workers the same way.

**Rejected.** D1 plus polling (no live presence, every client re-reads the world). KV (no serialisation, eventual
consistency would let two rooms land on one spot). A conventional server on Wolf Server (a toy page does not earn a
host, a deploy pipeline and a backup job).

**Reopen if.** One object becomes a bottleneck (thousands of concurrent visitors) or the world outgrows a single
SQLite database, neither of which is close.

## The visitor's device stores nothing

**Date:** 2026-11-06 · **Status:** Current

No cookies, no localStorage, no sessionStorage, no IndexedDB. Identity exists only for the lifetime of one WebSocket
connection; budgets are per connection; abuse limits use the network address transiently through the Cloudflare
rate-limit binding and are never written to the world.

**Why.** Any device storage would be optional under § 25 TDDDG and would therefore need a consent choice and banner,
which the page should not have. Wolf's legal defaults prefer no consent-requiring storage. The price is that a
returning visitor cannot be recognised, which the Vision accepts.

**Rejected.** A random visitor token in localStorage to recognise "your" room on return and to rate-limit per
visitor (needs consent; trivially cleared anyway).

**Reopen if.** A strictly necessary storage need appears that the explicitly requested service cannot do without.

## Astro static shell plus a Worker, deployed as Workers Static Assets

**Date:** 2026-11-06 · **Status:** Current

The repository is one Astro static site under `website/` with the clearing's client code as plain TypeScript modules,
one Worker entry under `website/worker/` serving `/api/*` and the WebSocket, and `wrangler.jsonc` pointing the asset
directory at the Astro build. Shared rules live in `website/src/shared/` and run on both sides.

**Why.** Wolf's website default is Astro static output with little client JavaScript for ordinary pages; this page is
the exception that needs a real client, and Astro still gives the legal pages, identity metadata, sitemap and the
publish check from the shared starter for free. Workers Static Assets with a Worker script is the estate's adopted
route for a dedicated Cloudflare-zoned product site and the only route where the Durable Object can live beside the
assets.

**Rejected.** A framework SPA (no need; the page is one canvas and a few buttons). Pages plus a separate API Worker
(two deployments to keep in step for one page). Hand-written HTML without Astro (would re-implement the legal and
identity contract the starter already proves).

**Reopen if.** A documentation surface appears (then Starlight joins at `/docs/`), or the client grows to need a
component model.

## Canvas 2D rendering, no engine

**Date:** 2026-11-06 · **Status:** Current

The clearing is drawn with the Canvas 2D API from procedurally generated sprites: isometric tiles, rooms, things,
creatures, fog and light are all drawn in code, with no image assets and no rendering library.

**Why.** The look is a miniature with a few hundred objects and soft light; Canvas 2D with layered composite
operations reaches it comfortably on a phone, keeps the bundle tiny, and lets every sprite be a function Wolf can
read. A WebGL engine would add a dependency, a loader and a shader toolchain for an effect the page does not need.

**Rejected.** Three.js or PixiJS (dependency weight and an abstraction between the sprite and its author). SVG DOM
(hundreds of animated nodes and glow filters are slow on phones). Hand-painted sprite sheets (would need an artist and
an asset pipeline; procedural drawing keeps the style changeable in code).

**Reopen if.** The world routinely draws thousands of lit objects, or a selected visual effect genuinely needs the GPU.

## Bootstrap publication on the Workers subdomain; the canonical domain is Wolf's choice

**Date:** 2026-11-06 · **Status:** Current

The first public cut is deployed by hand to `lichtung.wolfsblvt.workers.dev` as bootstrap evidence. The canonical
public Home under a Wolf-owned name, the Cloudflare API token for the publication workflow, and the GitHub remote are
owner effects and remain open remainders recorded in the README until Wolf selects them.

**Why.** Tala's grant covered building and publishing the project; choosing a registrable name, minting a provider
credential and creating the remote are retained owner boundaries under the shared doctrine. Deploying to the Workers
subdomain is finite, reversible by deleting the Worker, and lets Wolf see the real place before choosing its name.

**Rejected.** Waiting to deploy until a domain exists (Wolf asked for a working thing, not a plan). Inventing a
`wolfsblvt.works` subdomain (a Works estate decision Wolf Ops performs, not a product default).

**Reopen if.** Wolf names the Home. Then `site.config.mjs` takes the canonical URL, Wolf Ops attaches the custom
domain, and the Workers subdomain route is disabled.

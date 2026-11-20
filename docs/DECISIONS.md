# Decisions

## Meaning

Curated durable choices for Irrwisch and why they were made: the shape of the shared clearing, the rules that keep
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

## Nothing is ever deleted by visitors; change is rate-limited and additive

**Date:** 2026-11-06 · **Status:** Current, narrowed on 2026-11-16 by "The operator can remove unlawful content"

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

**Date:** 2026-11-06 · **Status:** Current for the device, narrowed on 2026-11-20

No cookies, no localStorage, no sessionStorage, no IndexedDB. The device half of this decision stands. The server
half ("identity exists only for one connection, budgets are per connection") was replaced on 2026-11-20 by "One
allowance per address per night".

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

## The name is Irrwisch

**Date:** 2026-11-16 · **Status:** Current

The product is called Irrwisch. The recommended canonical Home is `irrwisch.com`, which Cloudflare Registrar reported
as free on 2026-11-16 at 11.17 USD a year; buying it is Wolf's spend and has not happened.

**Why.** The first name, Lichtung, already names the interface of Baumhaus, as Wolf pointed out. Two Works things
with one name would collide on the Works site, in rooms and in search. An Irrwisch (will-o'-the-wisp; colloquially a
restless little creature) carries the tone Wolf asked for: cute, a bit scary, a bit weird. It also names the visitor
rather than the place, which fits a page where arriving is the point.

**Rejected.** Keeping Lichtung (the collision is inside one maker's estate and Baumhaus had the name first).
Weilchen, "a little while" (lovely, and `weilchen.com` was free, but the Works pile already carries Folkwhile, a
village game, and two settlement projects with "while" in the name would blur). Glimmen (a Dutch village; `.com`
taken). Hamlit, Emberwell (`.com` taken, and Hamlit reads as a typo).

**Reopen if.** Wolf prefers another name. The rename is mechanical: `site.config.mjs`, the wordmark export, the
Worker name and the documents.

## The operator can remove unlawful content

**Date:** 2026-11-16 · **Status:** Current

The Worker has three operator routes behind a bearer secret (`ADMIN_TOKEN`): list every non-blank slate and thing as
text, wipe one slate, remove one thing. Without the secret set, the routes do not exist. The Terms and the about
panel tell visitors how to report something, and say the operator will remove unlawful or hateful content.

**Why.** An 8 by 8 slate with two colours is a drawing surface, and strangers on the internet draw what strangers on
the internet draw, including symbols that are illegal to display in Germany. The first Vision promised that nobody,
"including the operator", could delete anything. That promise was wrong for a public page with a German operator
and unkind to visitors who would have to look at whatever stayed. Removal by rule stays impossible for visitors.

**Rejected.** No removal at all (see above). Automatic shape detection on slates (brittle, and a false sense of
safety). A public report button that hides content by vote (a griefing tool). A moderation dashboard (three routes
and `curl` are enough until real use says otherwise).

**Reopen if.** Reports become frequent enough that listing and wiping by hand is toil, or a legal assessment says
the page needs a formal notice-and-action form.

## The clearing grows with the settlement

**Date:** 2026-11-16 · **Status:** Current

The grid is 96 by 96 and the clearing starts 9 to 12 cells in radius. Whenever rooms on the ground and things
together cover more than 30 percent of the clearing floor, the woods step back one cell, at most thirty times. The
camera frames the whole clearing while it fits the screen and the settlement once it does not.

**Why.** With a fixed 40 by 40 clearing, one thing and one room per visitor filled the ground after a few hundred
visits, which a public site reaches in days. A simulated run of visitors showed the first step after 56 to 72 of
them. Thirty steps give room for a few thousand things and far more rooms, and "together you clear the woods" is a
better story than a full sign.

**Rejected.** A large fixed clearing (an empty field with the woods far away loses the cosy ring). Letting things be
built over or decay (breaks "never destroy"). An unbounded world (needs chunked storage and rendering the product
has not earned).

**Reopen if.** The place approaches the thirtieth step. The options are in the Vision's open possibilities.

## Terms are part of the legal surface

**Date:** 2026-11-16 · **Status:** Current

The site carries `/terms/` beside `/impressum/` and `/privacy/`, linked from the front page, the about panel and the
footer of the reading pages.

**Why.** The Works legal baseline gives every externally usable hosted service Terms, and a page where visitors add
lasting content to a shared world is one. The Terms say what the first cut left unsaid: contributions are anonymous,
permanent and cannot be withdrawn, the operator may display them, and unlawful content is removed.

**Rejected.** Treating the page as a plain static site with Impressum and Privacy only (it stores visitor
contributions on a server).

**Reopen if.** Qualified legal review asks for different wording, or the page gains accounts, payments or text input.

## Cloudflare only, published from the product seat through Wolf's connection

**Date:** 2026-11-19 · **Status:** Current, supersedes "Wolf publishes with Wolf Ops, on Cloudflare only" (2026-11-16)

The whole product runs on Cloudflare: one Worker with static assets, one SQLite Durable Object, one rate-limit
binding, the `irrwisch.com` zone. Nothing touches Wolf Server or any other host. The seat that builds the product
also publishes it, through the authenticated Cloudflare connection Wolf set up for agent sessions, without a
Wrangler credential or an API token of its own. `docs/DEPLOYMENT.md` carries both routes and the live record.

**Why.** Wolf bought the domain on 2026-11-19 and said the access was already there and that this should not need
another agent seat. He was right: the connection can create an asset upload session and upload the Worker, and the
upload session's own short-lived token carries the files. A toy page does not earn a server, a second seat or a
long-lived deploy token.

**Rejected.** Waiting for a Wolf Ops handover (the 2026-11-06 and 2026-11-16 position, now history). A Cloudflare API
token handed to the building session (Wolf declined it twice). Any origin outside Cloudflare.

**Consequence.** Each cut is a manual run until the GitHub workflow gets a token. Operational admission (monitoring,
status, atlas) stays Wolf Ops bookkeeping and is not part of publishing.

**Reopen if.** The world outgrows one Durable Object, the Workers plan limits start refusing visitors, or cuts
become frequent enough that the manual route costs more than a scoped deploy token.

## Cloudflare's own analytics beacon stays off

**Date:** 2026-11-20 · **Status:** Current

Cloudflare enables Web Analytics on every new zone and injects a third-party beacon script into HTML. On
`irrwisch.com` it is switched off, together with Email Address Obfuscation.

**Why.** The device-stores-nothing decision and the Privacy page promise no analytics and no third-party requests.
The live readback caught the beacon about an hour after the domain went live; a provider default had quietly made
the page's own promise false.

**Rejected.** Keeping the beacon and disclosing it: the product has no use for the numbers.

**Reopen if.** Wolf wants visit analytics badly enough to rewrite the Privacy page first.

## One allowance per address per night

**Date:** 2026-11-20 · **Status:** Current, replaces per-connection budgets

The clearing remembers a visitor for twelve hours by a salted SHA-256 of the connecting address (the whole IPv4
address, the /64 prefix for IPv6), kept in the Durable Object with the remaining allowance and the dealt hand.
Within that night a reload, a second tab or a reconnect is the same guest: no new counted visit, no new walker, no
new light, no fresh allowance. The row is deleted after the night and is linked to nothing the guest made.

**Why.** Wolf pressed F5 minutes after the first cut and had twelve new chalk cells. With budgets on the connection,
one person could fill a slate in six reloads and build a dozen rooms a minute, which breaks the founding rule
"never change too much", and every reload inflated "have walked here". Wolf's verdict on remembering nothing at
all: "That's kind a stupid", with the instruction that a hashed, private, non-identifying identity lives either on
the device or on the server.

**Rejected.** A token on the device: an incognito window or cleared storage defeats it, and optional device storage
needs a consent choice under § 25 TDDDG. An in-memory map in the object: it is lost whenever the object hibernates,
so waiting ten seconds would reset it. The raw address: not needed, so not kept.

**Consequence.** People behind one shared IPv4 address (a household, an office, some mobile carriers) share one
allowance and count as one visit per night. The salt sits next to the hashes, so this is pseudonymous, not
anonymous; the Privacy page says what is kept and for how long. Changing network (Wi-Fi to mobile, a VPN) is a new
guest, which is accepted: it costs effort per allowance and the arrival rate limit still applies.

**Reopen if.** Shared addresses visibly lock out real visitors, or abuse through address hopping shows up on the
slates.

## Checks watch, they do not walk in

**Date:** 2026-11-20 · **Status:** Current

`/?watch=1` shows the live place to someone who is looking after it and leaves nothing: no counted visit, no walker,
no light, no worn ground, no allowance, not even a wave. Every check against the live Home uses it. The count
"have walked here" means people, one per address per night, and nothing else.

**Why.** On the first day the count stood at 16 and nine of those were the building session's own browser checks,
which it then blamed on Wolf's reloads. Wolf: "So that counter is still lying." A number that the page shows to
every visitor has to be true, and the only way to keep operations out of it is a way to look without arriving.

**The correction.** The third cut subtracted exactly those nine visits once (18 to 9), recorded in the object's
`meta` so it cannot run twice. The nine walks also wore ground and lit windows; those could not be separated from
real walks and were left.

**Rejected.** Recognising checks by address or user agent (fragile, and a rule nobody can verify from outside).
A full reset of the world (it would have destroyed what real visitors had already left).

**Reopen if.** Automated clients that are not people start arriving in numbers; then arrival may need a human
signal before it counts.

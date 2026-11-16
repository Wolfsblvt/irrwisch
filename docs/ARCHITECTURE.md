# Architecture

## Meaning

Irrwisch is a static page in front of one Durable Object. The page draws; the object decides. Everything a visitor
does travels as a small JSON message over one WebSocket, is checked against rules both sides share, is written to
the object's SQLite storage, and comes back to everyone present as a delta. This document owns that shape and its
invariants; the one idea that organises it is that the world has exactly one writer.

## Components

| Component | Responsibility | Talks to |
| --- | --- | --- |
| Astro static site (`website/src/pages`) | Serves the page, legal pages, identity metadata, sitemap | Browser |
| Client (`website/src/client`) | Fetches the snapshot, renders the clearing on a canvas, sends actions, applies deltas | `/api/world`, `/api/ws` |
| Shared rules (`website/src/shared`) | World model, validity of build/place/chalk/nudge, path finding, growth and glow by age | Client and Worker |
| Worker entry (`website/worker/index.ts`) | Routes `/api/*`, applies the per-address rate limit, guards `/api/admin/*` with the `ADMIN_TOKEN` bearer secret, hands everything else to static assets | `Clearing`, `ASSETS`, `RATE_IP` |
| `Clearing` Durable Object (`website/worker/clearing.ts`) | Validates and applies actions, persists state, broadcasts deltas, runs the world clock through alarms | SQLite storage, WebSockets |

## A visit end to end

1. The browser loads `/` from static assets and runs the client. It fetches `/api/world` (a JSON snapshot, cached for
   five seconds) so the clearing paints immediately even if the socket is slow.
2. The client opens `wss://…/api/ws`. The Worker checks the rate-limit binding with the connecting address as key
   (counted in Cloudflare memory for one minute, never stored) and forwards the upgrade to the `Clearing` object named
   `main`.
3. The object accepts the socket with the hibernation API, deals a hand of three things, sends `hello` with a fresh
   snapshot and the connection's budgets, then performs the arrival: picks a quiet room, finds a path from the entry
   cell to its doorstep, increments wear on every cell of the path, lights the window, increments the visit count.
   Those four deltas go to every open socket, so other watchers see the figure walk in.
4. A visitor action (`build`, `place`, `chalk`, `nudge`, `wave`) arrives as a message. The object checks the
   connection's remaining budget, runs the shared rule, writes the change, replies `ack` or `nope` to the sender,
   and broadcasts the delta. The client applies deltas optimistically never; it only draws what the object confirmed.
5. After a build or a placement the object checks how crowded the ground is. Past 30 percent it increments
   `growth`, and a `grow` delta makes every client recompute the clearing, the forest ring and the camera.
6. Every ten minutes while anyone has been around in the last day (six hours otherwise), the alarm wakes the object:
   creatures may hop one cell, a new creature may hatch once the settlement has grown, and rarely an omen begins
   (a window with eyes, a hum from the cave, a tall visitor crossing the moon). Those are deltas too.

## Data and storage

The object's SQLite database holds five tables: `meta` (version, counters, visit total, growth, last activity,
current omen), `rooms` (position, stack level, hue, roof, last lit time, light count, the 64-cell slate as a digit string),
`things` (kind, position, placed time), `creatures` (position, facing, last move) and `tiles` (wear per ground cell).
Growth of saplings and the glow of windows are not stored; both derive from age at render time.

Cloudflare keeps point-in-time recovery for SQLite-backed objects for thirty days. The snapshot route is also the
export: `GET /api/world` returns the entire world as JSON, so a copy can be taken at any time with no credential.
No restore has been exercised; see `docs/DEPLOYMENT.md`.

## Boundaries and integrations

- **Trust:** the client is untrusted. Every message is shape-checked, budget-checked and rule-checked in the object.
  Messages over 4 KB or faster than 120 ms apart are refused.
- **Network:** Cloudflare terminates TLS and runs the Worker; the object runs in one location. The rate limit is
  per Cloudflare location and approximate, which is enough for a toy.
- **Third parties:** Cloudflare only. No fonts, scripts, images or analytics are loaded from anywhere else.
- **Identity:** none. A connection is the only identity; budgets live in the socket's attachment and vanish with it.

## Invariants

- For visitors the world only grows: rows are inserted or updated upward (lights, wear, chalk cells from bare to a
  colour, growth). Creatures move but are never removed. The only deletions are the operator's two moderation
  routes: wiping one slate and removing one thing.
- The clearing at growth `g` is the base blob widened by `g` cells, never past growth 30, always inside the grid.
- Every room stack is connected to the settlement through ground neighbours, and no stack exceeds `MAX_HEIGHT`.
- Nothing stands on the well cell.
- The client and the Worker import the same `world.ts`; a rule change in one place changes both.
- No visitor-identifying data is written anywhere in the object.

## Known compromises

- A reconnect is a new arrival (new walker, new lit window, visit count plus one). The client retries at most three
  times with growing delays so a flaky connection cannot flood the clearing.
- The world is read in full for every action (`snapshot()` then `new World()`); at a few hundred rooms this is
  microseconds, and it keeps the rules honest. It will need an in-memory world if the place ever grows large.
- The operator routes are plain HTTP with a bearer secret and no audit record beyond Cloudflare's own request
  logs. That is enough for one operator; it is not an administration system.
- Omens and the moon crossing are timed from the object's clock and the shared seed so everyone sees them together;
  a client whose clock skews badly sees them slightly off.

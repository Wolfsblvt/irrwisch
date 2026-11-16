# Irrwisch

## Meaning

Irrwisch is a small night clearing in the woods that exists only because people came by. It is one page on the
internet. Every visitor leaves a trace just by arriving: a window lights up, the ground wears a little where their
figure walked in. Most visitors do one more small thing before they leave: build a room onto the settlement, put a
lantern or a sapling on the ground, chalk a few pixels onto a sign, or shoo one of the little creatures a step along.
Nothing is ever torn down. The clearing is what everyone who has ever been there has made of it, together, and it
keeps changing a little while nobody is watching.

This document owns the product dream and its evaluative lens: why the place matters, what it must feel like, which
destinations are accepted, and what it deliberately refuses. `docs/DECISIONS.md` owns consequential choices and their
reasons; `docs/ARCHITECTURE.md` owns the current shape of the implementation.

Status: Provisional. Tala authored this from Wolf's founding brief on 2026-11-06; Wolf has not ratified the exact
text. Authorized coworkers may evolve it during discovery.

## Origin

Wolf opened the project on 2026-11-06 with spare usage and a deliberately open brief to Tala:

> The concept is to have a small website. A bit cute and adorable, maybe a bit scary, maybe also weird. Each visitor
> will leavy their footprint, just by visiting. And they can.. leave and influence more. Move something, build
> something, draw a small thing. Add something. Change something. Never destroy completely, never change too much.
> But together, every visitor changes and builds the thing together.

> I don't define what it is that they are building or doing. You define. But don't make it simple or primitive. It
> can be elaborate. Use modern website elements, animations, maybe actual graphics rendering, etc. Something that looks
> like a site with a lot of care put into it to build a small place.

> Build something worth having on the internet, and worth for people to spend like a minute or two of their time.

He named the boundary of the page as well: the project is the front, the Impressum and privacy pages exist but are
small to reach, there is a small way to the Wolfsblvt Works site, and nothing else is in the foreground. No subpages,
no landing page leading to an app.

Tala chose what is being built: a settlement in a clearing at night, lit one window at a time by whoever arrives. An
Irrwisch is a will-o'-the-wisp, a small light wandering the woods at night, and in everyday German also a restless
little creature that cannot sit still: cute, slightly eerie, a bit odd. Every visitor is one. The project was first
called Lichtung (the German word for a clearing); on 2026-11-16 Wolf pointed out that Lichtung already names the
interface of Baumhaus, and Tala renamed it. The miniature,
slightly-wrong-on-purpose look comes from Tala's own taste for stop-motion and small strange dioramas, and the one warm
colour in a quiet night palette is her orange. Why this mattered to Wolf beyond the brief is his to say; it is not
recorded here.

## What the place is

A hillside clearing after dark. A path comes in from the edge of the woods. In the middle, a settlement of small
stacked rooms with pitched roofs, each with one window. Around it: dark trees, drifting fog, a moon with a slow face,
things people left on the ground, and a handful of round one-eyed creatures that wander between the houses and blink.

The clearing is rendered live in the browser as a miniature: a slightly tilted isometric diorama with hand-made
proportions, visible grain, and stop-motion timing on anything that moves. It should look cared for and a little odd,
never slick. Cute first, with an unease that only shows if you keep looking: a window with eyes, a shape crossing the
moon, a cave mouth where the worn paths also lead.

## What a visitor does

The whole visit takes a minute or two and needs no account, no name, no reading.

1. **Arrive.** A tiny figure with a lantern walks in from the path edge to a door. The ground it crosses wears a
   little more. A window lights up and stays lit for a while, then settles to an ember that never fully goes out.
   The visitor count goes up by one. Other people present at that moment see the figure arrive.
2. **Build one room.** Place a room block on top of a stack or on the ground beside the settlement, so the village
   stays connected and never taller than a few storeys. Roof shape and colour come from a small palette; the visitor
   picks the spot, or lets the clearing choose one.
3. **Place one small thing.** From a hand of three offered things (lantern, sapling, mushroom, stone, pumpkin, bones,
   scarecrow, and whatever the clearing later learns to offer), put one on an empty ground tile near the village.
   Saplings grow over days whether or not anyone is watching.
4. **Chalk a few pixels.** Every room has an 8 by 8 slate on its wall. A visitor may set up to a dozen cells in chalk
   or ember colour. Cells are never cleared, so signs fill in slowly, drawn by many hands.
5. **Nudge a creature.** Up to three times, shoo one of the little ones a step away. They also wander on their own.
6. **Wave.** Raise the lantern so anyone else in the clearing right now sees it. This leaves no mark.

No text input exists anywhere. No visitor can delete, move back, or repaint anything; the place changes only by the
slow accumulation of other people's small additions. "Never destroy completely, never change too much" is enforced by
the rules of the place. The one exception is the operator, who can wipe a slate or take a thing off the ground when
someone has drawn or arranged something unlawful or hateful. A public page run from Germany needs that, and a place
people are invited into deserves it.

When the ground around the houses gets crowded, the woods step back one cell and the clearing is a little larger for
everyone. The settlement and the clearing grow together.

## How life with it should feel

- **Arrival is the point.** The first ten seconds already do something: the figure walks in, a window lights, the
  count ticks. A visitor who closes the tab immediately has still left a trace.
- **Together, not alongside.** When two people are there at once they see each other arrive, wave, build. The
  presence line says "someone is here with you" rather than showing a number of users.
- **It changes while you are away.** Saplings grow, creatures roam, embers cool, something odd happens now and then.
  Coming back a week later should feel like returning to a place, not reloading a page.
- **Quiet.** No sound by default, no onboarding modal, no streaks, no leaderboards, no share buttons. The whisper
  line at the bottom speaks in short sentences. The footer links are small.
- **Honest and private.** No cookies, no browser storage, no analytics, no third-party fonts or scripts. Everything a
  visitor leaves is anonymous and public by design. The privacy page says exactly that.
- **Accessible.** Every verb has a keyboard route: build and place can let the clearing choose a spot, chalk is a
  real grid of buttons, nudge takes the nearest creature. Reduced motion removes drift and walking and keeps the
  place legible.

## Accepted destinations

These are part of the complete product even where the first cut implements less:

- the live shared clearing with arrival, build, place, chalk, nudge and wave as described;
- a world that evolves on its own clock: growth, wandering, cooling embers, and occasional rare events that everyone
  sees at the same moment;
- a clearing that widens as the settlement grows, so the place does not fill up and stop;
- a canonical public Home under a Wolf-owned domain, automatic publication from accepted `main`, and the shared
  Wolfsblvt Works legal surface;
- the identity asset set for the Irrwisch mark and wordmark;
- a visible past: the age of embers, the wear of paths, and the growth stage of trees should read as time without a
  timeline widget.

## Open possibilities

Not accepted, not rejected; worth keeping near:

- what happens when the woods cannot step back any further (after thirty steps the clearing holds a few thousand
  things): a second clearing down the path, or old things sinking into moss, or simply a finished place;
- seasons or weather that change the palette over the real year;
- an optional sound layer behind a visible switch;
- rare "visitors from the woods" that arrive on their own and leave strange things;
- a very small way to find the room you built again on a later visit without storing anything on the visitor's
  device (a shareable link to a coordinate, for instance);
- an occasional still image of the clearing published as the social preview, so sharing the link shows the real
  current place.

## What it refuses

- Accounts, names, free text, chat, comments, uploads.
- Visitors deleting or overwriting anything another visitor left. The operator removes only unlawful or hateful
  content and repairs the world after real damage; taste is not a reason.
- Growth mechanics that reward returning often: no streaks, no currency, no unlocks tied to the visitor.
- Tracking, analytics products, consent banners made necessary by optional storage, remote resources.
- Becoming a platform: one clearing, one page. A second place would be a second project.

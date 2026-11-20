/**
 * Boot: fetch the clearing, draw it, connect, and wire the verbs.
 */
import type { ServerMessage } from '../shared/protocol.ts';
import { type Snapshot, type ThingKind, seedSnapshot } from '../shared/world.ts';
import { connect, type Connection } from './net.ts';
import { Scene } from './scene.ts';
import { type Mode, Ui } from './ui.ts';
import { View } from './view.ts';

const NOPE_WHISPERS: Record<string, string> = {
  spent: 'you have done that already tonight.',
  outside: 'that is the woods.',
  reserved: 'the well stays a well.',
  occupied: 'something is already there.',
  'too-high': 'that stack is tall enough.',
  detached: 'rooms lean on other rooms.',
  far: 'closer to the houses.',
  taken: 'someone chalked that cell first.',
  hurry: 'slowly.',
  full: 'the clearing is full tonight.',
  stuck: 'it has nowhere to go.',
  hand: 'that is not in your hand.',
  creature: 'it wandered off.',
  kind: 'the clearing does not know that thing.',
};

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-clearing]');
  const overlay = document.querySelector<HTMLElement>('[data-overlay]');
  if (!canvas || !overlay) return;

  let snapshot: Snapshot;
  try {
    const response = await fetch('/api/world', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`world ${response.status}`);
    snapshot = (await response.json()) as Snapshot;
  } catch {
    // Draw the seed clearing so the page is never empty; the socket will replace it.
    snapshot = seedSnapshot(Date.now());
  }

  const view = new View(snapshot);
  const scene = new Scene(canvas, view);
  let connection: Connection | null = null;
  let pickedThing: ThingKind | null = null;

  const ui = new Ui(overlay, {
    onMode(mode: Mode) {
      scene.hover = null;
      if (mode !== 'place') pickedThing = null;
    },
    onChoose(mode) {
      if (mode === 'build') {
        if (send({ t: 'build' })) view.expecting.room += 1;
      } else if (pickedThing) {
        if (send({ t: 'place', kind: pickedThing })) view.expecting.thing += 1;
      }
    },
    onPickThing(kind) {
      pickedThing = kind;
    },
    onChalkSubmit(room, strokes) {
      if (send({ t: 'chalk', room, strokes })) view.expecting.chalk += 1;
    },
    onNudgeNearest() {
      const creatures = [...view.world.creatures.values()];
      if (creatures.length === 0) return;
      const creature = creatures[Math.floor(Math.random() * creatures.length)];
      if (send({ t: 'nudge', creature: creature.id })) view.expecting.hop += 1;
    },
    onWave() {
      if (send({ t: 'wave' })) view.expecting.wave += 1;
    },
  });
  ui.setCount(view.visits, 1);
  ui.setOnline(false);

  function send(message: Parameters<Connection['send']>[0]): boolean {
    if (!connection) return false;
    const sent = connection.send(message);
    if (!sent) ui.whisper('the clearing is out of reach right now.');
    return sent;
  }

  view.subscribe((event) => {
    switch (event.kind) {
      case 'visits':
      case 'presence':
        ui.setCount(view.visits, view.presence);
        return;
      case 'arrival':
        if (event.mine) ui.whisper('you walked in. a window lit for you.', 7000);
        else ui.whisper('someone just arrived.');
        return;
      case 'room':
        if (event.mine) ui.whisper('your room is part of the place now.');
        else ui.whisper('someone built a room.');
        return;
      case 'thing':
        if (event.mine) ui.whisper('it will still be there tomorrow.');
        else ui.whisper('someone left something.');
        return;
      case 'chalk':
        if (event.mine) ui.whisper('chalked. it never washes off.');
        else ui.whisper('someone is chalking.');
        return;
      case 'hop':
        ui.whisper(event.mine ? 'it hopped. it did not seem to mind.' : 'one of the little ones moved.', 3000);
        return;
      case 'wave':
        if (!event.mine) ui.whisper('someone waved at you.');
        return;
      case 'grow':
        scene.relayout();
        scene.fitToSettlement();
        ui.whisper('the woods stepped back a little.', 8000);
        return;
      case 'omen':
        if (event.omen?.kind === 'eyes') ui.whisper('one of the windows is looking back.', 9000);
        if (event.omen?.kind === 'hum') ui.whisper('something is humming in the cave.', 9000);
        if (event.omen?.kind === 'visitor') ui.whisper('something tall is walking past the moon.', 9000);
        return;
      default:
        return;
    }
  });

  connection = connect({
    onOpen() {
      ui.setOnline(true);
    },
    onClose(final) {
      ui.setOnline(false);
      ui.whisper(final ? 'the clearing went quiet. reload to walk in again.' : 'the path flickered. trying again…', 8000);
    },
    onMessage(message: ServerMessage) {
      switch (message.t) {
        case 'hello':
          view.replace(message.world);
          view.presence = message.presence;
          view.omen = message.omen;
          // A reload within the same night is not a new arrival: no walker comes for it.
          view.expectingArrival = !message.returning;
          if (message.returning) ui.whisper('welcome back. the night remembers you.', 7000);
          ui.setBudgets(message.budgets);
          ui.setHand(message.hand);
          ui.setCount(view.visits, view.presence);
          scene.relayout();
          scene.fitToSettlement();
          return;
        case 'delta':
          view.apply(message.ops);
          return;
        case 'ack':
          ui.setBudgets(message.budgets);
          if (message.note === 'chosen') ui.whisper('the clearing chose a spot for you.');
          if (message.of === 'build' || message.of === 'place') ui.setMode('look');
          return;
        case 'nope':
          ui.setBudgets(message.budgets);
          ui.whisper(NOPE_WHISPERS[message.reason] ?? 'the clearing said no.');
          return;
        default:
          return;
      }
    },
  });

  const about = document.querySelector<HTMLDialogElement>('[data-about]');
  document.querySelector<HTMLButtonElement>('[data-about-open]')?.addEventListener('click', () => about?.showModal());
  about?.addEventListener('click', (event) => {
    // A click on the backdrop (the dialog element itself) closes it.
    if (event.target === about) about.close();
  });

  wirePointer(canvas, scene, ui, view, () => pickedThing, send);
  const resize = () => {
    scene.resize();
    scene.fitToSettlement();
  };
  window.addEventListener('resize', resize);
  scene.start();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') scene.stop();
    else scene.start();
  });
}

function wirePointer(
  canvas: HTMLCanvasElement,
  scene: Scene,
  ui: Ui,
  view: View,
  thing: () => ThingKind | null,
  send: (message: Parameters<Connection['send']>[0]) => boolean,
): void {
  let dragging = false;
  let moved = 0;
  let last = { x: 0, y: 0 };
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;

  const local = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    const point = local(event);
    pointers.set(event.pointerId, point);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      return;
    }
    dragging = true;
    moved = 0;
    last = point;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = local(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0) scene.zoomAt(distance / pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDistance = distance;
      return;
    }
    if (dragging) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) scene.panBy(dx, dy);
      last = point;
    }
    updateHover(point.x, point.y);
  });

  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
    if (!dragging) return;
    dragging = false;
    if (moved > 6) return;
    const point = local(event);
    act(point.x, point.y);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', (event) => {
    pointers.delete(event.pointerId);
    dragging = false;
  });
  canvas.addEventListener('pointerleave', () => {
    if (!dragging) scene.hover = null;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.0015);
    scene.zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  function updateHover(x: number, y: number): void {
    const mode = ui.mode;
    if (mode === 'look') {
      scene.hover = null;
      return;
    }
    scene.hover = scene.hoverFor(mode, x, y, thing() ?? undefined);
  }

  function act(x: number, y: number): void {
    const mode = ui.mode;
    if (mode === 'look') return;
    const hover = scene.hoverFor(mode, x, y, thing() ?? undefined);
    if (!hover) return;
    if (hover.kind === 'build') {
      if (!hover.ok) {
        ui.whisper(hover.cell.x < 0 ? 'tap the ground.' : 'not there. beside a room, or on top of one.');
        return;
      }
      if (send({ t: 'build', x: hover.cell.x, y: hover.cell.y })) view.expecting.room += 1;
    } else if (hover.kind === 'place') {
      if (!thing()) {
        ui.whisper('pick something from your hand first.');
        return;
      }
      if (!hover.ok) {
        ui.whisper('free ground near the houses, please.');
        return;
      }
      if (send({ t: 'place', kind: hover.thing, x: hover.cell.x, y: hover.cell.y })) view.expecting.thing += 1;
    } else if (hover.kind === 'chalk') {
      if (!hover.room) {
        ui.whisper('tap a room.');
        return;
      }
      ui.openChalk(hover.room);
    } else if (hover.kind === 'nudge') {
      if (!hover.creature) {
        ui.whisper('tap one of the little ones.');
        return;
      }
      const from = scene.worldAt(x, y);
      const cell = { x: Math.round((from.sx / 24 + from.sy / 12) / 2), y: Math.round((from.sy / 12 - from.sx / 24) / 2) };
      if (send({ t: 'nudge', creature: hover.creature.id, from: cell })) view.expecting.hop += 1;
    }
  }
}

void boot();

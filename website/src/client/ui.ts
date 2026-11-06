/**
 * The quiet overlay: a whisper line, the five verbs with their remaining
 * budget, the hand of things, and the chalk slate. Everything a pointer can
 * do on the canvas also has a button.
 */
import {
  type Budgets,
  CHALK_BARE,
  CHALK_EMBER,
  CHALK_WHITE,
  type ChalkColour,
  type ChalkStroke,
  type Room,
  SIGN_CELLS,
  SIGN_SIZE,
  type ThingKind,
} from '../shared/world.ts';

export type Mode = 'look' | 'build' | 'place' | 'chalk' | 'nudge';

export interface UiHandlers {
  onMode(mode: Mode): void;
  onChoose(mode: 'build' | 'place'): void;
  onPickThing(kind: ThingKind): void;
  onChalkSubmit(room: number, strokes: ChalkStroke[]): void;
  onNudgeNearest(): void;
  onWave(): void;
}

const THING_LABELS: Record<ThingKind, string> = {
  lantern: 'a lantern',
  sapling: 'a sapling',
  mushroom: 'mushrooms',
  stone: 'a stone',
  pumpkin: 'a pumpkin',
  bones: 'bones',
  scarecrow: 'a scarecrow',
};

export class Ui {
  private readonly root: HTMLElement;
  private readonly whisperLine: HTMLElement;
  private readonly countLine: HTMLElement;
  private readonly buttons = new Map<Mode | 'wave', HTMLButtonElement>();
  private readonly handPanel: HTMLElement;
  private readonly chooseButton: HTMLButtonElement;
  private readonly nearestButton: HTMLButtonElement;
  private readonly chalkPanel: HTMLElement;
  private readonly chalkGrid: HTMLElement;
  private readonly chalkCells: HTMLButtonElement[] = [];
  private readonly chalkCount: HTMLElement;
  private readonly chalkWhiteButton: HTMLButtonElement;
  private readonly chalkEmberButton: HTMLButtonElement;
  private readonly chalkSend: HTMLButtonElement;
  private readonly chalkCancel: HTMLButtonElement;
  private chalkRoom: Room | null = null;
  private chalkColour: ChalkColour = CHALK_WHITE;
  private chalkPending = new Map<number, ChalkColour>();
  private budgets: Budgets = { build: 0, place: 0, chalk: 0, nudge: 0 };
  private hand: ThingKind[] = [];
  private pickedThing: ThingKind | null = null;
  mode: Mode = 'look';
  private whisperTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly handlers: UiHandlers;

  constructor(root: HTMLElement, handlers: UiHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.whisperLine = must(root, '[data-whisper]');
    this.countLine = must(root, '[data-count]');
    this.handPanel = must(root, '[data-hand]');
    this.chooseButton = must(root, '[data-choose]');
    this.nearestButton = must(root, '[data-nearest]');
    this.chalkPanel = must(root, '[data-chalk]');
    this.chalkGrid = must(root, '[data-chalk-grid]');
    this.chalkCount = must(root, '[data-chalk-count]');
    this.chalkWhiteButton = must(root, '[data-chalk-white]');
    this.chalkEmberButton = must(root, '[data-chalk-ember]');
    this.chalkSend = must(root, '[data-chalk-send]');
    this.chalkCancel = must(root, '[data-chalk-cancel]');

    for (const mode of ['build', 'place', 'chalk', 'nudge'] as const) {
      const button = must<HTMLButtonElement>(root, `[data-verb="${mode}"]`);
      this.buttons.set(mode, button);
      button.addEventListener('click', () => this.setMode(this.mode === mode ? 'look' : mode));
    }
    const wave = must<HTMLButtonElement>(root, '[data-verb="wave"]');
    this.buttons.set('wave', wave);
    wave.addEventListener('click', () => handlers.onWave());

    this.chooseButton.addEventListener('click', () => {
      if (this.mode === 'build' || this.mode === 'place') handlers.onChoose(this.mode);
    });
    this.nearestButton.addEventListener('click', () => handlers.onNudgeNearest());
    this.chalkWhiteButton.addEventListener('click', () => this.setChalkColour(CHALK_WHITE));
    this.chalkEmberButton.addEventListener('click', () => this.setChalkColour(CHALK_EMBER));
    this.chalkSend.addEventListener('click', () => this.submitChalk());
    this.chalkCancel.addEventListener('click', () => this.closeChalk());
    this.buildChalkGrid();

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.mode !== 'look') {
        event.preventDefault();
        this.setMode('look');
      }
    });
  }

  // ----- State --------------------------------------------------------------

  setBudgets(budgets: Budgets): void {
    this.budgets = budgets;
    for (const mode of ['build', 'place', 'chalk', 'nudge'] as const) {
      const button = this.buttons.get(mode);
      if (!button) continue;
      const left = budgets[mode];
      const dots = button.querySelector('[data-dots]');
      if (dots) dots.textContent = mode === 'chalk' ? (left > 0 ? `${left}` : '') : '·'.repeat(Math.max(0, left));
      button.disabled = left <= 0;
      button.setAttribute('aria-label', `${button.dataset.label ?? mode}, ${left} left`);
    }
    const wave = this.buttons.get('wave');
    if (wave) wave.disabled = false;
    if (this.mode !== 'look' && this.mode !== 'chalk' && budgets[this.mode] <= 0) this.setMode('look');
    if (this.chalkRoom) this.updateChalkCount();
  }

  setHand(hand: ThingKind[]): void {
    this.hand = hand;
    this.handPanel.replaceChildren();
    for (const kind of hand) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card';
      button.dataset.kind = kind;
      button.textContent = THING_LABELS[kind];
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => this.pickThing(kind));
      this.handPanel.append(button);
    }
  }

  setCount(visits: number, presence: number): void {
    const walked = visits === 1 ? 'one has walked here.' : `${visits.toLocaleString('en-US')} have walked here.`;
    const here = presence > 1 ? (presence === 2 ? ' someone is here with you.' : ` ${presence - 1} others are here with you.`) : '';
    this.countLine.textContent = `${walked}${here}`;
  }

  whisper(text: string, hold = 6000): void {
    this.whisperLine.textContent = text;
    this.whisperLine.classList.add('is-on');
    if (this.whisperTimer) clearTimeout(this.whisperTimer);
    this.whisperTimer = setTimeout(() => this.whisperLine.classList.remove('is-on'), hold);
  }

  setOnline(online: boolean): void {
    this.root.classList.toggle('is-offline', !online);
    for (const button of this.buttons.values()) {
      if (!online) button.disabled = true;
    }
    if (online) this.setBudgets(this.budgets);
  }

  // ----- Modes ---------------------------------------------------------------

  setMode(mode: Mode): void {
    if (this.mode === 'chalk' && mode !== 'chalk') this.closeChalk(false);
    this.mode = mode;
    for (const [name, button] of this.buttons) {
      button.setAttribute('aria-pressed', name === mode ? 'true' : 'false');
    }
    this.root.dataset.mode = mode;
    this.handPanel.hidden = mode !== 'place';
    this.chooseButton.hidden = !(mode === 'build' || (mode === 'place' && this.pickedThing !== null));
    this.nearestButton.hidden = mode !== 'nudge';
    if (mode === 'place' && this.pickedThing === null && this.hand.length > 0) {
      this.whisper('pick something from your hand.');
    } else if (mode === 'build') {
      this.whisper('tap a spot beside or on top of a room, or let the clearing choose.');
    } else if (mode === 'chalk') {
      this.whisper('tap a room to chalk its slate.');
    } else if (mode === 'nudge') {
      this.whisper('tap one of the little ones to shoo it a step.');
    }
    this.handlers.onMode(mode);
  }

  get currentThing(): ThingKind | null {
    return this.pickedThing;
  }

  private pickThing(kind: ThingKind): void {
    this.pickedThing = kind;
    for (const card of this.handPanel.querySelectorAll<HTMLButtonElement>('.card')) {
      card.setAttribute('aria-pressed', card.dataset.kind === kind ? 'true' : 'false');
    }
    this.chooseButton.hidden = false;
    this.whisper(`tap free ground near the houses for ${THING_LABELS[kind]}, or let the clearing choose.`);
    this.handlers.onPickThing(kind);
  }

  // ----- Chalk -----------------------------------------------------------------

  openChalk(room: Room): void {
    this.chalkRoom = room;
    this.chalkPending = new Map();
    this.chalkPanel.hidden = false;
    this.chalkPanel.dataset.room = String(room.id);
    for (let index = 0; index < SIGN_CELLS; index += 1) {
      const cell = this.chalkCells[index];
      const value = room.sign[index];
      cell.dataset.value = String(value);
      cell.disabled = value !== CHALK_BARE;
      cell.setAttribute('aria-pressed', 'false');
    }
    this.updateChalkCount();
    this.chalkCells[0]?.focus();
  }

  closeChalk(backToLook = true): void {
    this.chalkRoom = null;
    this.chalkPending = new Map();
    this.chalkPanel.hidden = true;
    if (backToLook && this.mode === 'chalk') this.setMode('look');
  }

  private buildChalkGrid(): void {
    this.chalkGrid.replaceChildren();
    this.chalkGrid.style.setProperty('--size', String(SIGN_SIZE));
    for (let index = 0; index < SIGN_CELLS; index += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chalk-cell';
      const column = index % SIGN_SIZE;
      const row = SIGN_SIZE - 1 - Math.floor(index / SIGN_SIZE);
      button.style.gridColumn = String(column + 1);
      button.style.gridRow = String(row + 1);
      button.setAttribute('aria-label', `cell ${column + 1}, ${SIGN_SIZE - row}`);
      button.addEventListener('click', () => this.toggleChalkCell(index));
      this.chalkCells.push(button);
      this.chalkGrid.append(button);
    }
  }

  private toggleChalkCell(index: number): void {
    if (!this.chalkRoom) return;
    const cell = this.chalkCells[index];
    if (this.chalkPending.has(index)) {
      this.chalkPending.delete(index);
      cell.dataset.value = '0';
      cell.setAttribute('aria-pressed', 'false');
    } else {
      if (this.chalkPending.size >= this.budgets.chalk) {
        this.whisper('that is all the chalk you have tonight.');
        return;
      }
      this.chalkPending.set(index, this.chalkColour);
      cell.dataset.value = String(this.chalkColour);
      cell.setAttribute('aria-pressed', 'true');
    }
    this.updateChalkCount();
  }

  private setChalkColour(colour: ChalkColour): void {
    this.chalkColour = colour;
    this.chalkWhiteButton.setAttribute('aria-pressed', colour === CHALK_WHITE ? 'true' : 'false');
    this.chalkEmberButton.setAttribute('aria-pressed', colour === CHALK_EMBER ? 'true' : 'false');
  }

  private updateChalkCount(): void {
    const left = Math.max(0, this.budgets.chalk - this.chalkPending.size);
    this.chalkCount.textContent = `${left} chalk left`;
    this.chalkSend.disabled = this.chalkPending.size === 0;
  }

  private submitChalk(): void {
    if (!this.chalkRoom || this.chalkPending.size === 0) return;
    const strokes: ChalkStroke[] = [...this.chalkPending.entries()].map(([cell, colour]) => [cell, colour]);
    this.handlers.onChalkSubmit(this.chalkRoom.id, strokes);
    this.closeChalk();
  }
}

function must<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Overlay is missing ${selector}`);
  return element;
}

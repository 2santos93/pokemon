import { legalActions } from "./engine";
import { createRng as defaultCreateRng, type RNG } from "./rng";
import type { ClientMessage, RoomView, ServerMessage } from "./protocol";
import {
  applyAction, applyDisconnect, applyForfeit, applyLead, applyProfile, awaitingSlots,
  createRoom, joinRoom, needsTeamRoll, readyToStart, resetForRematch,
  resolveIfReady, resolveOnTimeout, startBattle, viewFor as roomViewFor, withTeams, type Room,
} from "./room";
import type { BattlePokemon, SideIndex, TurnAction } from "./types";

/** Opaque timer handle — whatever `setTimer` returns (a Node timeout, a number…). */
type TimerHandle = unknown;

const defaultSetTimer = (fn: () => void, ms: number): TimerHandle => {
  const handle = setTimeout(fn, ms);
  // Don't let a lone turn timer keep the process alive; the socket server does.
  (handle as { unref?: () => void }).unref?.();
  return handle;
};
const defaultClearTimer = (handle: TimerHandle): void =>
  clearTimeout(handle as ReturnType<typeof setTimeout>);
const defaultNow = (): number => Date.now();

/** Default per-decision-point timer. */
const DEFAULT_TURN_MS = 15_000;

export interface ServerDeps {
  rollTeam: (rng: RNG) => Promise<BattlePokemon[]>;
  send: (roomId: string, slot: SideIndex, msg: ServerMessage) => void;
  createRng?: (seed: number) => RNG;
  /** Injectable clock/timers (default: real setTimeout/clearTimeout/Date.now). Tests pass fakes. */
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  now?: () => number;
  /** Milliseconds a player has to choose each decision point (default 15000). */
  turnMs?: number;
}

interface Entry {
  room: Room;
  rng: RNG;
  rolling: boolean;
  /** Handle for the running turn timer, or null when no timer is armed/paused. */
  timer: TimerHandle | null;
  /** Epoch-ms deadline of the running timer, mirrored into every RoomView. */
  deadline: number | null;
}

const SLOTS: SideIndex[] = [0, 1];

export class BattleServer {
  private rooms = new Map<string, Entry>();
  private seq = 1;

  constructor(private readonly deps: ServerDeps) {}

  join(roomId: string, token?: string): SideIndex | null {
    let entry = this.rooms.get(roomId);
    if (!entry) {
      const make = this.deps.createRng ?? defaultCreateRng;
      entry = { room: createRoom(roomId), rng: make(this.seq++), rolling: false, timer: null, deadline: null };
      this.rooms.set(roomId, entry);
    }
    const result = joinRoom(entry.room, token);
    if ("error" in result) return null;
    entry.room = result.room;
    // resumes a timer paused while nobody was connected; a running timer is untouched
    this.resumeTurnTimerIfPaused(roomId, entry);
    this.broadcast(roomId);
    return result.slot;
  }

  /** A one-off snapshot of the room, from a single slot's point of view. */
  viewFor(roomId: string, slot: SideIndex): RoomView | null {
    const entry = this.rooms.get(roomId);
    if (!entry || !entry.room.players[slot]) return null;
    return roomViewFor(entry.room, slot, entry.deadline);
  }

  async message(roomId: string, slot: SideIndex, msg: ClientMessage): Promise<void> {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    switch (msg.type) {
      case "setProfile":
        entry.room = applyProfile(entry.room, slot, msg.nickname, msg.gender);
        this.broadcast(roomId);
        if (needsTeamRoll(entry.room)) await this.rollTeams(roomId);
        break;
      case "chooseLead":
        entry.room = applyLead(entry.room, slot, msg.teamIndex);
        this.broadcast(roomId);
        if (readyToStart(entry.room)) {
          entry.room = startBattle(entry.room);
          this.armTurnTimer(roomId, entry); // first decision point of the battle
          this.broadcast(roomId);
        }
        break;
      case "action":
        if (!awaitingSlots(entry.room).includes(slot)) return;
        if (!this.isLegal(entry.room, slot, msg.action)) return;
        entry.room = applyAction(entry.room, slot, msg.action);
        this.advance(roomId);
        break;
      case "rematch":
        entry.room = resetForRematch(entry.room);
        this.clearTurnTimer(entry);
        this.broadcast(roomId);
        if (needsTeamRoll(entry.room)) await this.rollTeams(roomId);
        break;
      case "forfeit":
        entry.room = applyForfeit(entry.room, slot);
        this.clearTurnTimer(entry);
        this.broadcast(roomId);
        break;
    }
  }

  disconnect(roomId: string, slot: SideIndex): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    entry.room = applyDisconnect(entry.room, slot);
    // pause timer when empty so turns don't burn unattended; join() resumes it
    if (this.connectedCount(entry) === 0) this.clearTurnTimer(entry);
    this.broadcast(roomId);
  }

  private isLegal(room: Room, slot: SideIndex, action: TurnAction): boolean {
    if (!room.battle) return false;
    return legalActions(room.battle, slot).some((legal) =>
      action.kind === "move"
        ? legal.kind === "move" && legal.moveIndex === action.moveIndex
        : legal.kind === "switch" && legal.teamIndex === action.teamIndex,
    );
  }

  private async rollTeams(roomId: string): Promise<void> {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    if (entry.rolling) return;
    entry.rolling = true;
    try {
      const t0 = await this.deps.rollTeam(entry.rng);
      const t1 = await this.deps.rollTeam(entry.rng);
      entry.room = withTeams(entry.room, t0, t1);
      this.broadcast(roomId);
    } finally {
      entry.rolling = false;
    }
  }

  private advance(roomId: string): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    const result = resolveIfReady(entry.room, entry.rng);
    if (result) {
      entry.room = result.room;
      for (const slot of SLOTS) this.deps.send(roomId, slot, { type: "events", events: result.events });
      this.armTurnTimer(roomId, entry); // fresh decision point → restart the clock
    }
    this.broadcast(roomId);
  }

  private now(): number {
    return (this.deps.now ?? defaultNow)();
  }

  private connectedCount(entry: Entry): number {
    return entry.room.players.filter((p) => p?.connected).length;
  }

  /** A timer should run only while there's a live decision point and someone to see it. */
  private canRunTimer(entry: Entry): boolean {
    return awaitingSlots(entry.room).length > 0 && this.connectedCount(entry) > 0;
  }

  private clearTurnTimer(entry: Entry): void {
    if (entry.timer !== null) {
      (this.deps.clearTimer ?? defaultClearTimer)(entry.timer);
      entry.timer = null;
    }
    entry.deadline = null;
  }

  /** Cancel any running timer and start a fresh one for the current decision point. */
  private armTurnTimer(roomId: string, entry: Entry): void {
    this.clearTurnTimer(entry);
    if (!this.canRunTimer(entry)) return;
    const turnMs = this.deps.turnMs ?? DEFAULT_TURN_MS;
    entry.deadline = this.now() + turnMs;
    entry.timer = (this.deps.setTimer ?? defaultSetTimer)(() => this.onTurnTimeout(roomId), turnMs);
  }

  private resumeTurnTimerIfPaused(roomId: string, entry: Entry): void {
    if (entry.timer === null && this.canRunTimer(entry)) this.armTurnTimer(roomId, entry);
  }

  private onTurnTimeout(roomId: string): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    entry.timer = null;
    entry.deadline = null;
    const result = resolveOnTimeout(entry.room, entry.rng);
    if (result) {
      entry.room = result.room;
      for (const slot of SLOTS) this.deps.send(roomId, slot, { type: "events", events: result.events });
    }
    this.armTurnTimer(roomId, entry); // arm the next decision point if the battle continues
    this.broadcast(roomId);
  }

  private broadcast(roomId: string): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    for (const slot of SLOTS) {
      if (entry.room.players[slot]?.connected) {
        this.deps.send(roomId, slot, { type: "state", view: roomViewFor(entry.room, slot, entry.deadline) });
      }
    }
  }
}

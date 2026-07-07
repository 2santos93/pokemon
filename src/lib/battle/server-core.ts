import { legalActions } from "./engine";
import { createRng as defaultCreateRng, type RNG } from "./rng";
import type { ClientMessage, ServerMessage } from "./protocol";
import {
  applyAction, applyDisconnect, applyLead, applyProfile, awaitingSlots,
  createRoom, joinRoom, needsTeamRoll, readyToStart, resetForRematch,
  resolveIfReady, startBattle, viewFor, withTeams, type Room,
} from "./room";
import type { BattlePokemon, SideIndex, TurnAction } from "./types";

export interface ServerDeps {
  rollTeam: (rng: RNG) => Promise<BattlePokemon[]>;
  send: (roomId: string, slot: SideIndex, msg: ServerMessage) => void;
  createRng?: (seed: number) => RNG;
}

interface Entry {
  room: Room;
  rng: RNG;
}

const SLOTS: SideIndex[] = [0, 1];

export class BattleServer {
  private rooms = new Map<string, Entry>();
  private seq = 1;

  constructor(private readonly deps: ServerDeps) {}

  join(roomId: string): SideIndex | null {
    let entry = this.rooms.get(roomId);
    if (!entry) {
      const make = this.deps.createRng ?? defaultCreateRng;
      entry = { room: createRoom(roomId), rng: make(this.seq++) };
      this.rooms.set(roomId, entry);
    }
    const result = joinRoom(entry.room);
    if ("error" in result) return null;
    entry.room = result.room;
    this.broadcast(roomId);
    return result.slot;
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
        this.broadcast(roomId);
        if (needsTeamRoll(entry.room)) await this.rollTeams(roomId);
        break;
    }
  }

  disconnect(roomId: string, slot: SideIndex): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    entry.room = applyDisconnect(entry.room, slot);
    this.broadcast(roomId);
  }

  private isLegal(room: Room, slot: SideIndex, action: TurnAction): boolean {
    if (!room.battle) return false;
    return legalActions(room.battle, slot).some((legal) =>
      legal.kind === action.kind &&
      (legal.kind === "move"
        ? legal.moveIndex === (action as { moveIndex: number }).moveIndex
        : legal.teamIndex === (action as { teamIndex: number }).teamIndex),
    );
  }

  private async rollTeams(roomId: string): Promise<void> {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    const t0 = await this.deps.rollTeam(entry.rng);
    const t1 = await this.deps.rollTeam(entry.rng);
    entry.room = withTeams(entry.room, t0, t1);
    this.broadcast(roomId);
  }

  private advance(roomId: string): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    const result = resolveIfReady(entry.room, entry.rng);
    if (result) {
      entry.room = result.room;
      for (const slot of SLOTS) this.deps.send(roomId, slot, { type: "events", events: result.events });
    }
    this.broadcast(roomId);
  }

  private broadcast(roomId: string): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    for (const slot of SLOTS) {
      if (entry.room.players[slot]?.connected) {
        this.deps.send(roomId, slot, { type: "state", view: viewFor(entry.room, slot) });
      }
    }
  }
}

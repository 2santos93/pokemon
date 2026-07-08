import type { Gender, PlayerView, RoomView } from "./protocol";
import type { BattlePokemon, BattleState, SideIndex, TurnAction, BattleEvent } from "./types";
import type { RoomPhase } from "./protocol";
import { createBattle, chooseReplacement, resolveTurn } from "./engine";
import type { RNG } from "./rng";

export interface RoomPlayer {
  slot: SideIndex;
  nickname: string | null;
  gender: Gender | null;
  connected: boolean;
  team: BattlePokemon[] | null;
  lead: number | null;
  pendingAction: TurnAction | null;
  token?: string;
}

export interface Room {
  id: string;
  phase: RoomPhase;
  players: [RoomPlayer | null, RoomPlayer | null];
  battle: BattleState | null;
  winnerSlot: SideIndex | null;
}

export function createRoom(id: string): Room {
  return { id, phase: "waiting", players: [null, null], battle: null, winnerSlot: null };
}

function newPlayer(slot: SideIndex, token?: string): RoomPlayer {
  return {
    slot, nickname: null, gender: null, connected: true,
    team: null, lead: null, pendingAction: null, token,
  };
}

export function joinRoom(
  room: Room,
  token?: string,
): { room: Room; slot: SideIndex } | { error: string } {
  if (token) {
    for (const player of room.players) {
      if (player && player.token === token) {
        const next = structuredClone(room);
        next.players[player.slot]!.connected = true;
        return { room: next, slot: player.slot };
      }
    }
  }
  const slot: SideIndex | null = room.players[0] === null ? 0 : room.players[1] === null ? 1 : null;
  if (slot === null) return { error: "room full" };
  const next = structuredClone(room);
  next.players[slot] = newPlayer(slot, token);
  if (next.players[0] && next.players[1]) next.phase = "lobby";
  return { room: next, slot };
}

export function applyProfile(
  room: Room,
  slot: SideIndex,
  nickname: string,
  gender: Gender,
): Room {
  const next = structuredClone(room);
  const player = next.players[slot];
  if (player) {
    player.nickname = nickname;
    player.gender = gender;
  }
  return next;
}

export function bothProfiled(room: Room): boolean {
  return Boolean(room.players[0]?.nickname && room.players[1]?.nickname);
}

export function needsTeamRoll(room: Room): boolean {
  return room.phase === "lobby" && bothProfiled(room);
}

export function withTeams(room: Room, team0: BattlePokemon[], team1: BattlePokemon[]): Room {
  const next = structuredClone(room);
  if (next.players[0]) next.players[0].team = team0;
  if (next.players[1]) next.players[1].team = team1;
  next.phase = "teaming";
  return next;
}

export function applyLead(room: Room, slot: SideIndex, teamIndex: number): Room {
  const player = room.players[slot];
  if (!player?.team) return room;
  if (teamIndex < 0 || teamIndex >= player.team.length) return room;
  const next = structuredClone(room);
  next.players[slot]!.lead = teamIndex;
  return next;
}

export function readyToStart(room: Room): boolean {
  return (
    room.phase === "teaming" &&
    room.players[0]?.lead != null &&
    room.players[1]?.lead != null
  );
}

export function startBattle(room: Room): Room {
  if (room.phase !== "teaming") return room;
  const p0 = room.players[0];
  const p1 = room.players[1];
  if (!p0?.team || p0.lead == null || !p1?.team || p1.lead == null) return room;
  const next = structuredClone(room);
  // applyAction can be called before a battle exists; clear any stale pendingAction
  // from lobby/teaming so it doesn't leak into turn 1.
  if (next.players[0]) next.players[0]!.pendingAction = null;
  if (next.players[1]) next.players[1]!.pendingAction = null;
  next.battle = createBattle(
    { team: next.players[0]!.team!, lead: next.players[0]!.lead! },
    { team: next.players[1]!.team!, lead: next.players[1]!.lead! }
  );
  next.phase = "battle";
  return next;
}

export function awaitingSlots(room: Room): SideIndex[] {
  if (room.phase !== "battle" || !room.battle || room.battle.winner !== null) return [];
  const forced: SideIndex[] = [];
  if (room.battle.forcedSwitch[0]) forced.push(0);
  if (room.battle.forcedSwitch[1]) forced.push(1);
  return forced.length > 0 ? forced : [0, 1];
}

export function applyAction(room: Room, slot: SideIndex, action: TurnAction): Room {
  const next = structuredClone(room);
  if (next.players[slot]) next.players[slot]!.pendingAction = action;
  return next;
}

function finish(room: Room): Room {
  if (room.battle?.winner != null) {
    room.phase = "finished";
    room.winnerSlot = room.battle.winner;
  }
  return room;
}

function timeoutEvent(battle: BattleState, side: SideIndex): BattleEvent {
  const s = battle.sides[side];
  return { type: "timeout", side, pokemon: s.team[s.activeIndex]!.name };
}

function clearPendingActions(room: Room): void {
  room.players[0]!.pendingAction = null;
  room.players[1]!.pendingAction = null;
}

/**
 * Resolves the current decision point, defaulting any unfilled slot to a pass
 * (or auto-switch during a forced switch). `rng` must be the one long-lived
 * instance for this room's whole battle — reseeding per turn would replay
 * identical crit/miss/speed-tie rolls.
 */
function resolveDecision(
  room: Room,
  rng: RNG,
  emitTimeouts: boolean,
): { room: Room; events: BattleEvent[] } {
  const awaiting = awaitingSlots(room);
  const next = structuredClone(room);
  const battle = next.battle!;
  const events: BattleEvent[] = [];

  const forced = battle.forcedSwitch[0] || battle.forcedSwitch[1];
  if (forced) {
    // a flagged slot either submitted a switch or timed out (auto-switches to first living mon)
    for (const slot of awaiting) {
      const submitted = next.players[slot]!.pendingAction;
      if (submitted === null && emitTimeouts) events.push(timeoutEvent(next.battle!, slot));
      const teamIndex =
        submitted?.kind === "switch" ? submitted.teamIndex : next.battle!.sides[slot].activeIndex;
      const result = chooseReplacement(next.battle!, slot, teamIndex);
      next.battle = result.state;
      events.push(...result.events);
      next.players[slot]!.pendingAction = null;
    }
    clearPendingActions(next); // non-forced side may have a stale action from this window
  } else {
    if (emitTimeouts) {
      for (const slot of awaiting) {
        if (next.players[slot]!.pendingAction === null) events.push(timeoutEvent(battle, slot));
      }
    }
    const result = resolveTurn(
      battle,
      [next.players[0]!.pendingAction ?? null, next.players[1]!.pendingAction ?? null],
      rng,
    );
    next.battle = result.state;
    events.push(...result.events);
    clearPendingActions(next);
  }

  return { room: finish(next), events };
}

/** Resolve the current decision point only if all awaited sides have submitted. */
export function resolveIfReady(
  room: Room,
  rng: RNG,
): { room: Room; events: BattleEvent[] } | null {
  const awaiting = awaitingSlots(room);
  if (awaiting.length === 0) return null;
  const actions = awaiting.map((slot) => room.players[slot]?.pendingAction ?? null);
  if (actions.some((a) => a === null)) return null;
  return resolveDecision(room, rng, false);
}

/**
 * Force-resolve the current decision point when the turn timer expires. Any
 * awaited slot that hasn't submitted does nothing (or is auto-switched during a
 * forced switch), and a timeout event is emitted for it.
 */
export function resolveOnTimeout(
  room: Room,
  rng: RNG,
): { room: Room; events: BattleEvent[] } | null {
  if (awaitingSlots(room).length === 0) return null;
  return resolveDecision(room, rng, true);
}

export function applyDisconnect(room: Room, slot: SideIndex): Room {
  const next = structuredClone(room);
  if (next.players[slot]) next.players[slot]!.connected = false;
  return next;
}

export function applyForfeit(room: Room, slot: SideIndex): Room {
  const other: SideIndex = slot === 0 ? 1 : 0;
  const battleInProgress = room.phase === "lobby" || room.phase === "teaming" || room.phase === "battle";
  if (!battleInProgress || !room.players[other]) return room;
  const next = structuredClone(room);
  next.phase = "finished";
  next.winnerSlot = other;
  return next;
}

export function resetForRematch(room: Room): Room {
  const next = structuredClone(room);
  for (const player of next.players) {
    if (player) {
      player.team = null;
      player.lead = null;
      player.pendingAction = null;
      player.connected = true;
    }
  }
  next.battle = null;
  next.winnerSlot = null;
  next.phase = "lobby";
  return next;
}

function playerView(player: RoomPlayer | null): PlayerView | null {
  if (!player) return null;
  return {
    slot: player.slot,
    nickname: player.nickname,
    gender: player.gender,
    connected: player.connected,
    lead: player.lead,
  };
}

export function viewFor(room: Room, slot: SideIndex, turnDeadline: number | null = null): RoomView {
  const awaiting = awaitingSlots(room);
  const submitted: [boolean, boolean] = [
    room.players[0]?.pendingAction != null,
    room.players[1]?.pendingAction != null,
  ];
  // countdown shows only while this slot is awaited and unsubmitted; submitting stops your clock, not the opponent's
  const yourDeadline = awaiting.includes(slot) && !submitted[slot] ? turnDeadline : null;
  return {
    roomId: room.id,
    phase: room.phase,
    you: slot,
    players: [playerView(room.players[0]), playerView(room.players[1])],
    yourTeam: room.players[slot]?.team ?? null,
    battle: room.battle,
    awaiting,
    submitted,
    turnDeadline: yourDeadline,
    winnerSlot: room.winnerSlot,
  };
}

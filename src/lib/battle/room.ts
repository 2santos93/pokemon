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

function newPlayer(slot: SideIndex): RoomPlayer {
  return {
    slot, nickname: null, gender: null, connected: true,
    team: null, lead: null, pendingAction: null,
  };
}

export function joinRoom(room: Room): { room: Room; slot: SideIndex } | { error: string } {
  const slot: SideIndex | null = room.players[0] === null ? 0 : room.players[1] === null ? 1 : null;
  if (slot === null) return { error: "room full" };
  const next = structuredClone(room);
  next.players[slot] = newPlayer(slot);
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
  // Clear any pendingAction submitted during lobby/teaming — the pure API
  // allows applyAction to be called before a battle exists, and such stale
  // actions must not survive into turn 1 of the fresh battle.
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

/**
 * Resolve the current turn/sub-phase if all awaited sides have submitted an
 * action.
 *
 * IMPORTANT — RNG lifetime: `rng` MUST be a single long-lived RNG instance
 * created once per room and advanced across the entire battle (every call to
 * `resolveIfReady` for that room should pass the *same* instance, threading
 * its state forward). Do NOT construct a freshly-seeded RNG per turn — doing
 * so would replay identical crit/miss/speed-tie rolls turn after turn and
 * make battles non-random.
 */
export function resolveIfReady(
  room: Room,
  rng: RNG,
): { room: Room; events: BattleEvent[] } | null {
  const awaiting = awaitingSlots(room);
  if (awaiting.length === 0) return null;
  const actions = awaiting.map((slot) => room.players[slot]?.pendingAction ?? null);
  if (actions.some((a) => a === null)) return null;

  const next = structuredClone(room);
  const battle = next.battle!;
  const events: BattleEvent[] = [];

  const forced = battle.forcedSwitch[0] || battle.forcedSwitch[1];
  if (forced) {
    // Forced-switch sub-phase: each flagged slot submitted a switch.
    for (const slot of awaiting) {
      const action = next.players[slot]!.pendingAction!;
      const teamIndex = action.kind === "switch" ? action.teamIndex : next.battle!.sides[slot].activeIndex;
      const result = chooseReplacement(next.battle!, slot, teamIndex);
      next.battle = result.state;
      events.push(...result.events);
      next.players[slot]!.pendingAction = null;
    }
    // The non-forced side isn't awaited here but may have submitted a stale
    // action during the forced-switch window; clear both so nothing leaks
    // into the next full turn.
    next.players[0]!.pendingAction = null;
    next.players[1]!.pendingAction = null;
  } else {
    const result = resolveTurn(
      battle,
      [next.players[0]!.pendingAction!, next.players[1]!.pendingAction!],
      rng,
    );
    next.battle = result.state;
    events.push(...result.events);
    next.players[0]!.pendingAction = null;
    next.players[1]!.pendingAction = null;
  }

  return { room: finish(next), events };
}

export function applyDisconnect(room: Room, slot: SideIndex): Room {
  const next = structuredClone(room);
  if (next.players[slot]) next.players[slot]!.connected = false;
  const other: SideIndex = slot === 0 ? 1 : 0;
  const battleInProgress = next.phase === "lobby" || next.phase === "teaming" || next.phase === "battle";
  if (battleInProgress && next.players[other]) {
    next.phase = "finished";
    next.winnerSlot = other;
  }
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
  };
}

export function viewFor(room: Room, slot: SideIndex): RoomView {
  return {
    roomId: room.id,
    phase: room.phase,
    you: slot,
    players: [playerView(room.players[0]), playerView(room.players[1])],
    yourTeam: room.players[slot]?.team ?? null,
    battle: room.battle,
    awaiting: awaitingSlots(room),
    winnerSlot: room.winnerSlot,
  };
}

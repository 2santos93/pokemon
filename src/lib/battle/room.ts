import type { Gender } from "./protocol";
import type { BattlePokemon, BattleState, SideIndex, TurnAction } from "./types";
import type { RoomPhase } from "./protocol";
import { createBattle } from "./engine";

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
  const p0 = room.players[0];
  const p1 = room.players[1];
  if (!p0?.team || p0.lead == null || !p1?.team || p1.lead == null) return room;
  const next = structuredClone(room);
  next.battle = createBattle({ team: p0.team, lead: p0.lead }, { team: p1.team, lead: p1.lead });
  next.phase = "battle";
  return next;
}

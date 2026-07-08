import type {
  BattleEvent,
  BattlePokemon,
  BattleState,
  SideIndex,
  TurnAction,
} from "./types";

export type Gender = "male" | "female";
export type RoomPhase = "waiting" | "lobby" | "teaming" | "battle" | "finished";

export interface PlayerProfile {
  nickname: string;
  gender: Gender;
}

/** Client → Server. The transport maps a connection to a slot; messages carry no slot. */
export type ClientMessage =
  | { type: "setProfile"; nickname: string; gender: Gender }
  | { type: "chooseLead"; teamIndex: number }
  | { type: "action"; action: TurnAction }
  | { type: "rematch" }
  | { type: "forfeit" };

export interface PlayerView {
  slot: SideIndex;
  nickname: string | null;
  gender: Gender | null;
  connected: boolean;
  /** Index (0..2) of the team member chosen as lead, once picked. */
  lead: number | null;
}

/** A per-player snapshot the client renders. Friendly duel → both players see the full battle. */
export interface RoomView {
  roomId: string;
  phase: RoomPhase;
  you: SideIndex;
  players: (PlayerView | null)[];
  yourTeam: BattlePokemon[] | null;
  battle: BattleState | null;
  awaiting: SideIndex[];
  /** Whether each slot has a pending action locked in for the current decision point. */
  submitted: [boolean, boolean];
  /** Epoch-ms deadline for the current decision point, or null if no timer is running. Server resolves on expiry; client's countdown is approximate. */
  turnDeadline: number | null;
  winnerSlot: SideIndex | null;
}

/** Server → Client. */
export type ServerMessage =
  | { type: "state"; view: RoomView }
  | { type: "events"; events: BattleEvent[] }
  | { type: "error"; message: string };

/** A message the room wants delivered to a specific slot or both. */
export interface Outbound {
  to: SideIndex | "both";
  message: ServerMessage;
}

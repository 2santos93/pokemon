import type { StatSlug, TypeSlug } from "@/lib/domain/types";

export type MoveCategory = "physical" | "special" | "status";
export type StatusCondition = "none" | "paralysis" | "burn" | "poison" | "sleep";

export interface Move {
  id: number;
  name: string;
  type: TypeSlug;
  category: MoveCategory;
  power: number; // 0 for status moves
  accuracy: number; // 0..100; 0 means "never misses"
  pp: number; // max PP
  priority: number;
  /** For status moves: the condition inflicted on the target. */
  inflicts?: Exclude<StatusCondition, "none">;
}

export interface MoveSlot {
  move: Move;
  pp: number; // current PP
}

export interface BattlePokemon {
  id: number; // species id
  name: string;
  types: TypeSlug[];
  level: number;
  stats: Record<StatSlug, number>;
  maxHp: number;
  currentHp: number;
  moves: MoveSlot[];
  status: StatusCondition;
  sleepTurns: number; // remaining forced-sleep turns
  frontSprite: string;
  backSprite: string;
}

export interface PlayerSide {
  team: BattlePokemon[];
  activeIndex: number;
}

export interface BattleState {
  sides: [PlayerSide, PlayerSide];
  turn: number;
  /** A side flagged true must choose a replacement before the next turn. */
  forcedSwitch: [boolean, boolean];
  winner: 0 | 1 | null;
}

export type SideIndex = 0 | 1;

export type TurnAction =
  | { kind: "move"; moveIndex: number } // 0..3
  | { kind: "switch"; teamIndex: number }; // 0..2

export type EffectivenessLabel = "super" | "normal" | "notvery" | "immune";

export type BattleEvent =
  | { type: "move"; side: SideIndex; pokemon: string; move: string }
  | {
      type: "damage";
      side: SideIndex; // the side taking damage
      pokemon: string;
      amount: number;
      remainingHp: number;
      effectiveness: EffectivenessLabel;
      crit: boolean;
    }
  | { type: "miss"; side: SideIndex; pokemon: string }
  | { type: "status"; side: SideIndex; pokemon: string; status: StatusCondition }
  | { type: "statusDamage"; side: SideIndex; pokemon: string; status: StatusCondition; amount: number; remainingHp: number }
  | { type: "statusPrevent"; side: SideIndex; pokemon: string; status: StatusCondition }
  | { type: "wake"; side: SideIndex; pokemon: string }
  | { type: "faint"; side: SideIndex; pokemon: string }
  | { type: "switch"; side: SideIndex; from: string; to: string }
  | { type: "forcedSwitch"; side: SideIndex }
  | { type: "win"; side: SideIndex };

export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
}

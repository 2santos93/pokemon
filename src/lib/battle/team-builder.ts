import { isTypeSlug, STAT_SLUGS, type StatSlug } from "@/lib/domain/types";
import { formatPokemonName, officialArtworkUrl } from "@/lib/domain/format";
import type { MoveResponse, PokemonResponse } from "@/lib/pokeapi/types";
import { getMove, getPokemon } from "@/lib/pokeapi/client";
import { inBatches } from "@/lib/pokeapi/batch";
import type { RNG } from "./rng";
import type { Move, MoveCategory, MoveSlot, StatusCondition, BattlePokemon } from "./types";
import { computeStats } from "./stats";

const AILMENTS: Record<string, Exclude<StatusCondition, "none">> = {
  paralysis: "paralysis",
  burn: "burn",
  poison: "poison",
  sleep: "sleep",
};

export function mapAilment(name: string): Exclude<StatusCondition, "none"> | null {
  return AILMENTS[name] ?? null;
}

function toCategory(name: string): MoveCategory | null {
  return name === "physical" || name === "special" || name === "status" ? name : null;
}

export function toMove(res: MoveResponse): Move | null {
  if (!isTypeSlug(res.type.name)) return null;
  const category = toCategory(res.damage_class.name);
  if (category === null) return null;

  const move: Move = {
    id: res.id,
    name: res.name,
    type: res.type.name,
    category,
    power: res.power ?? 0,
    accuracy: res.accuracy ?? 0, // 0 = never misses (engine convention)
    pp: res.pp ?? 5,
    priority: res.priority,
  };

  if (category === "status") {
    const inflicts = mapAilment(res.meta?.ailment.name ?? "none");
    if (inflicts === null) return null; // status move we can't model
    move.inflicts = inflicts;
    return move;
  }

  if (move.power <= 0) return null; // damaging move with no usable power
  return move;
}

export function pickTeamIds(rng: RNG, count: number, maxId: number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < count && chosen.size < maxId) {
    chosen.add(1 + rng.int(maxId));
  }
  return [...chosen];
}

export const STRUGGLE: Move = {
  id: 165,
  name: "struggle",
  type: "normal",
  category: "physical",
  power: 50,
  accuracy: 0, // never misses
  pp: 1,
  priority: 0,
};

function isDamaging(move: Move): boolean {
  return move.category !== "status" && move.power > 0;
}

function shuffle<T>(items: T[], rng: RNG): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

export function selectMoves(candidates: Move[], rng: RNG): MoveSlot[] {
  // Dedupe by id, then shuffle for variety.
  const unique = [...new Map(candidates.map((m) => [m.id, m])).values()];
  const shuffled = shuffle(unique, rng);

  const picked: Move[] = shuffled.slice(0, 4);
  if (!picked.some(isDamaging)) {
    // Guarantee a damaging option: swap in a damaging candidate, else STRUGGLE.
    const damaging = shuffled.find(isDamaging) ?? STRUGGLE;
    if (picked.length < 4) picked.push(damaging);
    else picked[picked.length - 1] = damaging;
  }

  return picked.map((move) => ({ move, pp: move.pp }));
}

const LEVEL = 50;

export function buildBattlePokemon(
  pokemon: PokemonResponse,
  candidateMoves: Move[],
  rng: RNG,
): BattlePokemon {
  const base = {} as Record<StatSlug, number>;
  for (const slug of STAT_SLUGS) base[slug] = 0;
  for (const entry of pokemon.stats) {
    if ((STAT_SLUGS as readonly string[]).includes(entry.stat.name)) {
      base[entry.stat.name as StatSlug] = entry.base_stat;
    }
  }
  const stats = computeStats(base, LEVEL);
  const artwork = officialArtworkUrl(pokemon.id);

  return {
    id: pokemon.id,
    name: formatPokemonName(pokemon.name),
    types: pokemon.types
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isTypeSlug),
    level: LEVEL,
    stats,
    maxHp: stats.hp,
    currentHp: stats.hp,
    moves: selectMoves(candidateMoves, rng),
    status: "none",
    sleepTurns: 0,
    frontSprite: pokemon.sprites.front_default ?? artwork,
    backSprite: pokemon.sprites.back_default ?? artwork,
  };
}

const MOVE_SAMPLE = 12;
const MOVE_FETCH_BATCH = 6;

export interface BattleFetchers {
  getPokemon: (id: number) => Promise<PokemonResponse>;
  getMove: (name: string) => Promise<MoveResponse>;
}

const defaultFetchers: BattleFetchers = { getPokemon, getMove };

export function chooseMoveNames(pokemon: PokemonResponse, rng: RNG, sampleSize: number): string[] {
  const names = pokemon.moves.map((m) => m.move.name);
  return shuffle(names, rng).slice(0, sampleSize);
}

export async function loadBattlePokemon(
  id: number,
  rng: RNG,
  deps: BattleFetchers = defaultFetchers,
): Promise<BattlePokemon> {
  const pokemon = await deps.getPokemon(id);
  const names = chooseMoveNames(pokemon, rng, MOVE_SAMPLE);
  const fetched = await inBatches(names, MOVE_FETCH_BATCH, (name) => deps.getMove(name));
  const candidates = fetched
    .map(toMove)
    .filter((m): m is Move => m !== null);
  return buildBattlePokemon(pokemon, candidates, rng);
}

export async function rollBattleTeam(
  rng: RNG,
  opts: { count?: number; maxId?: number; deps?: BattleFetchers } = {},
): Promise<BattlePokemon[]> {
  const { count = 3, maxId = 1025, deps = defaultFetchers } = opts;
  const ids = pickTeamIds(rng, count, maxId);
  return inBatches(ids, count, (id) => loadBattlePokemon(id, rng, deps));
}

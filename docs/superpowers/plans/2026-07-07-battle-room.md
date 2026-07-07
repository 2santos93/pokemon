# Battle Room State Machine (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, transport-agnostic room state machine + wire protocol that drives two players from lobby → team roll → lead pick → 3v3 battle → finish, consuming the Phase-1 engine and Phase-2 team builder. No sockets, no I/O — the async team roll and the RNG are injected by the caller (the Socket.IO layer, a later phase).

**Architecture:** Pure functions over an immutable `Room` value (same style as `src/lib/battle/engine.ts`). Each transition returns a new `Room` (and, where relevant, the `BattleEvent[]` to broadcast). Turn synchronisation is modelled with `awaitingSlots(room)` (which slots the room is waiting on) + `resolveIfReady(room, rng)` (resolve a normal turn or a forced-switch sub-phase once every awaited slot has submitted).

**Tech Stack:** TypeScript, Vitest. Consumes `src/lib/battle/{types,engine,rng}.ts` and (only via injected dep) `team-builder.ts`.

## Global Constraints

- Pure modules — no imports from `next`/`react`/`socket.io`/network. Randomness only via an injected `RNG`.
- Two players per room, slots `0` and `1` (`SideIndex` from `./types`).
- Reuse engine functions verbatim: `createBattle`, `resolveTurn`, `chooseReplacement` from `./engine`; do not reimplement battle logic.
- Genders: exactly `"male" | "female"`. Phases: exactly `"waiting" | "lobby" | "teaming" | "battle" | "finished"`.
- Every transition is immutable: return a new `Room` (use `structuredClone` or spread) — never mutate the input.
- Tests: `import { describe, expect, it } from "vitest"`, colocated `*.test.ts`, run `pnpm vitest run <file>`.

---

### Task 1: Protocol + room types

**Files:**
- Create: `src/lib/battle/protocol.ts`

**Interfaces:**
- Consumes: `BattlePokemon`, `BattleState`, `BattleEvent`, `TurnAction`, `SideIndex` (`./types`).
- Produces: `Gender`, `RoomPhase`, `PlayerProfile`, `ClientMessage`, `PlayerView`, `RoomView`, `ServerMessage`, `Outbound`.

- [ ] **Step 1: Write `protocol.ts`** (types only; no test)

```ts
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
  | { type: "rematch" };

export interface PlayerView {
  slot: SideIndex;
  nickname: string | null;
  gender: Gender | null;
  connected: boolean;
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
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/battle/protocol.ts
git commit -m "feat(battle): room wire protocol + view types"
```

---

### Task 2: Room creation, join, profile, team assignment

**Files:**
- Create: `src/lib/battle/room.ts`
- Test: `src/lib/battle/room.test.ts`

**Interfaces:**
- Consumes: `BattlePokemon`, `SideIndex` (`./types`); `Gender` (`./protocol`).
- Produces:
  - Types `RoomPlayer`, `Room`.
  - `createRoom(id: string): Room`.
  - `joinRoom(room: Room): { room: Room; slot: SideIndex } | { error: string }`.
  - `applyProfile(room: Room, slot: SideIndex, nickname: string, gender: Gender): Room`.
  - `bothProfiled(room: Room): boolean`.
  - `needsTeamRoll(room: Room): boolean` — true when phase is `"lobby"` and both players have a profile.
  - `withTeams(room: Room, team0: BattlePokemon[], team1: BattlePokemon[]): Room` — attaches teams, moves to `"teaming"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/room.test.ts
import { describe, expect, it } from "vitest";
import type { BattlePokemon } from "./types";
import {
  applyProfile,
  bothProfiled,
  createRoom,
  joinRoom,
  needsTeamRoll,
  withTeams,
} from "./room";

function fakeTeam(prefix: string): BattlePokemon[] {
  return [0, 1, 2].map((i) => ({
    id: i, name: `${prefix}${i}`, types: ["normal"], level: 50,
    stats: { hp: 150, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed: 100 },
    maxHp: 150, currentHp: 150, moves: [], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
  }));
}

function joined(): ReturnType<typeof createRoom> {
  let room = createRoom("r1");
  room = (joinRoom(room) as { room: typeof room }).room;
  room = (joinRoom(room) as { room: typeof room }).room;
  return room;
}

describe("room lobby", () => {
  it("starts in waiting and moves to lobby when both slots fill", () => {
    let room = createRoom("r1");
    expect(room.phase).toBe("waiting");
    const first = joinRoom(room);
    expect("slot" in first && first.slot).toBe(0);
    room = (first as { room: typeof room }).room;
    expect(room.phase).toBe("waiting");
    const second = joinRoom(room);
    expect("slot" in second && second.slot).toBe(1);
    room = (second as { room: typeof room }).room;
    expect(room.phase).toBe("lobby");
  });

  it("rejects a third joiner", () => {
    const result = joinRoom(joined());
    expect("error" in result).toBe(true);
  });

  it("needsTeamRoll only once both players submit a profile", () => {
    let room = joined();
    expect(needsTeamRoll(room)).toBe(false);
    room = applyProfile(room, 0, "Ash", "male");
    expect(bothProfiled(room)).toBe(false);
    room = applyProfile(room, 1, "Misty", "female");
    expect(bothProfiled(room)).toBe(true);
    expect(needsTeamRoll(room)).toBe(true);
  });

  it("withTeams attaches teams and moves to teaming", () => {
    let room = applyProfile(applyProfile(joined(), 0, "Ash", "male"), 1, "Misty", "female");
    room = withTeams(room, fakeTeam("A"), fakeTeam("B"));
    expect(room.phase).toBe("teaming");
    expect(room.players[0]?.team).toHaveLength(3);
    expect(room.players[1]?.team).toHaveLength(3);
  });

  it("does not mutate the input room", () => {
    const room = joined();
    applyProfile(room, 0, "Ash", "male");
    expect(room.players[0]?.nickname).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: FAIL — cannot find module `./room`.

- [ ] **Step 3: Write `room.ts` (this task's slice)**

```ts
import type { Gender } from "./protocol";
import type { BattlePokemon, BattleState, SideIndex, TurnAction } from "./types";
import type { RoomPhase } from "./protocol";

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/room.ts src/lib/battle/room.test.ts
git commit -m "feat(battle): room join/profile/team-assignment transitions"
```

---

### Task 3: Lead selection → battle start

**Files:**
- Modify: `src/lib/battle/room.ts`
- Modify: `src/lib/battle/room.test.ts`

**Interfaces:**
- Consumes: `createBattle` (`./engine`).
- Produces:
  - `applyLead(room: Room, slot: SideIndex, teamIndex: number): Room` — records the chosen lead (ignored if out of range or team missing).
  - `readyToStart(room: Room): boolean` — phase `"teaming"` and both players chose a valid lead.
  - `startBattle(room: Room): Room` — builds the `BattleState` via `createBattle` and moves to `"battle"`.

- [ ] **Step 1: Add the failing test**

```ts
import { applyLead, readyToStart, startBattle } from "./room";

function teaming(): ReturnType<typeof createRoom> {
  let room = applyProfile(applyProfile(joined(), 0, "Ash", "male"), 1, "Misty", "female");
  return withTeams(room, fakeTeam("A"), fakeTeam("B"));
}

describe("room lead selection", () => {
  it("starts a battle once both leads are chosen", () => {
    let room = teaming();
    room = applyLead(room, 0, 1);
    expect(readyToStart(room)).toBe(false);
    room = applyLead(room, 1, 2);
    expect(readyToStart(room)).toBe(true);
    room = startBattle(room);
    expect(room.phase).toBe("battle");
    expect(room.battle?.sides[0].activeIndex).toBe(1);
    expect(room.battle?.sides[1].activeIndex).toBe(2);
  });

  it("ignores an out-of-range lead", () => {
    const room = applyLead(teaming(), 0, 9);
    expect(room.players[0]?.lead).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: FAIL — `applyLead`/`readyToStart`/`startBattle` not exported.

- [ ] **Step 3: Add to `room.ts`**

```ts
import { createBattle } from "./engine";

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
  // Build the battle from the CLONED players' teams so battle state never aliases
  // the input room's arrays (keeps the clone-before-mutate discipline intact).
  next.battle = createBattle(
    { team: next.players[0]!.team!, lead: next.players[0]!.lead! },
    { team: next.players[1]!.team!, lead: next.players[1]!.lead! },
  );
  next.phase = "battle";
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/room.ts src/lib/battle/room.test.ts
git commit -m "feat(battle): room lead selection and battle start"
```

---

### Task 4: Turn synchronisation — awaitingSlots, applyAction, resolveIfReady

**Files:**
- Modify: `src/lib/battle/room.ts`
- Modify: `src/lib/battle/room.test.ts`

**Interfaces:**
- Consumes: `resolveTurn`, `chooseReplacement` (`./engine`); `RNG` (`./rng`); `TurnAction`, `BattleEvent`, `SideIndex` (`./types`).
- Produces:
  - `awaitingSlots(room: Room): SideIndex[]` — `[]` unless phase `"battle"`; during a forced switch, only the flagged slot(s); otherwise both slots.
  - `applyAction(room: Room, slot: SideIndex, action: TurnAction): Room` — stores a slot's pending action.
  - `resolveIfReady(room: Room, rng: RNG): { room: Room; events: BattleEvent[] } | null` — returns null until every awaited slot has a pending action; then resolves a forced-switch sub-phase (via `chooseReplacement` for each flagged slot) OR a normal turn (via `resolveTurn`), clears the consumed pending actions, and — if the battle has a winner — sets `phase = "finished"` and `winnerSlot`.

- [ ] **Step 1: Add the failing test**

```ts
import { applyAction, awaitingSlots, resolveIfReady, startBattle } from "./room";
import { createRng } from "./rng";
import type { Move, MoveSlot } from "./types";

const tackle: Move = { id: 1, name: "tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35, priority: 0 };
function withMove(team: ReturnType<typeof fakeTeam>): ReturnType<typeof fakeTeam> {
  return team.map((m) => ({ ...m, moves: [{ move: tackle, pp: 35 } satisfies MoveSlot] }));
}

function battling(): ReturnType<typeof createRoom> {
  let room = applyProfile(applyProfile(joined(), 0, "Ash", "male"), 1, "Misty", "female");
  room = withTeams(room, withMove(fakeTeam("A")), withMove(fakeTeam("B")));
  room = applyLead(applyLead(room, 0, 0), 1, 0);
  return startBattle(room);
}

describe("room turn sync", () => {
  it("awaits both slots at the start of a battle", () => {
    expect(awaitingSlots(battling())).toEqual([0, 1]);
  });

  it("resolves nothing until both actions are in", () => {
    let room = battling();
    room = applyAction(room, 0, { kind: "move", moveIndex: 0 });
    expect(resolveIfReady(room, createRng(1))).toBeNull();
    room = applyAction(room, 1, { kind: "move", moveIndex: 0 });
    const result = resolveIfReady(room, createRng(1));
    expect(result).not.toBeNull();
    expect(result!.events.length).toBeGreaterThan(0);
    expect(result!.room.players[0]?.pendingAction).toBeNull();
    expect(result!.room.players[1]?.pendingAction).toBeNull();
  });

  it("finishes the room when the battle produces a winner", () => {
    // Reduce one side to a single 1-HP Pokémon so one turn ends it.
    let room = battling();
    const b = room.battle!;
    b.sides[1].team = [{ ...b.sides[1].team[0], currentHp: 1 }];
    room = applyAction(applyAction(room, 0, { kind: "move", moveIndex: 0 }), 1, { kind: "move", moveIndex: 0 });
    let result = resolveIfReady(room, createRng(2));
    // Keep resolving forced switches / turns until finished (single-mon side faints → win).
    while (result && result.room.phase !== "finished" && awaitingSlots(result.room).length === 0) {
      result = resolveIfReady(result.room, createRng(2));
    }
    expect(result!.room.phase === "finished" || result!.room.battle!.winner !== null).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: FAIL — `awaitingSlots`/`applyAction`/`resolveIfReady` not exported.

- [ ] **Step 3: Add to `room.ts`**

```ts
import { chooseReplacement, resolveTurn } from "./engine";
import type { RNG } from "./rng";
import type { BattleEvent } from "./types";

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/room.ts src/lib/battle/room.test.ts
git commit -m "feat(battle): room turn synchronisation and resolution"
```

---

### Task 5: Disconnect/forfeit, rematch, and per-slot view

**Files:**
- Modify: `src/lib/battle/room.ts`
- Modify: `src/lib/battle/room.test.ts`

**Interfaces:**
- Consumes: `RoomView`, `PlayerView` (`./protocol`).
- Produces:
  - `applyDisconnect(room: Room, slot: SideIndex): Room` — marks the slot disconnected; if a battle/teaming/lobby is in progress and the other slot is present, the other slot wins by forfeit and the room finishes.
  - `resetForRematch(room: Room): Room` — keeps both profiles, clears teams/leads/pending/battle/winner, returns to `"lobby"` (so `needsTeamRoll` fires a fresh roll).
  - `viewFor(room: Room, slot: SideIndex): RoomView`.

- [ ] **Step 1: Add the failing test**

```ts
import { applyDisconnect, resetForRematch, viewFor } from "./room";

describe("room disconnect / rematch / view", () => {
  it("awards a forfeit win when a player disconnects mid-battle", () => {
    const room = applyDisconnect(battling(), 1);
    expect(room.phase).toBe("finished");
    expect(room.winnerSlot).toBe(0);
  });

  it("resetForRematch returns to lobby keeping profiles and re-arming the roll", () => {
    let room = battling();
    room = resetForRematch(room);
    expect(room.phase).toBe("lobby");
    expect(room.players[0]?.nickname).toBe("Ash");
    expect(room.players[0]?.team).toBeNull();
    expect(room.battle).toBeNull();
    expect(needsTeamRoll(room)).toBe(true);
  });

  it("viewFor exposes only the caller's team and the shared battle", () => {
    const room = battling();
    const view = viewFor(room, 0);
    expect(view.you).toBe(0);
    expect(view.yourTeam).toHaveLength(3);
    expect(view.players[1]?.nickname).toBe("Misty");
    expect(view.awaiting).toEqual([0, 1]);
    expect(view.battle).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Add to `room.ts`**

```ts
import type { PlayerView, RoomView } from "./protocol";

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
```

- [ ] **Step 4: Run test to verify it passes + full gate**

Run: `pnpm vitest run src/lib/battle/room.test.ts`
Expected: PASS.
Then: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/room.ts src/lib/battle/room.test.ts
git commit -m "feat(battle): room disconnect/forfeit, rematch, per-slot view"
```

---

## Self-Review

**Spec coverage (Phase 3 core scope):**
- Room lifecycle waiting → lobby → teaming → battle → finished → Tasks 2–5. ✓
- Two-player join with slot assignment + full-room rejection → Task 2. ✓
- Nickname + gender profile → Task 2 (`applyProfile`), surfaced in `RoomView` → Task 5. ✓
- Random team of 3 attached (async roll injected by transport) → `needsTeamRoll`/`withTeams` (Task 2). ✓
- Lead pick → battle start via engine `createBattle` → Task 3. ✓
- Turn-by-turn play with switching + forced switch + win, reusing `resolveTurn`/`chooseReplacement` → Task 4. ✓
- Disconnect = forfeit; rematch; per-player view → Task 5. ✓
- **Deferred to the transport phase (own plan):** Socket.IO server, custom `server.ts`, client `use-battle-socket` hook, the async wiring that calls `rollBattleTeam` when `needsTeamRoll` is true and feeds a per-room seeded `RNG` into `resolveIfReady`. **UI = Phase 4.**

**Placeholder scan:** none — every step ships real code.

**Type consistency:** `Room`/`RoomPlayer` defined in Task 2 and extended (never redefined) in Tasks 3–5. `Gender`/`RoomPhase`/`RoomView`/`PlayerView` from Task 1's `protocol.ts`. Engine imports (`createBattle`, `resolveTurn`, `chooseReplacement`) and `RNG` match their Phase-1 signatures. `awaitingSlots` (Task 4) is reused by `viewFor` (Task 5).

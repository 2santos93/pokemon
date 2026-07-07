import { describe, expect, it } from "vitest";
import type { BattlePokemon, Move, MoveSlot } from "./types";
import {
  applyAction,
  applyDisconnect,
  applyLead,
  applyProfile,
  awaitingSlots,
  bothProfiled,
  createRoom,
  joinRoom,
  needsTeamRoll,
  readyToStart,
  resolveIfReady,
  resetForRematch,
  startBattle,
  viewFor,
  withTeams,
} from "./room";
import { createRng } from "./rng";

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

function teaming(): ReturnType<typeof createRoom> {
  const room = applyProfile(applyProfile(joined(), 0, "Ash", "male"), 1, "Misty", "female");
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

  it("applyLead does not mutate the input room", () => {
    const room = teaming();
    applyLead(room, 0, 1);
    expect(room.players[0]?.lead).toBeNull();
  });
});

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
    const pokemon = b.sides[1].team[0];
    b.sides[1].team = [{ ...pokemon, currentHp: 1 } as BattlePokemon];
    room = applyAction(applyAction(room, 0, { kind: "move", moveIndex: 0 }), 1, { kind: "move", moveIndex: 0 });
    const result = resolveIfReady(room, createRng(2));
    expect(result!.room.phase).toBe("finished");
    expect(result!.room.winnerSlot).toBe(0);
  });

  it("forces a switch when the active Pokémon faints but the bench is alive", () => {
    let room = battling();
    const b = room.battle!;
    const active = b.sides[1].team[b.sides[1].activeIndex]!;
    b.sides[1].team[b.sides[1].activeIndex] = { ...active, currentHp: 1 } as BattlePokemon;
    room = applyAction(applyAction(room, 0, { kind: "move", moveIndex: 0 }), 1, { kind: "move", moveIndex: 0 });
    const afterTurn = resolveIfReady(room, createRng(1))!;

    expect(afterTurn.room.battle!.forcedSwitch[1]).toBe(true);
    expect(afterTurn.room.battle!.winner).toBeNull();
    expect(awaitingSlots(afterTurn.room)).toEqual([1]);

    const withSwitch = applyAction(afterTurn.room, 1, { kind: "switch", teamIndex: 1 });
    const afterSwitch = resolveIfReady(withSwitch, createRng(1))!;

    expect(afterSwitch.room.battle!.sides[1].activeIndex).toBe(1);
    expect(afterSwitch.room.battle!.forcedSwitch[1]).toBe(false);
    expect(afterSwitch.room.players[1]?.pendingAction).toBeNull();
  });

  it("applyAction does not mutate the input room", () => {
    const room = battling();
    applyAction(room, 0, { kind: "move", moveIndex: 0 });
    expect(room.players[0]?.pendingAction).toBeNull();
  });

  it("resolveIfReady does not mutate the input room", () => {
    let room = battling();
    room = applyAction(applyAction(room, 0, { kind: "move", moveIndex: 0 }), 1, { kind: "move", moveIndex: 0 });
    const battleBefore = room.battle;
    const pendingBefore = [room.players[0]?.pendingAction, room.players[1]?.pendingAction];
    resolveIfReady(room, createRng(1));
    expect(room.battle).toBe(battleBefore);
    expect(room.players[0]?.pendingAction).toBe(pendingBefore[0]);
    expect(room.players[1]?.pendingAction).toBe(pendingBefore[1]);
  });

  it("startBattle clears any stale pre-battle pendingAction so it cannot auto-resolve turn 1", () => {
    let room = teaming();
    // A stale action submitted before the battle even exists (pure API allows this).
    room = applyAction(room, 0, { kind: "move", moveIndex: 0 });
    room = applyLead(applyLead(room, 0, 0), 1, 0);
    room = startBattle(room);

    expect(room.phase).toBe("battle");
    expect(room.players[0]?.pendingAction).toBeNull();
    expect(room.players[1]?.pendingAction).toBeNull();

    // The stale action must not survive: resolveIfReady stays null until both
    // sides submit fresh actions for turn 1.
    expect(resolveIfReady(room, createRng(1))).toBeNull();

    room = applyAction(room, 1, { kind: "move", moveIndex: 0 });
    expect(resolveIfReady(room, createRng(1))).toBeNull();

    room = applyAction(room, 0, { kind: "move", moveIndex: 0 });
    expect(resolveIfReady(room, createRng(1))).not.toBeNull();
  });

  it("startBattle on a room already in battle phase returns it unchanged", () => {
    const room = battling();
    const battleBefore = room.battle;
    const turnBefore = room.battle?.turn;
    const again = startBattle(room);
    expect(again).toBe(room);
    expect(again.battle).toBe(battleBefore);
    expect(again.battle?.turn).toBe(turnBefore);
  });

  it("forced switch clears the non-forced side's stale pendingAction too", () => {
    let room = battling();
    const b = room.battle!;
    const active = b.sides[1].team[b.sides[1].activeIndex]!;
    b.sides[1].team[b.sides[1].activeIndex] = { ...active, currentHp: 1 } as BattlePokemon;
    room = applyAction(applyAction(room, 0, { kind: "move", moveIndex: 0 }), 1, { kind: "move", moveIndex: 0 });
    const afterTurn = resolveIfReady(room, createRng(1))!;

    expect(afterTurn.room.battle!.forcedSwitch[1]).toBe(true);
    expect(awaitingSlots(afterTurn.room)).toEqual([1]);

    // Side 0 is not awaited this sub-phase, but submits a stale action anyway.
    let withStale = applyAction(afterTurn.room, 0, { kind: "move", moveIndex: 0 });
    withStale = applyAction(withStale, 1, { kind: "switch", teamIndex: 1 });
    const afterSwitch = resolveIfReady(withStale, createRng(1))!;

    expect(afterSwitch.room.battle!.sides[1].activeIndex).toBe(1);
    expect(afterSwitch.room.battle!.forcedSwitch[1]).toBe(false);
    expect(afterSwitch.room.players[0]?.pendingAction).toBeNull();
    expect(afterSwitch.room.players[1]?.pendingAction).toBeNull();
  });
});

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

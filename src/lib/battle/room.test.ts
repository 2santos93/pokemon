import { describe, expect, it } from "vitest";
import type { BattlePokemon } from "./types";
import {
  applyLead,
  applyProfile,
  bothProfiled,
  createRoom,
  joinRoom,
  needsTeamRoll,
  readyToStart,
  startBattle,
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

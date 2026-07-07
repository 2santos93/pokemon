import { describe, expect, it } from "vitest";
import { BattleServer, type ServerDeps } from "./server-core";
import type { BattlePokemon } from "./types";
import type { ServerMessage } from "./protocol";

function team(prefix: string): BattlePokemon[] {
  const move = { move: { id: 1, name: "tackle", type: "normal" as const, category: "physical" as const, power: 40, accuracy: 100, pp: 35, priority: 0 }, pp: 35 };
  return [0, 1, 2].map((i) => ({
    id: i, name: `${prefix}${i}`, types: ["normal"], level: 50,
    stats: { hp: 150, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed: 100 },
    maxHp: 150, currentHp: 150, moves: [move], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
  }));
}

function harness() {
  const sent: { slot: number; msg: ServerMessage }[] = [];
  const deps: ServerDeps = {
    rollTeam: async () => team("T"),
    send: (_room, slot, msg) => sent.push({ slot, msg }),
  };
  return { server: new BattleServer(deps), sent };
}

/** Team whose lead (index 0) is at 1 HP; bench (1, 2) is full HP. All share the tackle move. */
function fragileTeam(prefix: string): BattlePokemon[] {
  const move = { move: { id: 1, name: "tackle", type: "normal" as const, category: "physical" as const, power: 40, accuracy: 100, pp: 35, priority: 0 }, pp: 35 };
  return [0, 1, 2].map((i) => ({
    id: i, name: `${prefix}${i}`, types: ["normal"], level: 50,
    stats: { hp: 150, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed: 100 },
    maxHp: i === 0 ? 1 : 150, currentHp: i === 0 ? 1 : 150, moves: [move], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
  }));
}

function lastState(sent: { slot: number; msg: ServerMessage }[], slot?: number) {
  const states = sent.filter((s) => s.msg.type === "state" && (slot === undefined || s.slot === slot));
  return states.at(-1)!.msg as Extract<ServerMessage, { type: "state" }>;
}

describe("BattleServer", () => {
  it("assigns slots 0 then 1 and rejects a third", () => {
    const { server } = harness();
    expect(server.join("r")).toBe(0);
    expect(server.join("r")).toBe(1);
    expect(server.join("r")).toBeNull();
  });

  it("rolls teams once both profiles are set", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    const last = sent.filter((s) => s.msg.type === "state").at(-1)!;
    expect(last.msg.type === "state" && last.msg.view.phase).toBe("teaming");
  });

  it("starts the battle once both leads are chosen and resolves a turn", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    await server.message("r", 0, { type: "chooseLead", teamIndex: 0 });
    await server.message("r", 1, { type: "chooseLead", teamIndex: 0 });
    await server.message("r", 0, { type: "action", action: { kind: "move", moveIndex: 0 } });
    await server.message("r", 1, { type: "action", action: { kind: "move", moveIndex: 0 } });
    expect(sent.some((s) => s.msg.type === "events")).toBe(true);
  });

  it("ignores an action from a slot that is not being awaited", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    const before = sent.length;
    await server.message("r", 0, { type: "action", action: { kind: "move", moveIndex: 0 } });
    // No battle yet → awaitingSlots is [], action ignored, no new events emitted.
    expect(sent.some((s, i) => i >= before && s.msg.type === "events")).toBe(false);
  });

  it("rejects an illegal action but accepts the legal one that follows", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    await server.message("r", 0, { type: "chooseLead", teamIndex: 0 });
    await server.message("r", 1, { type: "chooseLead", teamIndex: 0 });

    const before = sent.length;
    await server.message("r", 0, { type: "action", action: { kind: "move", moveIndex: 9 } });
    expect(sent.slice(before).some((s) => s.msg.type === "events")).toBe(false);

    await server.message("r", 0, { type: "action", action: { kind: "move", moveIndex: 0 } });
    await server.message("r", 1, { type: "action", action: { kind: "move", moveIndex: 0 } });
    expect(sent.slice(before).some((s) => s.msg.type === "events")).toBe(true);
  });

  it("forces a switch over the wire when a lead faints, and clears it once resolved", async () => {
    const sent: { slot: number; msg: ServerMessage }[] = [];
    let call = 0;
    const deps: ServerDeps = {
      rollTeam: async () => {
        call++;
        return call === 2 ? fragileTeam("B") : team("A");
      },
      send: (_room, slot, msg) => sent.push({ slot, msg }),
    };
    const server = new BattleServer(deps);
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    await server.message("r", 0, { type: "chooseLead", teamIndex: 0 });
    await server.message("r", 1, { type: "chooseLead", teamIndex: 0 });

    await server.message("r", 0, { type: "action", action: { kind: "move", moveIndex: 0 } });
    await server.message("r", 1, { type: "action", action: { kind: "move", moveIndex: 0 } });

    const afterKo = lastState(sent);
    expect(afterKo.view.battle?.forcedSwitch[1]).toBe(true);
    expect(afterKo.view.battle?.winner).toBe(null);
    expect(afterKo.view.awaiting).toEqual([1]);

    await server.message("r", 1, { type: "action", action: { kind: "switch", teamIndex: 1 } });

    const afterSwitch = lastState(sent, 1);
    expect(afterSwitch.view.battle?.sides[1].activeIndex).toBe(1);
    expect(afterSwitch.view.battle?.forcedSwitch[1]).toBe(false);
  });

  it("forfeits to the opponent on disconnect mid-game", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    server.disconnect("r", 1);
    const last = sent.filter((s) => s.msg.type === "state").at(-1)!;
    expect(last.msg.type === "state" && last.msg.view.winnerSlot).toBe(0);
  });

  it("guards against a concurrent duplicate team roll while one is in flight", async () => {
    let calls = 0;
    let resolveDeferred!: (value: BattlePokemon[]) => void;
    const deferred = new Promise<BattlePokemon[]>((resolve) => {
      resolveDeferred = resolve;
    });
    const sent: { slot: number; msg: ServerMessage }[] = [];
    const deps: ServerDeps = {
      rollTeam: async () => {
        calls++;
        return deferred;
      },
      send: (_room, slot, msg) => sent.push({ slot, msg }),
    };
    const server = new BattleServer(deps);
    server.join("r"); server.join("r");

    // First profile alone does not trigger a roll (not both-profiled yet).
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });

    // Second profile makes needsTeamRoll true and starts roll #1 — it awaits
    // rollTeam's still-unresolved promise, so this call is now in flight.
    const roll1 = server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });

    // While roll #1 is unresolved, phase is still "lobby" and both are
    // profiled, so a re-sent setProfile would (bug) start a second
    // concurrent roll on the same room RNG.
    const roll2 = server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });

    resolveDeferred(team("T"));
    await Promise.all([roll1, roll2]);

    expect(calls).toBe(2);
    const last = sent.filter((s) => s.msg.type === "state").at(-1)!;
    expect(last.msg.type === "state" && last.msg.view.phase).toBe("teaming");
  });
});

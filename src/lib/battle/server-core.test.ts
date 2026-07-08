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

function eventsOf(sent: { slot: number; msg: ServerMessage }[]) {
  return sent
    .filter((s) => s.msg.type === "events" && s.slot === 0)
    .flatMap((s) => (s.msg as Extract<ServerMessage, { type: "events" }>).events);
}

/** Harness with a controllable clock + one-shot timers so no real time passes. */
function timerHarness(turnMs = 15_000) {
  const sent: { slot: number; msg: ServerMessage }[] = [];
  let time = 1_000;
  let nextId = 1;
  let scheduled: { id: number; fn: () => void; at: number }[] = [];
  const deps: ServerDeps = {
    rollTeam: async () => team("T"),
    send: (_room, slot, msg) => sent.push({ slot, msg }),
    now: () => time,
    turnMs,
    setTimer: (fn, ms) => {
      const id = nextId++;
      scheduled.push({ id, fn, at: time + ms });
      return id;
    },
    clearTimer: (handle) => {
      scheduled = scheduled.filter((s) => s.id !== handle);
    },
  };
  const advance = (ms: number) => {
    time += ms;
    const due = scheduled.filter((s) => s.at <= time).sort((a, b) => a.at - b.at);
    for (const d of due) {
      scheduled = scheduled.filter((s) => s.id !== d.id);
      d.fn();
    }
  };
  async function startedBattle(server: BattleServer) {
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    await server.message("r", 0, { type: "chooseLead", teamIndex: 0 });
    await server.message("r", 1, { type: "chooseLead", teamIndex: 0 });
  }
  return { server: new BattleServer(deps), sent, advance, startedBattle, now: () => time };
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

  it("marks a player disconnected without ending the game", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    server.disconnect("r", 1);
    const lastForSlot0 = sent.filter((s) => s.msg.type === "state" && s.slot === 0).at(-1)!;
    expect(lastForSlot0.msg.type === "state" && lastForSlot0.msg.view.winnerSlot).toBeNull();
    expect(lastForSlot0.msg.type === "state" && lastForSlot0.msg.view.phase).not.toBe("finished");
    expect(lastForSlot0.msg.type === "state" && lastForSlot0.msg.view.players[1]?.connected).toBe(false);
  });

  it("forfeits to the opponent on an explicit forfeit message", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    await server.message("r", 1, { type: "forfeit" });
    const last = sent.filter((s) => s.msg.type === "state").at(-1)!;
    expect(last.msg.type === "state" && last.msg.view.winnerSlot).toBe(0);
    expect(last.msg.type === "state" && last.msg.view.phase).toBe("finished");
  });

  it("reconnects with a matching token to reclaim the same slot", async () => {
    const { server } = harness();
    server.join("r", "a");
    server.join("r", "b");
    server.disconnect("r", 0);
    expect(server.join("r", "a")).toBe(0);
  });

  it("arms a turn timer when the battle starts and exposes the deadline in the view", async () => {
    const h = timerHarness(15_000);
    await h.startedBattle(h.server);
    const view = lastState(h.sent).view;
    expect(view.phase).toBe("battle");
    expect(view.turnDeadline).toBe(h.now() + 15_000);
  });

  it("does not fire the timer if both players submit before the deadline", async () => {
    const h = timerHarness();
    await h.startedBattle(h.server);
    await h.server.message("r", 0, { type: "action", action: { kind: "move", moveIndex: 0 } });
    await h.server.message("r", 1, { type: "action", action: { kind: "move", moveIndex: 0 } });
    // Turn resolved from real actions — no timeout event, fresh deadline for next turn.
    expect(eventsOf(h.sent).some((e) => e.type === "timeout")).toBe(false);
    expect(eventsOf(h.sent).some((e) => e.type === "move")).toBe(true);
    expect(lastState(h.sent).view.turnDeadline).toBe(h.now() + 15_000);
  });

  it("on timeout, the idle side loses its turn while the side that chose still acts", async () => {
    const h = timerHarness();
    await h.startedBattle(h.server);
    // Only slot 0 chooses; slot 1 stalls.
    await h.server.message("r", 0, { type: "action", action: { kind: "move", moveIndex: 0 } });
    h.advance(15_000);
    const events = eventsOf(h.sent);
    expect(events.some((e) => e.type === "timeout" && e.side === 1)).toBe(true);
    expect(events.some((e) => e.type === "timeout" && e.side === 0)).toBe(false);
    expect(events.some((e) => e.type === "move" && e.side === 0)).toBe(true);
    expect(events.some((e) => e.type === "move" && e.side === 1)).toBe(false);
    expect(lastState(h.sent).view.battle?.turn).toBe(2);
  });

  it("when neither side chooses, a full timeout skips both and advances the turn", async () => {
    const h = timerHarness();
    await h.startedBattle(h.server);
    h.advance(15_000);
    const events = eventsOf(h.sent);
    expect(events.some((e) => e.type === "timeout" && e.side === 0)).toBe(true);
    expect(events.some((e) => e.type === "timeout" && e.side === 1)).toBe(true);
    expect(events.some((e) => e.type === "move")).toBe(false);
    expect(lastState(h.sent).view.battle?.turn).toBe(2);
  });

  it("re-arms the timer for the next turn so successive timeouts keep resolving", async () => {
    const h = timerHarness();
    await h.startedBattle(h.server);
    h.advance(15_000);
    expect(lastState(h.sent).view.battle?.turn).toBe(2);
    const deadlineTurn2 = lastState(h.sent).view.turnDeadline;
    expect(deadlineTurn2).toBe(h.now() + 15_000);
    h.advance(15_000);
    expect(lastState(h.sent).view.battle?.turn).toBe(3);
  });

  it("clears the timer on forfeit — no further timeouts fire", async () => {
    const h = timerHarness();
    await h.startedBattle(h.server);
    await h.server.message("r", 1, { type: "forfeit" });
    expect(lastState(h.sent).view.turnDeadline).toBeNull();
    const before = h.sent.length;
    h.advance(60_000);
    expect(h.sent.length).toBe(before); // nothing scheduled fired
  });

  it("pauses the timer while nobody is connected and resumes it on reconnect", async () => {
    const h = timerHarness();
    h.server.join("r", "tok-a");
    h.server.join("r", "tok-b");
    await h.server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await h.server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    await h.server.message("r", 0, { type: "chooseLead", teamIndex: 0 });
    await h.server.message("r", 1, { type: "chooseLead", teamIndex: 0 });
    expect(lastState(h.sent).view.turnDeadline).not.toBeNull();

    h.server.disconnect("r", 0);
    h.server.disconnect("r", 1);
    // With everyone gone the timer is paused: advancing time fires nothing.
    const before = h.sent.length;
    h.advance(60_000);
    expect(h.sent.length).toBe(before);

    // Reconnecting re-arms a fresh timer.
    expect(h.server.join("r", "tok-a")).toBe(0);
    const view = lastState(h.sent, 0).view;
    expect(view.turnDeadline).toBe(h.now() + 15_000);
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

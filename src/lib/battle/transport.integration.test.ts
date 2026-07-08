// src/lib/battle/transport.integration.test.ts
import { createServer, type Server as HttpServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Server as SocketServer } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import { BattleServer } from "./server-core";
import type { ServerMessage } from "./protocol";
import type { BattlePokemon } from "./types";

function team(prefix: string): BattlePokemon[] {
  const move = { move: { id: 1, name: "tackle", type: "normal" as const, category: "physical" as const, power: 40, accuracy: 100, pp: 35, priority: 0 }, pp: 35 };
  return [0, 1, 2].map((i) => ({
    id: i, name: `${prefix}${i}`, types: ["normal"], level: 50,
    stats: { hp: 150, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed: 100 },
    maxHp: 150, currentHp: 150, moves: [move], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
  }));
}

let http: HttpServer;
let sockets: Socket[] = [];
afterEach(() => {
  for (const s of sockets) s.disconnect();
  sockets = [];
  http?.close();
});

function start(): Promise<number> {
  http = createServer();
  const server = new SocketServer(http);
  const battle = new BattleServer({
    rollTeam: async () => team("T"),
    send: (roomId, slot, msg) => server.to(`${roomId}:${slot}`).emit("message", msg),
  });
  server.on("connection", (socket) => {
    const roomId = String(socket.handshake.query.roomId);
    const token = String(socket.handshake.query.token ?? "");
    const slot = battle.join(roomId, token);
    if (slot === null) return;
    socket.join(`${roomId}:${slot}`);
    socket.emit("assigned", { slot });
    const view = battle.viewFor(roomId, slot);
    if (view) socket.emit("message", { type: "state", view });
    socket.on("message", (m) => void battle.message(roomId, slot, m));
    socket.on("disconnect", () => battle.disconnect(roomId, slot));
  });
  return new Promise((resolve) => http.listen(0, () => resolve((http.address() as { port: number }).port)));
}

function connect(port: number, token: string): Socket {
  const s = ioClient(`http://localhost:${port}`, { query: { roomId: "r", token } });
  sockets.push(s);
  return s;
}

function waitFor<T>(socket: Socket, event: string, predicate: (payload: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const handler = (payload: T) => {
      if (predicate(payload)) {
        socket.off(event, handler);
        resolve(payload);
      }
    };
    socket.on(event, handler);
  });
}

describe("battle transport integration", () => {
  it("drives two clients through lobby → teams → lead → a resolved turn", async () => {
    const port = await start();
    const a = connect(port, "tokA");
    const b = connect(port, "tokB");

    // Register every listener before the connection handshake completes:
    // the server emits "assigned" and the initial state "message" back to
    // back in the same tick, so waiting for "assigned" first and only then
    // attaching the "message" listener would race — the state event could
    // already have fired (and be dropped) by the time we start listening.
    const [, , initialA, initialB] = await Promise.all([
      waitFor(a, "assigned", () => true),
      waitFor(b, "assigned", () => true),
      waitFor<ServerMessage>(a, "message", (m) => m.type === "state"),
      waitFor<ServerMessage>(b, "message", (m) => m.type === "state"),
    ]);

    // Each socket must receive its own initial state snapshot as soon as it
    // joins its room — before any client has sent a setProfile message.
    expect(initialA.type === "state" && initialA.view !== null).toBe(true);
    expect(initialB.type === "state" && initialB.view !== null).toBe(true);

    a.emit("message", { type: "setProfile", nickname: "Ash", gender: "male" });
    b.emit("message", { type: "setProfile", nickname: "Misty", gender: "female" });
    await waitFor<ServerMessage>(a, "message", (m) => m.type === "state" && m.view.phase === "teaming");

    a.emit("message", { type: "chooseLead", teamIndex: 0 });
    b.emit("message", { type: "chooseLead", teamIndex: 0 });
    await waitFor<ServerMessage>(a, "message", (m) => m.type === "state" && m.view.phase === "battle");

    a.emit("message", { type: "action", action: { kind: "move", moveIndex: 0 } });
    b.emit("message", { type: "action", action: { kind: "move", moveIndex: 0 } });
    const events = await waitFor<ServerMessage>(a, "message", (m) => m.type === "events");
    expect(events.type === "events" && events.events.length).toBeGreaterThan(0);
  }, 15000);
});

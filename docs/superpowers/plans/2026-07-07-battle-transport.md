# Battle Socket.IO Transport (Phase 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect two browsers to the same room link and run a real 3v3 battle over Socket.IO, driving the pure Phase-3 room state machine on an authoritative server.

**Architecture:** A transport-agnostic `BattleServer` (registry) holds one `Room` + one long-lived `RNG` per room and turns `ClientMessage`s into room transitions, emitting per-slot `ServerMessage`s through an injected `send`. A custom `server.ts` boots Next + Socket.IO on one port and wires sockets to the `BattleServer`. A `useBattleSocket` hook is the browser client. This phase adds runtime infra (deps + custom server) and is verified by booting the server and a two-client integration test — the pure core stays the tested `room.ts`.

**Tech Stack:** TypeScript, `socket.io` (server) + `socket.io-client` (browser), `tsx` (run the TS custom server), Vitest for the integration test. Consumes `src/lib/battle/{room,protocol,engine,rng,team-builder}.ts`.

## Global Constraints

- **One long-lived `RNG` per room**, created once and advanced across the whole battle — never re-seed per turn (would make battles non-random). Room seeds come from an internal counter (no `Date.now()` in engine/room; the server may use a counter).
- `BattleServer` is transport-agnostic: it depends only on injected `send`, `rollTeam`, and `createRng` — no `socket.io` import in `server-core.ts`. Only `server.ts` imports `socket.io`.
- The server is AUTHORITATIVE: validate every `action` against `awaitingSlots` + `legalActions` before applying; silently ignore illegal/out-of-turn messages.
- Reuse the pure room transitions verbatim; do not duplicate battle/room logic in the transport.
- Tests: `import { describe, expect, it } from "vitest"`, colocated `*.test.ts`.

---

### Task 1: Dependencies, scripts, and a booting custom server

**Files:**
- Modify: `package.json`
- Create: `server.ts`

**Interfaces:**
- Produces: a custom server that serves the existing Next app on port 3000 with a Socket.IO instance attached (handlers added in Task 3).

- [ ] **Step 1: Install deps**

Run: `pnpm add socket.io socket.io-client && pnpm add -D tsx`
Expected: added to package.json.

- [ ] **Step 2: Update `package.json` scripts** to run the custom server (dev without Turbopack, since a custom server can't use it):

```json
"scripts": {
  "dev": "tsx server.ts",
  "dev:next": "next dev --turbopack",
  "build": "next build",
  "start": "NODE_ENV=production tsx server.ts",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --passWithNoTests",
  "test:watch": "vitest",
  "format": "prettier --write ."
}
```

- [ ] **Step 3: Create `server.ts`**

```ts
import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new SocketServer(httpServer, { path: "/socket.io" });

  // Socket handlers are wired to BattleServer in Task 3.
  io.on("connection", (socket) => {
    socket.emit("hello", { ok: true });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
```

- [ ] **Step 4: Verify it boots and serves the app + accepts a socket**

Run (background): `pnpm dev` then wait for "Ready on".
Then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → expect `200`.
Then a quick socket check with a one-off node script (or defer to Task 5's harness). Kill the server after.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml server.ts
git commit -m "feat(battle): custom Next + Socket.IO server boot"
```

---

### Task 2: `BattleServer` registry (transport-agnostic)

**Files:**
- Create: `src/lib/battle/server-core.ts`
- Test: `src/lib/battle/server-core.test.ts`

**Interfaces:**
- Consumes: room transitions from `./room`; `legalActions` from `./engine`; `RNG`/`createRng` from `./rng`; `ClientMessage`/`ServerMessage` from `./protocol`; `BattlePokemon`/`SideIndex`/`TurnAction` from `./types`.
- Produces:
  - `interface ServerDeps { rollTeam: (rng: RNG) => Promise<BattlePokemon[]>; send: (roomId: string, slot: SideIndex, msg: ServerMessage) => void; createRng?: (seed: number) => RNG }`.
  - `class BattleServer` with `join(roomId): SideIndex | null`, `message(roomId, slot, msg): Promise<void>`, `disconnect(roomId, slot): void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/server-core.test.ts
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

  it("forfeits to the opponent on disconnect mid-game", async () => {
    const { server, sent } = harness();
    server.join("r"); server.join("r");
    await server.message("r", 0, { type: "setProfile", nickname: "Ash", gender: "male" });
    await server.message("r", 1, { type: "setProfile", nickname: "Misty", gender: "female" });
    server.disconnect("r", 1);
    const last = sent.filter((s) => s.msg.type === "state").at(-1)!;
    expect(last.msg.type === "state" && last.msg.view.winnerSlot).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/server-core.test.ts`
Expected: FAIL — cannot find module `./server-core`.

- [ ] **Step 3: Write `server-core.ts`**

```ts
import { legalActions } from "./engine";
import { createRng as defaultCreateRng, type RNG } from "./rng";
import type { ClientMessage, ServerMessage } from "./protocol";
import {
  applyAction, applyDisconnect, applyLead, applyProfile, awaitingSlots,
  createRoom, joinRoom, needsTeamRoll, readyToStart, resetForRematch,
  resolveIfReady, startBattle, viewFor, withTeams, type Room,
} from "./room";
import type { BattlePokemon, SideIndex, TurnAction } from "./types";

export interface ServerDeps {
  rollTeam: (rng: RNG) => Promise<BattlePokemon[]>;
  send: (roomId: string, slot: SideIndex, msg: ServerMessage) => void;
  createRng?: (seed: number) => RNG;
}

interface Entry {
  room: Room;
  rng: RNG;
}

const SLOTS: SideIndex[] = [0, 1];

export class BattleServer {
  private rooms = new Map<string, Entry>();
  private seq = 1;

  constructor(private readonly deps: ServerDeps) {}

  join(roomId: string): SideIndex | null {
    let entry = this.rooms.get(roomId);
    if (!entry) {
      const make = this.deps.createRng ?? defaultCreateRng;
      entry = { room: createRoom(roomId), rng: make(this.seq++) };
      this.rooms.set(roomId, entry);
    }
    const result = joinRoom(entry.room);
    if ("error" in result) return null;
    entry.room = result.room;
    this.broadcast(roomId);
    return result.slot;
  }

  async message(roomId: string, slot: SideIndex, msg: ClientMessage): Promise<void> {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    switch (msg.type) {
      case "setProfile":
        entry.room = applyProfile(entry.room, slot, msg.nickname, msg.gender);
        this.broadcast(roomId);
        if (needsTeamRoll(entry.room)) await this.rollTeams(roomId);
        break;
      case "chooseLead":
        entry.room = applyLead(entry.room, slot, msg.teamIndex);
        this.broadcast(roomId);
        if (readyToStart(entry.room)) {
          entry.room = startBattle(entry.room);
          this.broadcast(roomId);
        }
        break;
      case "action":
        if (!awaitingSlots(entry.room).includes(slot)) return;
        if (!this.isLegal(entry.room, slot, msg.action)) return;
        entry.room = applyAction(entry.room, slot, msg.action);
        this.advance(roomId);
        break;
      case "rematch":
        entry.room = resetForRematch(entry.room);
        this.broadcast(roomId);
        if (needsTeamRoll(entry.room)) await this.rollTeams(roomId);
        break;
    }
  }

  disconnect(roomId: string, slot: SideIndex): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    entry.room = applyDisconnect(entry.room, slot);
    this.broadcast(roomId);
  }

  private isLegal(room: Room, slot: SideIndex, action: TurnAction): boolean {
    if (!room.battle) return false;
    return legalActions(room.battle, slot).some((legal) =>
      legal.kind === action.kind &&
      (legal.kind === "move"
        ? legal.moveIndex === (action as { moveIndex: number }).moveIndex
        : legal.teamIndex === (action as { teamIndex: number }).teamIndex),
    );
  }

  private async rollTeams(roomId: string): Promise<void> {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    const [t0, t1] = await Promise.all([
      this.deps.rollTeam(entry.rng),
      this.deps.rollTeam(entry.rng),
    ]);
    entry.room = withTeams(entry.room, t0, t1);
    this.broadcast(roomId);
  }

  private advance(roomId: string): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    const result = resolveIfReady(entry.room, entry.rng);
    if (result) {
      entry.room = result.room;
      for (const slot of SLOTS) this.deps.send(roomId, slot, { type: "events", events: result.events });
    }
    this.broadcast(roomId);
  }

  private broadcast(roomId: string): void {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    for (const slot of SLOTS) {
      if (entry.room.players[slot]) {
        this.deps.send(roomId, slot, { type: "state", view: viewFor(entry.room, slot) });
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/server-core.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/server-core.ts src/lib/battle/server-core.test.ts
git commit -m "feat(battle): authoritative BattleServer registry (transport-agnostic)"
```

---

### Task 3: Wire `BattleServer` into `server.ts`

**Files:**
- Modify: `server.ts`

**Interfaces:**
- Consumes: `BattleServer` (`./src/lib/battle/server-core`); `rollBattleTeam` (`./src/lib/battle/team-builder`); `ClientMessage` (`./src/lib/battle/protocol`).

- [ ] **Step 1: Replace the placeholder connection handler in `server.ts`**

The client connects with `roomId` in the handshake query. Each socket joins the Socket.IO rooms `"<roomId>:<slot>"` (for targeted per-slot sends) and `"<roomId>"`. Messages arrive on a `"message"` event; disconnects trigger forfeit.

```ts
import { BattleServer } from "./src/lib/battle/server-core";
import { rollBattleTeam } from "./src/lib/battle/team-builder";
import type { ClientMessage } from "./src/lib/battle/protocol";

// ...inside app.prepare().then(...) after `const io = new SocketServer(...)`:

const battle = new BattleServer({
  rollTeam: (rng) => rollBattleTeam(rng),
  send: (roomId, slot, msg) => io.to(`${roomId}:${slot}`).emit("message", msg),
});

io.on("connection", (socket) => {
  const roomId = String(socket.handshake.query.roomId ?? "");
  if (!roomId) {
    socket.disconnect(true);
    return;
  }
  const slot = battle.join(roomId);
  if (slot === null) {
    socket.emit("message", { type: "error", message: "room full" });
    socket.disconnect(true);
    return;
  }
  socket.join(`${roomId}:${slot}`);
  socket.data.roomId = roomId;
  socket.data.slot = slot;
  socket.emit("assigned", { slot });

  socket.on("message", (msg: ClientMessage) => {
    void battle.message(roomId, slot, msg);
  });
  socket.on("disconnect", () => {
    battle.disconnect(roomId, slot);
  });
});
```

- [ ] **Step 2: Verify it boots without type/runtime errors**

Run: `pnpm typecheck` → PASS.
Run (background): `pnpm dev`, wait for "Ready on", `curl` home → `200`, then kill. (Full socket flow is verified in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat(battle): wire Socket.IO connection to BattleServer"
```

---

### Task 4: `useBattleSocket` client hook

**Files:**
- Create: `src/hooks/use-battle-socket.ts`

**Interfaces:**
- Consumes: `socket.io-client`; `ClientMessage`, `ServerMessage`, `RoomView` (`@/lib/battle/protocol`).
- Produces: `useBattleSocket(roomId: string): { view: RoomView | null; slot: SideIndex | null; events: BattleEvent[]; error: string | null; send: (msg: ClientMessage) => void }`.

- [ ] **Step 1: Write `use-battle-socket.ts`**

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientMessage, RoomView, ServerMessage } from "@/lib/battle/protocol";
import type { BattleEvent, SideIndex } from "@/lib/battle/types";

export function useBattleSocket(roomId: string) {
  const [view, setView] = useState<RoomView | null>(null);
  const [slot, setSlot] = useState<SideIndex | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({ query: { roomId }, path: "/socket.io" });
    socketRef.current = socket;
    socket.on("assigned", (data: { slot: SideIndex }) => setSlot(data.slot));
    socket.on("message", (msg: ServerMessage) => {
      if (msg.type === "state") setView(msg.view);
      else if (msg.type === "events") setEvents(msg.events);
      else if (msg.type === "error") setError(msg.message);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  const send = (msg: ClientMessage) => socketRef.current?.emit("message", msg);
  return { view, slot, events, error, send };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-battle-socket.ts
git commit -m "feat(battle): useBattleSocket client hook"
```

---

### Task 5: Two-client integration test

**Files:**
- Create: `src/lib/battle/transport.integration.test.ts`

**Interfaces:**
- Consumes: `BattleServer` (`./server-core`); `socket.io` + `socket.io-client`; a fixed fake team via `rollTeam`.

- [ ] **Step 1: Write the integration test** (spins up a real Socket.IO server wired to `BattleServer`, connects two clients, drives lobby → teams → lead → one turn)

```ts
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
    const slot = battle.join(roomId);
    if (slot === null) return;
    socket.join(`${roomId}:${slot}`);
    socket.emit("assigned", { slot });
    socket.on("message", (m) => void battle.message(roomId, slot, m));
    socket.on("disconnect", () => battle.disconnect(roomId, slot));
  });
  return new Promise((resolve) => http.listen(0, () => resolve((http.address() as { port: number }).port)));
}

function connect(port: number): Socket {
  const s = ioClient(`http://localhost:${port}`, { query: { roomId: "r" } });
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
    const a = connect(port);
    const b = connect(port);
    await Promise.all([
      waitFor(a, "assigned", () => true),
      waitFor(b, "assigned", () => true),
    ]);

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
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `pnpm vitest run src/lib/battle/transport.integration.test.ts`
Expected: PASS (1 test). If it times out, raise the per-test timeout with `it(..., { timeout: 10000 })`.

- [ ] **Step 3: Full gate**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/battle/transport.integration.test.ts
git commit -m "test(battle): two-client Socket.IO integration flow"
```

---

## Self-Review

**Spec coverage (Phase 3b scope):**
- Link-based rooms over Socket.IO → server.ts connection uses `roomId` from handshake (Tasks 1, 3). ✓
- Authoritative server, one long-lived RNG per room → `BattleServer` holds `{ room, rng }` per room, threads the same rng through team roll and every `resolveIfReady` (Task 2). ✓
- Action validation (awaitingSlots + legalActions) → `BattleServer.isLegal` + awaiting check (Task 2). ✓
- Async team roll on `needsTeamRoll` → `rollTeams` calls injected `rollBattleTeam` (Tasks 2, 3). ✓
- Per-slot views + turn event broadcast → `broadcast`/`advance` (Task 2), targeted via `"<roomId>:<slot>"` rooms (Task 3). ✓
- Disconnect = forfeit → `disconnect` → `applyDisconnect` (Task 2). ✓
- Client hook → `useBattleSocket` (Task 4). ✓
- Verified end-to-end by a two-client integration test (Task 5). ✓
- **Deferred to Phase 4:** the retro battle UI that renders `RoomView` and calls `send`.

**Placeholder scan:** none.

**Type consistency:** `ClientMessage`/`ServerMessage`/`RoomView` from `protocol.ts`; room transitions + `viewFor`/`awaitingSlots` from `room.ts`; `legalActions` from `engine.ts`; `RNG`/`createRng` from `rng.ts`; `rollBattleTeam` from `team-builder.ts` — all Phase 1–3 exports used verbatim. `BattleServer`'s `send` signature matches how both `server.ts` (Task 3) and the integration harness (Task 5) call it.

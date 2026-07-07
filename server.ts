import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { BattleServer } from "./src/lib/battle/server-core";
import { rollBattleTeam } from "./src/lib/battle/team-builder";
import type { ClientMessage } from "./src/lib/battle/protocol";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new SocketServer(httpServer, { path: "/socket.io" });

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

    const view = battle.viewFor(roomId, slot);
    if (view) socket.emit("message", { type: "state", view });

    socket.on("message", (msg: ClientMessage) => {
      void battle.message(roomId, slot, msg);
    });
    socket.on("disconnect", () => {
      battle.disconnect(roomId, slot);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});

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

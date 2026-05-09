const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const waitingUsers = [];
const pairs = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("find-partner", () => {
    if (pairs.has(socket.id)) return;

    const idx = waitingUsers.findIndex((s) => s.id !== socket.id);
    if (idx !== -1) {
      const partner = waitingUsers.splice(idx, 1)[0];
      pairs.set(socket.id, partner.id);
      pairs.set(partner.id, socket.id);

      socket.emit("matched", { partnerId: partner.id, initiator: true });
      partner.emit("matched", { partnerId: socket.id, initiator: false });
      console.log(`Paired: ${socket.id} <-> ${partner.id}`);
    } else {
      if (!waitingUsers.find((s) => s.id === socket.id)) {
        waitingUsers.push(socket);
      }
      socket.emit("waiting");
    }
  });

  socket.on("signal", ({ to, signal }) => {
    io.to(to).emit("signal", { from: socket.id, signal });
  });

  socket.on("chat-message", (msg) => {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("chat-message", msg);
    }
  });

  socket.on("skip", () => {
    disconnectPair(socket);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    const i = waitingUsers.findIndex((s) => s.id === socket.id);
    if (i !== -1) waitingUsers.splice(i, 1);
    disconnectPair(socket);
  });
});

function disconnectPair(socket) {
  const partnerId = pairs.get(socket.id);
  if (partnerId) {
    pairs.delete(socket.id);
    pairs.delete(partnerId);
    io.to(partnerId).emit("partner-disconnected");
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Omegle clone running at http://localhost:${PORT}`);
});

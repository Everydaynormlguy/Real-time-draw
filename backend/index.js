const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// ✅ health route
app.get("/", (req, res) => {
  res.send("🎨 Real-time Draw Backend is running 🚀");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", (room) => {
    socket.join(room);

    if (!rooms[room]) rooms[room] = [];

    // 🔥 send full canvas
    socket.emit("init", rooms[room]);
  });

  // 🔥 LIVE DRAW (no storing, just preview)
  socket.on("draw_live", ({ room, point }) => {
    socket.to(room).emit("draw_live", point);
  });

  // 🔥 FINAL STROKE (store + broadcast full state)
  socket.on("draw_stroke", ({ room, stroke }) => {
    if (!rooms[room]) rooms[room] = [];

    rooms[room].push(stroke);

    // ✅ FIX: send full canvas to all
    io.to(room).emit("update_canvas", rooms[room]);
  });

  // 🔥 UNDO
  socket.on("undo", (room) => {
    if (rooms[room] && rooms[room].length > 0) {
      rooms[room].pop();

      // ✅ sync all users
      io.to(room).emit("update_canvas", rooms[room]);
    }
  });

  // 🔥 CLEAR
  socket.on("clear", (room) => {
    rooms[room] = [];

    // ✅ sync all users
    io.to(room).emit("update_canvas", []);
  });

  // 🔥 CLEANUP on disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
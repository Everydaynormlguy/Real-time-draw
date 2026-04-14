const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

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

    socket.emit("init", rooms[room]);
  });

  // 🔥 live drawing
  socket.on("draw_live", ({ room, point }) => {
    socket.to(room).emit("draw_live", point);
  });

  // 🔥 final stroke
  socket.on("draw_stroke", ({ room, stroke }) => {
    if (!rooms[room]) rooms[room] = [];

    rooms[room].push(stroke);
    io.to(room).emit("draw_stroke", stroke);
  });

  socket.on("undo", (room) => {
    if (rooms[room] && rooms[room].length > 0) {
      rooms[room].pop();
      io.to(room).emit("update_canvas", rooms[room]);
    }
  });

  socket.on("clear", (room) => {
    rooms[room] = [];
    io.to(room).emit("update_canvas", []);
  });

  // 🔥 cursor movement
  socket.on("cursor_move", ({ room, x, y, id }) => {
    socket.to(room).emit("cursor_move", { x, y, id });
  });

  // 🔥 drawing status (for active cursor)
  socket.on("drawing_status", ({ room, isDrawing, id }) => {
    socket.to(room).emit("drawing_status", { isDrawing, id });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
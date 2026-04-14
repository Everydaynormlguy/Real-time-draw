import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://real-time-draw-backend.onrender.com");

function App() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const currentStroke = useRef([]);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(2);
  const [, setStrokes] = useState([]);
  const [cursors, setCursors] = useState({});
  const [activeDrawer, setActiveDrawer] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    socket.emit("join_room", "room1");

    // load drawing
    socket.on("init", (data) => {
      setStrokes(data);
      redrawCanvas(data);
    });

    // live drawing
    socket.on("draw_live", ({ x, y, color, size }) => {
      const ctx = canvasRef.current.getContext("2d");

      ctx.strokeStyle = color;
      ctx.lineWidth = size;

      ctx.lineTo(x, y);
      ctx.stroke();
    });

    // final stroke
    socket.on("draw_stroke", (stroke) => {
      setStrokes((prev) => {
        const updated = [...prev, stroke];
        redrawCanvas(updated);
        return updated;
      });
    });

    // undo / clear
    socket.on("update_canvas", (data) => {
      setStrokes(data);
      redrawCanvas(data);
    });

    // cursor
    socket.on("cursor_move", ({ x, y, id }) => {
      setCursors((prev) => ({
        ...prev,
        [id]: { x, y },
      }));
    });

    // active drawing user
    socket.on("drawing_status", ({ isDrawing, id }) => {
      if (isDrawing) setActiveDrawer(id);
      else setActiveDrawer(null);
    });

    const startDrawing = (e) => {
      drawing.current = true;
      currentStroke.current = [];

      socket.emit("drawing_status", {
        room: "room1",
        isDrawing: true,
        id: socket.id,
      });

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const stopDrawing = () => {
      drawing.current = false;
      ctx.beginPath();

      socket.emit("drawing_status", {
        room: "room1",
        isDrawing: false,
        id: socket.id,
      });

      if (currentStroke.current.length > 0) {
        socket.emit("draw_stroke", {
          room: "room1",
          stroke: currentStroke.current,
        });
      }
    };

    const draw = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      socket.emit("cursor_move", {
        x,
        y,
        room: "room1",
        id: socket.id,
      });

      if (!drawing.current) return;

      currentStroke.current.push({ x, y, color, size });

      ctx.strokeStyle = color;
      ctx.lineWidth = size;

      ctx.lineTo(x, y);
      ctx.stroke();

      socket.emit("draw_live", {
        room: "room1",
        point: { x, y, color, size },
      });
    };

    // 🖱️ mouse events
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mousemove", draw);

    // 📱 mobile touch support
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      startDrawing({
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    });

    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      stopDrawing();
    });

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      draw({
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    });

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mousemove", draw);

      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchend", stopDrawing);
      canvas.removeEventListener("touchmove", draw);

      socket.off("init");
      socket.off("draw_live");
      socket.off("draw_stroke");
      socket.off("update_canvas");
      socket.off("cursor_move");
      socket.off("drawing_status");
    };
  }, [color, size]);

  const redrawCanvas = (allStrokes) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    allStrokes.forEach((stroke) => {
      ctx.beginPath();
      stroke.forEach((p) => {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });
      ctx.beginPath();
    });
  };

  const undoLast = () => {
    socket.emit("undo", "room1");
  };

  const clearCanvas = () => {
    socket.emit("clear", "room1");
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Real-time Drawing App 🎨</h2>

      <div style={{ marginBottom: "10px" }}>
        <label>Color: </label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />

        <label style={{ marginLeft: "10px" }}>Brush Size: </label>
        <input
          type="range"
          min="1"
          max="10"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />

        <button onClick={undoLast} style={{ marginLeft: "10px" }}>
          Undo
        </button>

        <button onClick={clearCanvas} style={{ marginLeft: "10px" }}>
          Clear
        </button>
      </div>

      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{
            border: "2px solid black",
            cursor: "crosshair",
            touchAction: "none",
          }}
        />

        {/* 👥 active cursor */}
        {Object.entries(cursors).map(([id, pos]) => {
          if (activeDrawer && activeDrawer !== id) return null;

          return (
            <div
              key={id}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                pointerEvents: "none",
                fontSize: "20px",
              }}
            >
              🖊️
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
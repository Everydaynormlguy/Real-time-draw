import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://real-time-draw-backend.onrender.com");

function App() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const currentStroke = useRef([]);
  const lastPoint = useRef(null);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(2);
  const [strokes, setStrokes] = useState([]);

  const btnStyle = (bg) => ({
    padding: "8px 14px",
    borderRadius: "10px",
    border: "none",
    background: bg,
    color: "white",
    cursor: "pointer",
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    socket.emit("join_room", "room1");

    // 🔥 INIT + SYNC
    socket.on("init", (data) => {
      setStrokes(data);
      redrawCanvas(data);
    });

    socket.on("update_canvas", (data) => {
      setStrokes(data);
      redrawCanvas(data);
    });

    // 🔥 FIXED LIVE DRAW (SMOOTH)
    socket.on("draw_live", ({ x, y, prevX, prevY, color, size }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;

      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    const getCoords = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const startDrawing = (e) => {
      drawing.current = true;
      currentStroke.current = [];

      const { x, y } = getCoords(e);
      lastPoint.current = { x, y };

      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const stopDrawing = () => {
      drawing.current = false;
      ctx.beginPath();

      if (currentStroke.current.length > 0) {
        socket.emit("draw_stroke", {
          room: "room1",
          stroke: currentStroke.current,
        });
      }
    };

    const draw = (e) => {
      if (!drawing.current) return;

      const { x, y } = getCoords(e);
      const prev = lastPoint.current;

      currentStroke.current.push({ x, y, color, size });

      ctx.strokeStyle = color;
      ctx.lineWidth = size;

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      socket.emit("draw_live", {
        room: "room1",
        point: {
          x,
          y,
          prevX: prev.x,
          prevY: prev.y,
          color,
          size,
        },
      });

      lastPoint.current = { x, y };
    };

    // 🖱️ mouse
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mousemove", draw);

    // 📱 touch
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      startDrawing(e.touches[0]);
    });

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      draw(e.touches[0]);
    });

    canvas.addEventListener("touchend", stopDrawing);

    return () => {
      socket.off("init");
      socket.off("update_canvas");
      socket.off("draw_live");

      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mousemove", draw);

      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
    };
  }, [color, size]);

  // 🔥 PERFECT REDRAW
  const redrawCanvas = (allStrokes) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    allStrokes.forEach((stroke) => {
      ctx.beginPath();

      stroke.forEach((p, i) => {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;

        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });

      ctx.stroke();
    });
  };

  const undoLast = () => {
    socket.emit("undo", "room1");
  };

  const clearCanvas = () => {
    socket.emit("clear", "room1");
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2>🎨 Draw Together</h2>

      <div style={{ marginBottom: "10px" }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="range" min="1" max="10" value={size} onChange={(e) => setSize(e.target.value)} />

        <button onClick={undoLast} style={btnStyle("#4f46e5")}>
          Undo
        </button>
        <button onClick={clearCanvas} style={btnStyle("#ef4444")}>
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          border: "2px solid black",
          borderRadius: "10px",
          touchAction: "none",
        }}
      />
    </div>
  );
}

export default App;
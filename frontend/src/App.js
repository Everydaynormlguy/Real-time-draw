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

  const btnStyle = (bg) => ({
    padding: "8px 14px",
    borderRadius: "10px",
    border: "none",
    background: bg,
    color: "white",
    cursor: "pointer",
    transition: "0.2s",
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    socket.emit("join_room", "room1");

    socket.on("init", (data) => {
      setStrokes(data);
      redrawCanvas(data);
    });

    socket.on("draw_live", ({ x, y, color, size }) => {
      const ctx = canvasRef.current.getContext("2d");
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    socket.on("draw_stroke", (stroke) => {
      setStrokes((prev) => {
        const updated = [...prev, stroke];
        redrawCanvas(updated);
        return updated;
      });
    });

    socket.on("update_canvas", (data) => {
      setStrokes(data);
      redrawCanvas(data);
    });

    socket.on("cursor_move", ({ x, y, id }) => {
      setCursors((prev) => ({
        ...prev,
        [id]: { x, y },
      }));
    });

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

    // Mouse events
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mousemove", draw);

    // Touch events (mobile)
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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: "1000px",
          background: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ color: "white", marginBottom: "15px" }}>
          🎨 Draw Together
        </h2>

        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: "45px",
              height: "45px",
              borderRadius: "10px",
              border: "none",
            }}
          />

          <input
            type="range"
            min="1"
            max="10"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />

          <button onClick={undoLast} style={btnStyle("#4f46e5")}>
            Undo
          </button>

          <button onClick={clearCanvas} style={btnStyle("#ef4444")}>
            Clear
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{
              width: "100%",
              borderRadius: "15px",
              background: "white",
              cursor: "crosshair",
              touchAction: "none",
            }}
          />

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
                  filter: "drop-shadow(0 0 5px white)",
                }}
              >
                🖊️
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
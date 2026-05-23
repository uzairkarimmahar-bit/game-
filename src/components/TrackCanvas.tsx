import { useEffect, useRef, useState } from "react";
import { Player, TrackType } from "../types.js";

interface TrackCanvasProps {
  players: Player[];
  track: TrackType;
  currentPlayerId: string;
}

export default function TrackCanvas({ players, track, currentPlayerId }: TrackCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const interpPositionsRef = useRef<Record<string, number>>({});
  
  // Track scroll speed based on player typing performance (WPM)
  const localPlayer = players.find(p => p.id === currentPlayerId);
  const scrollSpeedRef = useRef(1);
  const scrollOffsetRef = useRef(0);

  useEffect(() => {
    // Smoothly update visual track movement speed from current WPM
    const targetSpeed = localPlayer && !localPlayer.isFrozen ? Math.min(20, localPlayer.wpm / 10 + 1) : 1;
    scrollSpeedRef.current += (targetSpeed - scrollSpeedRef.current) * 0.05;
  }, [localPlayer]);

  // Set up ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 400),
          height: Math.max(300, 80 + players.length * 62),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [players.length]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save scroll offsets
      scrollOffsetRef.current = (scrollOffsetRef.current + scrollSpeedRef.current) % 1000;
      const scroll = scrollOffsetRef.current;

      // Draw BACKGROUND by Track Theme
      drawBackground(ctx, canvas.width, canvas.height, track, scroll);

      // Track layouts
      const laneCount = Math.max(1, players.length);
      const trackPaddingTop = 60;
      const trackPaddingBottom = 40;
      const trackHeight = canvas.height - trackPaddingTop - trackPaddingBottom;
      const laneHeight = trackHeight / laneCount;

      // Draw Track road asphalt bed
      ctx.fillStyle = getAsphaltColor(track);
      ctx.fillRect(50, trackPaddingTop, canvas.width - 100, trackHeight);

      // Draw finish and start markers
      const startX = 110;
      const finishX = canvas.width - 110;

      // Draw Checkered Finish wall
      drawFinishLine(ctx, finishX, trackPaddingTop, trackHeight, track);

      // Draw Lanes & dividers
      for (let i = 0; i < laneCount; i++) {
        const laneY = trackPaddingTop + i * laneHeight;
        
        // Lane strip dividers
        if (i > 0) {
          ctx.strokeStyle = getLaneDividerColor(track);
          ctx.lineWidth = 3;
          ctx.setLineDash([20, 15]);
          ctx.beginPath();
          ctx.moveTo(80, laneY);
          ctx.lineTo(canvas.width - 80, laneY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Ambient lane numbers/labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`LANE ${i + 1}`, 65, laneY + laneHeight / 2 + 5);
      }

      // Draw Cars with Interpolated progression
      players.forEach((p, idx) => {
        const laneY = trackPaddingTop + idx * laneHeight;
        const centerLaneY = laneY + laneHeight / 2;

        // Maintain socket state interpolation
        if (interpPositionsRef.current[p.id] === undefined) {
          interpPositionsRef.current[p.id] = p.progress;
        } else {
          // Smooth spring-decay towards new server progress
          const diff = p.progress - interpPositionsRef.current[p.id];
          interpPositionsRef.current[p.id] += diff * 0.12;
        }

        const exactProgress = interpPositionsRef.current[p.id];
        const carX = startX + (exactProgress / 100) * (finishX - startX);

        // Draw typing car model
        drawTypingCar(
          ctx, 
          carX, 
          centerLaneY, 
          p, 
          p.id === currentPlayerId, 
          track
        );
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [dimensions, players, track, currentPlayerId]);

  // Color selection details
  const getAsphaltColor = (theme: TrackType) => {
    switch (theme) {
      case "city": return "#0F172A"; // dark charcoal
      case "desert": return "#451A03"; // dusty brown
      case "cyberpunk": return "#050B14"; // terminal pitch black
      case "space": return "#03001C"; // interstellar blue-black
    }
  };

  const getLaneDividerColor = (theme: TrackType) => {
    switch (theme) {
      case "city": return "#EC4899"; // neon magenta
      case "desert": return "#D97706"; // dry orange
      case "cyberpunk": return "#10B981"; // virtual slime green
      case "space": return "#38BDF8"; // cosmic turquoise
    }
  };

  // Draw scrolling backgrounds
  const drawBackground = (ctx: CanvasRenderingContext2D, w: number, h: number, theme: TrackType, offset: number) => {
    if (theme === "city") {
      // Cool gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#020617");
      grad.addColorStop(1, "#1E1B4B");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Draw simple neon buildings in background
      ctx.strokeStyle = "rgba(139, 92, 246, 0.12)";
      ctx.lineWidth = 1;
      const bWidth = 80;
      for (let x = -offset * 0.2; x < w + bWidth; x += bWidth) {
        const buildHeight = 150 + Math.sin(x) * 60;
        ctx.strokeRect(x, h - buildHeight - 20, bWidth - 10, buildHeight);
        // build windows
        ctx.fillStyle = "rgba(250, 204, 21, 0.05)";
        ctx.fillRect(x + 10, h - buildHeight, bWidth - 30, buildHeight - 40);
      }
    } else if (theme === "desert") {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#7C2D12"); // burnt deep sky orange
      grad.addColorStop(1, "#F59E0B"); // ambient desert gold
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Cacti background drawings
      ctx.fillStyle = "#166534";
      for (let x = -offset * 0.4; x < w + 200; x += 180) {
        const cy = h - 50 + Math.sin(x) * 10;
        // trunk
        ctx.fillRect(x, cy - 30, 8, 30);
        // arms
        ctx.fillRect(x - 8, cy - 22, 16, 6);
        ctx.fillRect(x - 8, cy - 30, 4, 10);
        ctx.fillRect(x + 12, cy - 26, 4, 10);
      }
    } else if (theme === "cyberpunk") {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, w, h);

      // Draw digital grids
      ctx.strokeStyle = "rgba(236, 72, 153, 0.15)";
      ctx.lineWidth = 1.5;
      for (let x = -offset % 50; x < w; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else if (theme === "space") {
      ctx.fillStyle = "#01010D";
      ctx.fillRect(0, 0, w, h);

      // Ambient blinking stars
      ctx.fillStyle = "#FFFFFF";
      for (let i = 0; i < 40; i++) {
        const sx = (Math.sin(i * 45) * w * 1.5 - offset * 0.15) % w;
        const starX = sx < 0 ? sx + w : sx;
        const starY = (Math.cos(i * 200) * h * 0.8 + h * 0.5) % h;
        const size = Math.random() > 0.6 ? 2.5 : 1;
        ctx.fillRect(starX, starY, size, size);
      }

      // Space nebula/planet
      ctx.fillStyle = "rgba(139, 92, 246, 0.2)";
      ctx.beginPath();
      ctx.arc(w - 120, 80, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.beginPath();
      ctx.ellipse(w - 120, 80, 65, 12, Math.PI / 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const drawFinishLine = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, theme: TrackType) => {
    const boxSize = 10;
    const colCount = 2;
    const rowCount = Math.ceil(h / boxSize);

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#FFFFFF" : "#000000";
        ctx.fillRect(x + c * boxSize - boxSize, y + r * boxSize, boxSize, boxSize);
      }
    }

    // Glow outline for nitro look
    ctx.strokeStyle = theme === "city" || theme === "cyberpunk" ? "#F43F5E" : "#10B981";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - boxSize, y);
    ctx.lineTo(x - boxSize, y + h);
    ctx.stroke();
  };

  // Draw customized sports car on the canvas coordinate points
  const drawTypingCar = (
    ctx: CanvasRenderingContext2D, 
    cx: number, 
    cy: number, 
    p: Player, 
    isLocal: boolean,
    theme: TrackType
  ) => {
    ctx.save();

    // Powerup Nitro flame burst
    if (p.boostActive) {
      ctx.fillStyle = "#EF4444";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const flareY = cy + (Math.random()! * 12 - 6);
        const flareLength = 35 + Math.random()! * 25;
        ctx.moveTo(cx - 30, cy);
        ctx.lineTo(cx - 30 - flareLength, flareY);
        ctx.lineTo(cx - 30, cy + (Math.random()! * 10 - 5));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.arc(cx - 32, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Car Body dimensions
    const length = 52;
    const height = 24;
    const rx = cx - length / 2;
    const ry = cy - height / 2;

    // Draw Wheel tires
    ctx.fillStyle = "#1E293B";
    // front-left, front-right, rear-left, rear-right
    const whWidth = 12;
    const whHeight = 6;
    ctx.fillRect(rx + 8, ry - 3, whWidth, whHeight); // top front
    ctx.fillRect(rx + 34, ry - 3, whWidth, whHeight); // top rear
    ctx.fillRect(rx + 8, ry + height - 3, whWidth, whHeight); // bottom front
    ctx.fillRect(rx + 34, ry + height - 3, whWidth, whHeight); // bottom rear

    // Wheel rims flash
    ctx.fillStyle = p.boostActive ? "#67E8F9" : "#F1F5F9";
    ctx.fillRect(rx + 11, ry - 2, 6, 4);
    ctx.fillRect(rx + 37, ry - 2, 6, 4);
    ctx.fillRect(rx + 11, ry + height - 2, 6, 4);
    ctx.fillRect(rx + 37, ry + height - 2, 6, 4);

    // Main Car Chassis styling
    ctx.fillStyle = p.carColor;
    ctx.beginPath();
    ctx.moveTo(rx, ry + 4); // Rear base
    ctx.lineTo(rx + 12, ry + 2); // Rear hatch back
    ctx.lineTo(rx + 28, ry + 1); // Cockpit baseline
    ctx.lineTo(rx + 42, ry + 5); // Front hood
    ctx.lineTo(rx + length, cy); // Front bumper tip
    ctx.lineTo(rx + 42, ry + height - 5); // Front hood low
    ctx.lineTo(rx + 28, ry + height - 1); // Cockpit low
    ctx.lineTo(rx + 12, ry + height - 2); // Rear hatch low
    ctx.lineTo(rx, ry + height - 4); // Rear base low
    ctx.closePath();
    ctx.fill();

    // Spoiler wings
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(rx - 4, ry - 5, 6, height + 10);
    // struts
    ctx.fillStyle = p.carColor;
    ctx.fillRect(rx + 1, ry + 1, 4, 3);
    ctx.fillRect(rx + 1, ry + height - 4, 4, 3);

    // Car Cockpit glassy surface bubble
    ctx.fillStyle = isLocal ? "rgba(34, 211, 238, 0.85)" : "rgba(255, 255, 255, 0.65)";
    ctx.beginPath();
    ctx.moveTo(rx + 16, ry + 6);
    ctx.lineTo(rx + 32, ry + 8);
    ctx.lineTo(rx + 36, cy);
    ctx.lineTo(rx + 32, ry + height - 8);
    ctx.lineTo(rx + 16, ry + height - 6);
    ctx.closePath();
    ctx.fill();

    // Hot neon side stripe decal
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(rx + 15, cy - 2, 18, 4);

    // Custom Local User Indicator Arrow Glow
    if (isLocal) {
      ctx.fillStyle = "#06B6D4"; // Cyan glow arrow
      ctx.beginPath();
      const pulseY = ry - 14 + Math.sin(Date.now() / 150) * 3;
      ctx.moveTo(cx, pulseY);
      ctx.lineTo(cx - 5, pulseY - 6);
      ctx.lineTo(cx + 5, pulseY - 6);
      ctx.closePath();
      ctx.fill();
    }

    // Shield effect bubbles overlay
    if (p.shieldActive) {
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#38BDF8";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, length * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.fill();
      // reset shadow
      ctx.shadowBlur = 0;
    }

    // Ice freeze visual overlay blocking action
    if (p.isFrozen) {
      ctx.fillStyle = "rgba(147, 197, 253, 0.65)";
      ctx.strokeStyle = "#60A5FA";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(cx - length * 0.65, cy - height * 0.9, length * 1.3, height * 1.8);
      ctx.fill();
      ctx.stroke();

      // Ice cracks inside block
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 5);
      ctx.lineTo(cx + 10, cy + 5);
      ctx.moveTo(cx - 5, cy + 10);
      ctx.lineTo(cx - 15, cy - 10);
      ctx.stroke();
    }

    // User Text details (Nickname and current WPM)
    ctx.fillStyle = isLocal ? "#FFFFFF" : "#CBD5E1";
    ctx.font = isLocal ? "bold 12px Inter, sans-serif" : "11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${p.nickname}`, cx, ry - (isLocal ? 18 : 10));

    // Display finished Rank Checkered Indicator
    if (p.finished) {
      ctx.fillStyle = "#10B981";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`🚩 #${p.rank}`, cx, ry + height + 16);
    } else {
      ctx.fillStyle = p.isFrozen ? "#38BDF8" : "rgba(255, 255, 255, 0.75)";
      ctx.font = "10px monospace";
      ctx.fillText(`${p.wpm} WPM`, cx, ry + height + 12);
    }

    ctx.restore();
  }
}

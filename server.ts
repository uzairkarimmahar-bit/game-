import express from "express";
import http from "http";
import path from "path";
import { Server, Socket } from "socket.io";
import { createServer as createViteServer } from "vite";
import { Player, Room, LeaderboardEntry, TrackType, DifficultyType, PowerUpEvent } from "./src/types.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 3000;

// Embedded race texts by difficulty
const SHORT_PRESET_TEXTS: Record<DifficultyType, string[]> = {
  easy: [
    "The sun rises over the horizon, lighting up the track for a beautiful racing day.",
    "Keep your fingers on the home row and do not look down at the keyboard.",
    "Typing quickly is a super power that saves you time every single day.",
    "Ready, set, go! Let the cars roll and see who wins the grand prize today.",
    "Practice makes perfect when you type these easy words in a straight line."
  ],
  medium: [
    "Speed limits are only suggestions for a true driver when nitro is fully loaded into the engine.",
    "Precision triumphs over brute force; coding a neat codebase beats slamming your fingers onto keys.",
    "The flashing neon signs of Neo-Tokyo reflected off wet asphalt like millions of tiny diamonds of light.",
    "Multiplayer arcade games deliver massive dopamine shots especially when you pull off an unexpected nitro drift.",
    "When the countdown hits zero, press down on the digital accelerator pedal and do not look back."
  ],
  hard: [
    "The asynchronous event loop in Node.js processes input and output operations highly efficiently without blocking threads.",
    "Quantum computing utilizes superposition and entanglement characteristics to solve high dimensional matrices.",
    "Cryptographic algorithms such as SHA-256 process standard string sequences through bitwise rotations and XOR steps.",
    "Navigating the intricate maze of CSS grid layouts coupled with responsive breakpoints feels like three-dimension algebra.",
    "Object-oriented composition paradigms prioritize soft modular aggregation constructs over rigid subclass inheritance structures."
  ]
};

const BOT_NAMES = [
  "Speedy Bot", "Drift Master", "Cyber Fingers", "Shift-Enter", "WPM Slayer",
  "Turbo Racer", "Syntax Error", "Pixel Drift", "Neon Spark", "N2O Chaser"
];

// In-Memory state
const rooms = new Map<string, Room>();
let globalLeaderboard: LeaderboardEntry[] = [
  { nickname: "FlashKeyboard", wpm: 122, accuracy: 99, date: "May 23, 2026", track: "cyberpunk", difficulty: "hard" },
  { nickname: "TypographicGamer", wpm: 98, accuracy: 96, date: "May 22, 2026", track: "city", difficulty: "easy" },
  { nickname: "NitroZ", wpm: 88, accuracy: 94, date: "May 23, 2026", track: "space", difficulty: "medium" },
  { nickname: "SyntaxCruiser", wpm: 104, accuracy: 97, date: "May 21, 2026", track: "cyberpunk", difficulty: "medium" },
  { nickname: "SpeedRunner", wpm: 75, accuracy: 92, date: "May 23, 2026", track: "desert", difficulty: "easy" }
];

// Utility: Generate Join Code
const generateRoomId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Global Tick loop for Racing Status (including Bot progression)
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, roomId) => {
    if (room.status !== "racing") return;

    let stateChanged = false;

    // Simulate bots if enabled
    if (room.useBots) {
      room.players.forEach(p => {
        if (!p.isBot || p.finished) return;

        // Apply ice freeze guard
        if (p.isFrozen) {
          if (p.frozenUntil && now >= p.frozenUntil) {
            p.isFrozen = false;
            p.frozenUntil = undefined;
            stateChanged = true;
          } else {
            // Frozen bot cannot progress
            return;
          }
        }

        // Progression physics based on difficulty
        let baseWpm = 30; // easy bot
        if (p.botDifficulty === "medium") baseWpm = 55;
        if (p.botDifficulty === "hard") baseWpm = 85;

        // Nitro modifier
        let wpmMultiplier = p.boostActive ? 1.5 : 1.0;
        
        // Random drift speed per tick
        const tickWpm = baseWpm * wpmMultiplier + (Math.random()! * 10 - 5);
        p.wpm = Math.max(15, Math.floor(tickWpm));

        // Speed calculation -> accuracy
        p.accuracy = p.boostActive ? 100 : Math.floor(92 + Math.random()! * 7);

        // Increase characters
        const charsPerTick = (p.wpm * 5) / 60; // characters per second (assuming 1hz interval)
        p.typedLength = Math.min(room.targetText.length, Math.floor(p.typedLength + charsPerTick));
        p.progress = Math.min(100, Math.floor((p.typedLength / room.targetText.length) * 100));

        // Let bots use powerups autonomously!
        // Increment shield or powerup meter
        p.boostCharge = Math.min(100, p.boostCharge + Math.floor(Math.random()! * 15 + 10));

        if (p.boostCharge >= 100) {
          // Trigger Random power-up action!
          p.boostCharge = 0;
          const powerups = ["nitro", "freeze", "shield"];
          const choice = powerups[Math.floor(Math.random()! * powerups.length)];

          if (choice === "nitro") {
            p.boostActive = true;
            io.to(roomId).emit("powerup:activated", {
              senderId: p.id,
              senderNickname: p.nickname,
              type: "nitro"
            });
            // Stop nitro after 3 seconds
            setTimeout(() => {
              p.boostActive = false;
              io.to(roomId).emit("room:update", room);
            }, 3000);
          } else if (choice === "freeze") {
            // Targets a random user who is not bot or is other player
            const opponents = room.players.filter(opp => opp.id !== p.id && !opp.finished && !opp.isBot);
            const target = opponents[Math.floor(Math.random()! * opponents.length)];
            if (target) {
              if (target.shieldActive) {
                target.shieldActive = false; // block freeze
                io.to(roomId).emit("powerup:blocked", {
                  senderId: p.id,
                  targetId: target.id,
                  type: "freeze"
                });
              } else {
                target.isFrozen = true;
                target.frozenUntil = Date.now() + 2000;
                io.to(roomId).emit("powerup:activated", {
                  senderId: p.id,
                  senderNickname: p.nickname,
                  type: "freeze",
                  targetId: target.id
                });
                setTimeout(() => {
                  target.isFrozen = false;
                  target.frozenUntil = undefined;
                  io.to(roomId).emit("room:update", room);
                }, 2000);
              }
            }
          } else if (choice === "shield") {
            p.shieldActive = true;
            io.to(roomId).emit("powerup:activated", {
              senderId: p.id,
              senderNickname: p.nickname,
              type: "shield"
            });
            setTimeout(() => {
              p.shieldActive = false;
              io.to(roomId).emit("room:update", room);
            }, 6000);
          }
        }

        // Check is finished
        if (p.typedLength >= room.targetText.length && !p.finished) {
          p.finished = true;
          p.progress = 100;
          p.finishTime = Date.now() - (room.startTime ?? Date.now());
          
          const finishedPlayers = room.players.filter(x => x.finished);
          p.rank = finishedPlayers.length; // 1-based rank
        }
        stateChanged = true;
      });
    }

    // Double check if all players finished
    const allFinished = room.players.every(p => p.finished);
    if (allFinished) {
      room.status = "finished";
      
      // Post high scores to global leaderboard if applicable
      room.players.forEach(p => {
        if (!p.isBot) {
          const entry: LeaderboardEntry = {
            nickname: p.nickname,
            wpm: p.wpm,
            accuracy: p.accuracy,
            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            track: room.track,
            difficulty: room.difficulty
          };
          globalLeaderboard.push(entry);
        }
      });
      // Sort global leaderboard descending
      globalLeaderboard.sort((a, b) => b.wpm - a.wpm);
      // Keep top 100
      globalLeaderboard = globalLeaderboard.slice(0, 50);

      io.to(roomId).emit("room:game-over", { room, leaderboard: globalLeaderboard });
      stateChanged = true;
    }

    if (stateChanged) {
      io.to(roomId).emit("room:update", room);
    }
  });
}, 1000);

// Helper to fill empty slots with Bots in a lobby
function populateBots(room: Room) {
  // Remove existing bots first to re-calc based on flag
  room.players = room.players.filter(p => !p.isBot);
  
  if (!room.useBots) return;

  const currentCount = room.players.length;
  const botCountToFill = Math.min(4, room.maxPlayers) - currentCount;

  if (botCountToFill > 0) {
    const randomizedColors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
    
    for (let i = 0; i < botCountToFill; i++) {
      const idx = Math.floor(Math.random()! * BOT_NAMES.length);
      const chosenName = `${BOT_NAMES[idx]} (AI)`;
      
      const botPlayer: Player = {
        id: `bot-${generateRoomId()}`,
        nickname: chosenName,
        carColor: randomizedColors[Math.floor(Math.random()! * randomizedColors.length)],
        carStyle: Math.floor(Math.random()! * 4),
        progress: 0,
        wpm: 0,
        accuracy: 100,
        combo: 0,
        mistakes: 0,
        typedLength: 0,
        isBot: true,
        botDifficulty: room.difficulty,
        finished: false,
        boostActive: false,
        boostCharge: 0,
        shieldActive: false,
        isFrozen: false
      };
      room.players.push(botPlayer);
    }
  }
}

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Fetch Leaderboard
  socket.on("leaderboard:get", () => {
    socket.emit("leaderboard:data", globalLeaderboard);
  });

  // Create room
  socket.on("room:create", ({ nickname, track, difficulty, useBots }: { nickname: string, track: TrackType, difficulty: DifficultyType, useBots: boolean }) => {
    const roomId = generateRoomId();
    const texts = SHORT_PRESET_TEXTS[difficulty];
    const targetText = texts[Math.floor(Math.random()! * texts.length)];

    const randomizedColors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
    const hostPlayer: Player = {
      id: socket.id,
      nickname: nickname || "Speedster",
      carColor: randomizedColors[Math.floor(Math.random()! * randomizedColors.length)],
      carStyle: 0,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      combo: 0,
      mistakes: 0,
      typedLength: 0,
      isBot: false,
      finished: false,
      boostActive: false,
      boostCharge: 0,
      shieldActive: false,
      isFrozen: false
    };

    const newRoom: Room = {
      id: roomId,
      status: "lobby",
      players: [hostPlayer],
      targetText,
      track,
      difficulty,
      countdown: 3,
      hostId: socket.id,
      maxPlayers: 5,
      useBots
    };

    if (useBots) {
      populateBots(newRoom);
    }

    rooms.set(roomId, newRoom);
    socket.join(roomId);
    socket.emit("room:created", newRoom);
    console.log(`Room created: ${roomId} by host: ${nickname}`);
  });

  // Join room
  socket.on("room:join", ({ roomId, nickname }: { roomId: string, nickname: string }) => {
    const cleanRoomId = roomId.trim().toUpperCase();
    const room = rooms.get(cleanRoomId);

    if (!room) {
      socket.emit("room:error", "Room not found or expired code!");
      return;
    }

    if (room.status !== "lobby") {
      socket.emit("room:error", "Race in this room is already under progress!");
      return;
    }

    // Exclude bots to check human limits
    const humanCount = room.players.filter(p => !p.isBot).length;
    if (humanCount >= room.maxPlayers) {
      socket.emit("room:error", "Room is fully packed with players!");
      return;
    }

    const randomizedColors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
    const guestPlayer: Player = {
      id: socket.id,
      nickname: nickname || "Player",
      carColor: randomizedColors[Math.floor(Math.random()! * randomizedColors.length)],
      carStyle: Math.floor(Math.random()! * 4),
      progress: 0,
      wpm: 0,
      accuracy: 100,
      combo: 0,
      mistakes: 0,
      typedLength: 0,
      isBot: false,
      finished: false,
      boostActive: false,
      boostCharge: 0,
      shieldActive: false,
      isFrozen: false
    };

    // Filter out bots before adding human, then bots can re-populate slots
    room.players = room.players.filter(p => !p.isBot).concat(guestPlayer);
    if (room.useBots) {
      populateBots(room);
    }

    socket.join(cleanRoomId);
    io.to(cleanRoomId).emit("room:joined", room);
    console.log(`Player ${nickname} joined room ${cleanRoomId}`);
  });

  // Configure Room settings
  socket.on("room:config", ({ roomId, track, difficulty, useBots }: { roomId: string, track: TrackType, difficulty: DifficultyType, useBots: boolean }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    room.track = track;
    room.difficulty = difficulty;
    room.useBots = useBots;

    // Fetch new text based on difficulty
    const texts = SHORT_PRESET_TEXTS[difficulty];
    room.targetText = texts[Math.floor(Math.random()! * texts.length)];

    // Refresh bots list
    populateBots(room);

    io.to(roomId).emit("room:update", room);
  });

  // Host starts the race with standard 3 seconds countdown
  socket.on("room:start", ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id || room.status !== "lobby") return;

    room.status = "countdown";
    room.countdown = 3;
    io.to(roomId).emit("room:update", room);

    const checkInterval = setInterval(() => {
      const activeRoom = rooms.get(roomId);
      if (!activeRoom || activeRoom.status !== "countdown") {
        clearInterval(checkInterval);
        return;
      }

      activeRoom.countdown--;
      
      if (activeRoom.countdown <= 0) {
        clearInterval(checkInterval);
        activeRoom.status = "racing";
        activeRoom.startTime = Date.now();
        // Reset player progress counters prior to rolling race
        activeRoom.players.forEach(p => {
          p.progress = 0;
          p.typedLength = 0;
          p.wpm = 0;
          p.combo = 0;
          p.finished = false;
          p.boostActive = false;
          p.boostCharge = 0;
          p.shieldActive = false;
          p.isFrozen = false;
        });
        io.to(roomId).emit("room:start", activeRoom);
      } else {
        io.to(roomId).emit("room:update", activeRoom);
      }
    }, 1000);
  });

  // Update Typist performance
  socket.on("player:type", ({ roomId, typedLength, mistakes, wpm, accuracy, combo }: {
    roomId: string, typedLength: number, mistakes: number, wpm: number, accuracy: number, combo: number
  }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "racing") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.finished) return;

    if (player.isFrozen) {
      // Frozen mechanics block progression
      return;
    }

    const textTotal = room.targetText.length;
    player.typedLength = Math.min(textTotal, typedLength);
    player.mistakes = mistakes;
    player.wpm = Math.max(0, wpm);
    player.accuracy = Math.min(100, Math.max(0, accuracy));
    player.combo = combo;

    // Powerup Gauge charging: Combo and keystrokes fill up boost energy!
    // Correct keys increment charge
    const recentDeltaChars = Math.max(0, player.typedLength - (player.typedLength ? player.typedLength - 1 : 0));
    player.boostCharge = Math.min(100, player.boostCharge + recentDeltaChars * 1.5 + combo * 0.1);

    // Calculate dynamic physical progress on tracks
    player.progress = Math.min(100, Math.floor((player.typedLength / textTotal) * 100));

    // Finish detection
    if (player.typedLength >= textTotal && !player.finished) {
      player.finished = true;
      player.progress = 100;
      player.finishTime = Date.now() - (room.startTime ?? Date.now());

      const finishers = room.players.filter(p => p.finished);
      player.rank = finishers.length;
    }

    io.to(roomId).emit("room:update", room);
  });

  // Activate powerup
  socket.on("player:powerup", ({ roomId, type }: { roomId: string, type: 'nitro' | 'freeze' | 'shield' }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "racing") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.finished || player.isFrozen) return;

    if (player.boostCharge < 100) {
      // Require full charge
      // Allow it anyway if testing/debugging, but standard mechanic resets it
    }
    player.boostCharge = 0; // consume

    if (type === "nitro") {
      player.boostActive = true;
      io.to(roomId).emit("powerup:activated", {
        senderId: player.id,
        senderNickname: player.nickname,
        type: "nitro"
      });
      setTimeout(() => {
        player.boostActive = false;
        io.to(roomId).emit("room:update", room);
      }, 4000); // 4 seconds nitro boost speed multiplier!
    } else if (type === "freeze") {
      // Targets the leading player (excluding the caster)
      // Sort players by progress, find first opponent that is not finished and not frozen
      const opponentToFreeze = room.players
        .filter(p => p.id !== player.id && !p.finished)
        .sort((a, b) => b.progress - a.progress)[0];

      if (opponentToFreeze) {
        if (opponentToFreeze.shieldActive) {
          opponentToFreeze.shieldActive = false; // Block!
          io.to(roomId).emit("powerup:blocked", {
            senderId: player.id,
            targetId: opponentToFreeze.id,
            type: "freeze"
          });
        } else {
          opponentToFreeze.isFrozen = true;
          opponentToFreeze.frozenUntil = Date.now() + 2000;
          io.to(roomId).emit("powerup:activated", {
            senderId: player.id,
            senderNickname: player.nickname,
            type: "freeze",
            targetId: opponentToFreeze.id
          });
          setTimeout(() => {
            opponentToFreeze.isFrozen = false;
            opponentToFreeze.frozenUntil = undefined;
            io.to(roomId).emit("room:update", room);
          }, 2000); // freeze for 2 seconds
        }
      }
    } else if (type === "shield") {
      player.shieldActive = true;
      io.to(roomId).emit("powerup:activated", {
        senderId: player.id,
        senderNickname: player.nickname,
        type: "shield"
      });
      setTimeout(() => {
        player.shieldActive = false;
        io.to(roomId).emit("room:update", room);
      }, 7000); // active for 7 seconds
    }

    io.to(roomId).emit("room:update", room);
  });

  // Handle Disconnections
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Clean rooms from disconnected player
    rooms.forEach((room, roomId) => {
      const pIndex = room.players.findIndex(p => p.id === socket.id);
      if (pIndex !== -1) {
        const removedPlayer = room.players[pIndex];
        room.players.splice(pIndex, 1);
        
        console.log(`Removing player ${removedPlayer.nickname} from room ${roomId}`);

        // Re-evaluate host
        if (room.players.length === 0 || room.players.every(p => p.isBot)) {
          // Closed room
          rooms.delete(roomId);
          console.log(`Deleting empty room: ${roomId}`);
        } else {
          if (room.hostId === socket.id) {
            // Assign next human host
            const nextHuman = room.players.find(p => !p.isBot);
            if (nextHuman) {
              room.hostId = nextHuman.id;
              console.log(`New host for room ${roomId}: ${nextHuman.nickname}`);
            } else {
              rooms.delete(roomId);
              return;
            }
          }
          
          // Re-populate bots if useBots is toggled, so room remains active
          if (room.useBots) {
            populateBots(room);
          }
          io.to(roomId).emit("room:update", room);
        }
      }
    });
  });
});

// Setup development and production serving configs
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // In dev, plug in Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the static assets immediately
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Type Racer Nitro Server is active on port ${PORT}`);
  });
}

startServer();

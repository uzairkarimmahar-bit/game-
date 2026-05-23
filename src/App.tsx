import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Player, Room, LeaderboardEntry, TrackType, DifficultyType } from "./types.js";
import { sound } from "./components/SoundManager.js";
import TrackCanvas from "./components/TrackCanvas.js";
import TypingInterface from "./components/TypingInterface.js";
import Leaderboard from "./components/Leaderboard.js";
import HelpManual from "./components/HelpManual.js";
import { 
  Trophy, Volume2, VolumeX, RefreshCw, Zap, Play, Plus, 
  CheckCircle, Users, ArrowRight, Home, Settings, AlertTriangle
} from "lucide-react";

// Initialize socket locally. Connects directly to the origin host & port.
const socket: Socket = io();

export default function App() {
  // Navigation Screens: 'main' | 'lobby' | 'racing' | 'finished'
  const [screen, setScreen] = useState<"main" | "lobby" | "racing" | "finished">("main");
  
  // Player state
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem("typer_nickname") || "";
  });
  const [roomInputId, setRoomInputId] = useState("");
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem("typer_stats");
    return saved ? JSON.parse(saved) : { racesPlayed: 0, wins: 0, avgWpm: 0, avgAccuracy: 0 };
  });

  // Active game room details
  const [room, setRoom] = useState<Room | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; type: string }>>([]);
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  // Performance update buffers
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load leaderboard on boot
  useEffect(() => {
    socket.emit("leaderboard:get");
    socket.on("leaderboard:data", (data: LeaderboardEntry[]) => {
      setLeaderboard(data);
    });

    // Handle generic socket error alerts
    socket.on("room:error", (err: string) => {
      setErrorMsg(err);
      sound.playFreeze();
    });

    // Handle successful room creations / joins
    socket.on("room:created", (newRoom: Room) => {
      setRoom(newRoom);
      setScreen("lobby");
      setErrorMsg("");
      addNotification("Room created successfully. Share code to invite opponents!", "success");
    });

    socket.on("room:joined", (updatedRoom: Room) => {
      setRoom(updatedRoom);
      setScreen("lobby");
      setErrorMsg("");
      addNotification("Connected to lobby!", "success");
    });

    socket.on("room:update", (updatedRoom: Room) => {
      setRoom(updatedRoom);
      if (updatedRoom.status === "countdown") {
        sound.playCountdown();
      }
    });

    socket.on("room:start", (startedRoom: Room) => {
      setRoom(startedRoom);
      setScreen("racing");
      setErrorMsg("");
      sound.playGo();
      addNotification("The race has started! TYPE NOW!", "info");
      
      // Start timer tick triggers
      setTimeElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    });

    // Handle powerup alerts
    socket.on("powerup:activated", (e: { senderId: string; senderNickname: string; type: string; targetId?: string }) => {
      if (e.type === "freeze") {
        addNotification(`❄️ ${e.senderNickname} cast Freeze!`, "error");
        if (e.targetId === socket.id) {
          sound.playFreeze();
        }
      } else if (e.type === "nitro") {
        addNotification(`🔥 ${e.senderNickname} activated NITRO BOOST!`, "info");
      } else if (e.type === "shield") {
        addNotification(`🛡️ ${e.senderNickname} deployed an energy shield!`, "success");
      }
    });

    socket.on("powerup:blocked", (e: { senderId: string; targetId: string; type: string }) => {
      if (e.targetId === socket.id) {
        addNotification("🛡️ Your energy shield blocked an incoming Freeze strike!", "success");
      } else {
        addNotification("🛡️ Freeze strike was blocked by target's shield!", "info");
      }
    });

    // Handle game completion
    socket.on("room:game-over", (data: { room: Room; leaderboard: LeaderboardEntry[] }) => {
      setRoom(data.room);
      setLeaderboard(data.leaderboard);
      setScreen("finished");
      sound.playVictory();
      if (timerRef.current) clearInterval(timerRef.current);

      // Save user metrics offline
      const myEndDetails = data.room.players.find(p => p.id === socket.id);
      if (myEndDetails) {
        setStats((prev: any) => {
          const nextRaces = prev.racesPlayed + 1;
          const nextWins = prev.wins + (myEndDetails.rank === 1 ? 1 : 0);
          const nextAvgWpm = Math.floor((prev.avgWpm * prev.racesPlayed + myEndDetails.wpm) / nextRaces);
          const nextAvgAcc = Math.floor((prev.avgAccuracy * prev.racesPlayed + myEndDetails.accuracy) / nextRaces);
          
          const freshStats = { racesPlayed: nextRaces, wins: nextWins, avgWpm: nextAvgWpm, avgAccuracy: nextAvgAcc };
          localStorage.setItem("typer_stats", JSON.stringify(freshStats));
          return freshStats;
        });
      }
    });

    return () => {
      socket.off("leaderboard:data");
      socket.off("room:error");
      socket.off("room:created");
      socket.off("room:joined");
      socket.off("room:update");
      socket.off("room:start");
      socket.off("room:game-over");
      socket.off("powerup:activated");
      socket.off("powerup:blocked");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Save nickname profile locally
  const handleSaveNickname = (name: string) => {
    const cleanNick = name.trim().replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 16);
    setNickname(cleanNick);
    localStorage.setItem("typer_nickname", cleanNick);
  };

  const handleCreateRoom = (track: TrackType, difficulty: DifficultyType, useBots: boolean) => {
    if (!nickname) {
      setErrorMsg("Please type in a nickname before launching typing lanes!");
      return;
    }
    setErrorMsg("");
    socket.emit("room:create", { nickname, track, difficulty, useBots });
  };

  const handleJoinRoom = () => {
    if (!nickname) {
      setErrorMsg("Please type in a nickname before connecting to race tracks!");
      return;
    }
    if (!roomInputId) {
      setErrorMsg("Please enter a valid 5-character race code!");
      return;
    }
    setErrorMsg("");
    socket.emit("room:join", { roomId: roomInputId, nickname });
  };

  const handleUpdateConfig = (track: TrackType, difficulty: DifficultyType, useBots: boolean) => {
    if (!room) return;
    socket.emit("room:config", { roomId: room.id, track, difficulty, useBots });
  };

  const handleStartRace = () => {
    if (!room) return;
    socket.emit("room:start", { roomId: room.id });
  };

  const handleUpdateProgress = (typedLength: number, mistakes: number, wpm: number, accuracy: number, combo: number) => {
    if (!room) return;
    socket.emit("player:type", { roomId: room.id, typedLength, mistakes, wpm, accuracy, combo });
  };

  const handleUsePowerup = (type: "nitro" | "freeze" | "shield") => {
    if (!room) return;
    socket.emit("player:powerup", { roomId: room.id, type });
  };

  const handleReturnToMain = () => {
    setScreen("main");
    setRoom(null);
    setRoomInputId("");
    setErrorMsg("");
  };

  const addNotification = (text: string, type = "success") => {
    const id = Math.random().toString();
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const toggleSoundMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    addNotification(muted ? "Volume muted!" : "Volume unmuted!", "info");
  };

  // Setup lobby parameters
  const isHost = room && room.hostId === socket.id;
  const currentLocalPlayer = room?.players.find(p => p.id === socket.id);

  return (
    <div className="min-h-screen bg-[#020205] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/35 relative overflow-hidden">
      {/* Dynamic Cyber star grids on background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.04),transparent_55%)] pointer-events-none"></div>

      {/* Floater Instant Notifications panel */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`px-4 py-3 rounded-xl border text-xs font-semibold shadow-2xl flex items-center justify-between pointer-events-auto animate-fade-in ${
              n.type === "success" 
                ? "bg-slate-900/90 border-emerald-500/50 text-emerald-400" 
                : n.type === "error" 
                ? "bg-slate-900/90 border-rose-500/50 text-rose-400" 
                : "bg-slate-900/90 border-cyan-500/50 text-cyan-400"
            }`}
          >
            <span>{n.text}</span>
          </div>
        ))}
      </div>

      {/* Main Top Header Cabinet */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleReturnToMain}>
            <div className="bg-gradient-to-br from-cyan-500 to-purple-600 p-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 uppercase font-sans">
                Type Racer Nitro
              </h1>
              <span className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase mt-0.5">
                Multiplayer Arcade Typist
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status profile tag */}
            {nickname && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Driver: <strong className="text-slate-100">{nickname}</strong></span>
              </div>
            )}

            {/* Audio Muter Button */}
            <button
              onClick={toggleSoundMute}
              className="p-2.5 rounded-xl border border-slate-800 hover:border-cyan-500/50 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
              title="Toggle Audio Feedback"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Error alert billboard */}
      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-3.5 flex items-center justify-center gap-2.5 text-rose-300 text-xs font-semibold animate-fade-in">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main routing area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 flex flex-col items-center justify-start gap-8 z-10">
        
        {/* ================= SCREEN DEFAULT MENU ================= */}
        {screen === "main" && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in">
            {/* Driver Profile Panel config */}
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
              <div>
                <h2 className="text-base font-black text-cyan-400 uppercase tracking-widest mb-1 font-sans">
                  🏁 Driver Profile Setup
                </h2>
                <p className="text-xs text-slate-400">
                  Configure your dashboard moniker and view historic lap speeds.
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block uppercase mb-2">Nickname</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter Speedster Name..."
                    value={nickname}
                    onChange={(e) => handleSaveNickname(e.target.value)}
                    maxLength={16}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-white font-sans focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Player stats box */}
              <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
                <h3 className="text-xs col-span-2 text-slate-400 font-bold uppercase tracking-wider mb-3">
                  Racing Statistics (Session)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Races Done</span>
                    <strong className="text-lg font-black text-purple-400">{stats.racesPlayed}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Total Victories</span>
                    <strong className="text-lg font-black text-rose-400">{stats.wins}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Average WPM</span>
                    <strong className="text-lg font-black text-cyan-400">{stats.avgWpm} WPM</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Average Accuracy</span>
                    <strong className="text-lg font-black text-emerald-400">{stats.avgAccuracy}%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Match / Join Area */}
            <div className="lg:col-span-2 flex flex-col gap-6 w-full">
              {/* Join or Create Selection cards */}
              <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8 relative overflow-hidden">
                
                {/* Section A: Create Host */}
                <div className="flex flex-col justify-between gap-5 border-r border-slate-800/80 md:pr-8">
                  <div>
                    <div className="bg-purple-500/10 border border-purple-500/30 p-2 rounded-xl w-max mb-3 text-purple-400">
                      <Plus className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-black text-purple-400 uppercase tracking-widest mb-1 font-sans">
                      Start Custom Race
                    </h3>
                    <p className="text-xs text-slate-400">
                      Instantiate a high speed typing track with bots and invite parameters.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => handleCreateRoom("cyberpunk", "medium", true)}
                      className="w-full cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold font-sans text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.35)] hover:scale-[1.02] transition-all"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      CREATE NEW LOBBY
                    </button>
                    <p className="text-[10px] text-slate-500 text-center font-semibold uppercase">
                      Bots Enabled • Medium Speed Standard
                    </p>
                  </div>
                </div>

                {/* Section B: Join existing */}
                <div className="flex flex-col justify-between gap-5">
                  <div>
                    <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-xl w-max mb-3 text-cyan-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-black text-cyan-400 uppercase tracking-widest mb-1 font-sans">
                      Join Active Race
                    </h3>
                    <p className="text-xs text-slate-400">
                      Enter the 5-character match security code to immediately board opponent lanes.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ENTER CODE (e.g. AXE71)"
                        value={roomInputId}
                        onChange={(e) => setRoomInputId(e.target.value.toUpperCase())}
                        maxLength={5}
                        className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-center text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={handleJoinRoom}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold font-sans text-xs px-5 rounded-xl border border-cyan-500/30 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        JOIN
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions pilot manual */}
              <HelpManual />
            </div>

            {/* Global Leaderboard High Scores */}
            <div className="lg:col-span-3">
              <Leaderboard entries={leaderboard} />
            </div>
          </div>
        )}

        {/* ================= SCREEN ROOM LOBBY ================= */}
        {screen === "lobby" && room && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in">
            {/* Lobby Information / Settings Card */}
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
              <div>
                <h2 className="text-base font-black text-cyan-400 uppercase tracking-widest mb-1 font-sans">
                  🚦 RACING LOBBY Setup
                </h2>
                <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-800 mt-2">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">LOBBY JOIN CODE</span>
                  <strong className="text-2xl font-mono text-cyan-400 tracking-widest font-black select-all px-2.5 py-1 bg-cyan-950/40 rounded border border-cyan-900/40">
                    {room.id}
                  </strong>
                </div>
              </div>

              {/* Host Settings config */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs text-slate-450 font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5">
                  Lobby Configurations {isHost ? " (Host Panel)" : "(Spectator Mode)"}
                </h3>

                {/* Track choice */}
                <div>
                  <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1.5 font-bold">Track Highway Theme</label>
                  <select
                    value={room.track}
                    disabled={!isHost}
                    onChange={(e) => handleUpdateConfig(e.target.value as TrackType, room.difficulty, room.useBots)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
                  >
                    <option value="city">🏙️ City Neon</option>
                    <option value="desert">🏜️ Desert Trails</option>
                    <option value="cyberpunk">🌃 Cyberpunk Matrix</option>
                    <option value="space">🌌 Space Highway</option>
                  </select>
                </div>

                {/* Difficulty options */}
                <div>
                  <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1.5 font-bold">Lobby Difficulty Mode</label>
                  <select
                    value={room.difficulty}
                    disabled={!isHost}
                    onChange={(e) => handleUpdateConfig(room.track, e.target.value as DifficultyType, room.useBots)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
                  >
                    <option value="easy">Easy (Simple sentences, ~35 WPM text)</option>
                    <option value="medium">Medium (Typist paragraphs, ~65 WPM text)</option>
                    <option value="hard">Hard (Technical code & vocabulary, ~95 WPM text)</option>
                  </select>
                </div>

                {/* Bot toggle */}
                <div className="flex items-center justify-between py-1 px-1 mt-1">
                  <div>
                    <span className="text-xs text-slate-300 font-bold block uppercase font-mono">Simulate AI Bots</span>
                    <span className="text-[10px] text-slate-500">Fill empty lanes automatically</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={room.useBots}
                    disabled={!isHost}
                    onChange={(e) => handleUpdateConfig(room.track, room.difficulty, e.target.checked)}
                    className="w-5 h-5 rounded border-rose-500 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-900 bg-slate-950 cursor-pointer accent-cyan-400 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Start Trigger CTA */}
              <div className="flex flex-col gap-2 mt-4">
                {isHost ? (
                  <button
                    onClick={handleStartRace}
                    className="w-full cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black font-sans text-xs py-3.5 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    LAUNCH RACE LOBBY
                  </button>
                ) : (
                  <div className="bg-slate-950/60 p-3.5 border border-slate-800 text-center text-xs text-slate-400 rounded-xl">
                    ⏱️ Waiting for host <strong className="text-slate-200">Start Command</strong>...
                  </div>
                )}
                <button
                  onClick={handleReturnToMain}
                  className="w-full text-slate-400 hover:text-slate-200 font-bold font-sans text-[11px] uppercase tracking-wider text-center py-2"
                >
                  Disconnect from Lobby
                </button>
              </div>
            </div>

            {/* Boarding Slots List of Players */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
              <div>
                <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 uppercase tracking-widest font-sans">
                  👥 Boarded Drivers Panel
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Active competitors preparing to join the {room.track} racetrack.
                </p>
              </div>

              {/* Connected Racers Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {room.players.map((p, idx) => {
                  const isCur = p.id === socket.id;
                  const isHostPlayer = p.id === room.hostId;
                  
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border flex items-center gap-3.5 relative overflow-hidden backdrop-blur-md transition-all ${
                        isCur 
                          ? "bg-cyan-500/5 border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.1)]" 
                          : "bg-slate-950/60 border-slate-800"
                      }`}
                    >
                      {/* Car visual micro preview bubble */}
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center p-1 shadow-inner relative"
                        style={{ backgroundColor: `${p.carColor}15`, border: `2px solid ${p.carColor}` }}
                      >
                        <Zap className="w-5 h-5" style={{ color: p.carColor }} />
                        <span className="absolute -bottom-1 -right-1 text-[8px] font-mono text-slate-400 px-1 py-0.2 rounded bg-slate-900 border border-slate-800">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 truncate">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                          {p.nickname}
                          {isCur && <span className="text-[10px] text-cyan-400 font-mono">(You)</span>}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>{p.isBot ? `Difficulty: ${p.botDifficulty}` : `Acc: ${p.accuracy}%`}</span>
                          <span>•</span>
                          <span>{isHostPlayer ? "Host" : "Competitor"}</span>
                        </div>
                      </div>

                      {/* Display a tiny crown/zap above host */}
                      {isHostPlayer && (
                        <span className="absolute top-2.5 right-2.5 text-xs text-amber-500" title="Room Host Ready">
                          👑
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= SCREEN ACTIVE TYPING RACE ================= */}
        {screen === "racing" && room && (
          <div className="w-full flex flex-col gap-6 animate-fade-in">
            {/* Countdown overlay banner for Start Countdown */}
            {room.status === "countdown" && (
              <div className="bg-gradient-to-r from-red-600 via-pink-600 to-cyan-600 text-white font-sans text-center rounded-2xl py-6 px-4 shadow-2xl relative overflow-hidden border border-pink-500/40">
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
                <div className="relative z-10">
                  <span className="text-xs font-bold tracking-widest block uppercase text-cyan-200">RACETRACK START SEQUENCE</span>
                  <div className="text-6xl font-black font-sans my-1 tracking-widest animate-pulse scale-105 duration-200">
                    {room.countdown}
                  </div>
                  <p className="text-xs text-white/80 font-semibold font-mono">
                    READY YOUR KEYBOARD FINGERS! DO NOT TYPO!
                  </p>
                </div>
              </div>
            )}

            {/* Race Dashboard Header Panel */}
            <div className="bg-slate-900 border border-slate-705 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 font-mono">
              <div className="flex items-center gap-5">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Elapsed Time</span>
                  <strong className="text-lg font-black text-cyan-400">{timeElapsed} s</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Active Track</span>
                  <strong className="text-xs font-bold text-slate-300 uppercase block mt-1">{room.track} Theme</strong>
                </div>
              </div>

              {/* Live player metrics summaries */}
              {currentLocalPlayer && (
                <div className="flex items-center gap-6 bg-slate-950 p-2 px-4 border border-slate-800 rounded-xl min-w-[200px] justify-between">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">My Rank</span>
                    <strong className="text-base font-black text-amber-400">
                      {currentLocalPlayer.finished ? `#${currentLocalPlayer.rank}` : `Laps: ${currentLocalPlayer.progress}%`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] block select-none h-max">🚩</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2D Canvas Track visualizer element */}
            <div className="w-full">
              <div className="h-full bg-slate-950 rounded-2xl border border-slate-700/80 overflow-hidden relative shadow-2xl">
                <TrackCanvas 
                  players={room.players} 
                  track={room.track} 
                  currentPlayerId={socket.id} 
                />
              </div>
            </div>

            {/* Interactive typing Cockpit controls */}
            {room.status === "racing" && (
              <TypingInterface
                targetText={room.targetText}
                isFrozen={currentLocalPlayer?.isFrozen || false}
                boostCharge={currentLocalPlayer?.boostCharge ?? 0}
                onUpdateProgress={handleUpdateProgress}
                onUsePowerup={handleUsePowerup}
                gameStatus={room.status}
              />
            )}
          </div>
        )}

        {/* ================= SCREEN RESULTS REPORT ================= */}
        {screen === "finished" && room && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in">
            {/* Match Achievements scoreboard card */}
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
              <div className="text-center py-4">
                <div className="bg-amber-500/10 border-2 border-amber-500/30 p-3 rounded-full w-max mx-auto text-amber-500 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  <Trophy className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-amber-400 uppercase tracking-widest font-sans">
                  Race Complete!
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Typing trial reports complete. Your metrics saved successfully!
                </p>
              </div>

              {/* Individual stats widget details */}
              {currentLocalPlayer && (
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col gap-3 font-mono">
                  <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>Performance Slip</span>
                    <span className="text-cyan-400">🚩 Rank #{currentLocalPlayer.rank}</span>
                  </h3>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-450 uppercase">Average Speed:</span>
                    <strong className="text-cyan-400 font-black text-sm">{currentLocalPlayer.wpm} WPM</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-450 uppercase">Typing Accuracy:</span>
                    <strong className="text-emerald-400 font-black text-sm">{currentLocalPlayer.accuracy}%</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-450 uppercase">Racetrack Time:</span>
                    <strong className="text-purple-400 font-black text-sm">
                      {currentLocalPlayer.finishTime ? (currentLocalPlayer.finishTime / 1000).toFixed(2) : "0"} s
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-450 uppercase">Mistakes Made:</span>
                    <strong className="text-rose-500 font-black text-sm">{currentLocalPlayer.mistakes}</strong>
                  </div>
                </div>
              )}

              {/* Next Steps controls CTA */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleReturnToMain}
                  className="w-full cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold font-sans text-xs py-3.5 rounded-xl border border-cyan-500/30 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5"
                >
                  <Home className="w-4 h-4" />
                  RETURN TO MAIN PAGE
                </button>
              </div>
            </div>

            {/* Room Competitor Rankings panel grid */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
              <div>
                <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 uppercase tracking-widest font-sans">
                  📋 Competitor Lap-Board
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Final placements based on standard words-per-minute speeds.
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                {room.players
                  .slice()
                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                  .map((p, index) => {
                    const isCur = p.id === socket.id;
                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between font-sans ${
                          isCur 
                            ? "bg-cyan-500/5 border-cyan-500/40 shadow-inner" 
                            : "bg-slate-950/70 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <strong className="text-sm font-black font-mono text-slate-400">
                            #{index + 1}
                          </strong>
                          {/* Colored chip indicator */}
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.carColor }}></div>
                          <span className="text-xs font-bold text-slate-100 flex items-center gap-1">
                            {p.nickname}
                            {isCur && <span className="text-[9px] text-cyan-400 font-mono font-bold">(YOU)</span>}
                          </span>
                        </div>

                        <div className="flex items-center gap-5 text-xs font-mono">
                          <div>
                            <span className="text-[9.5px] text-slate-500 block">SPEED</span>
                            <span className="text-cyan-400 font-bold">{p.wpm} WPM</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-500 block">ACCURACY</span>
                            <span className="text-emerald-400 font-bold">{p.accuracy}%</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-500 block">LAP TIME</span>
                            <span className="text-purple-450 font-bold">
                              {p.finishTime ? `${(p.finishTime / 1000).toFixed(1)}s` : "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Futuristic neon copyright footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 px-6 py-4 text-center text-[10px] text-slate-500 font-mono tracking-wider uppercase">
        © 2026 TYPE RACER NITRO • POWERED BY NODE.JS, EXPRESS & SOCKET.IO WEB SOCKET CHANNELS • ALL CHASSIS DECAL ARCS SYNCED LIVE SERVER-AUTHORITATIVE
      </footer>
    </div>
  );
}

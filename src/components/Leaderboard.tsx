import { useState } from "react";
import { LeaderboardEntry, TrackType, DifficultyType } from "../types.js";
import { Award, Search, Hash, Star, MapPin } from "lucide-react";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");

  const filteredEntries = entries.filter(e => {
    const matchesSearch = e.nickname.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTrack = trackFilter === "all" || e.track === trackFilter;
    const matchesDiff = difficultyFilter === "all" || e.difficulty === difficultyFilter;
    return matchesSearch && matchesTrack && matchesDiff;
  });

  return (
    <div className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-sans uppercase tracking-wider flex items-center gap-2">
            <Award className="w-5 h-5 text-cyan-400" /> Nitro Hall of Fame
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Global typing champions sorted by speed (WPM)
          </p>
        </div>

        {/* Filtering inputs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 w-40 bg-slate-950 border border-slate-700 rounded-lg text-xs font-sans text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Track Filter */}
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="bg-slate-910 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">🚙 All Themes</option>
            <option value="city">🌆 City Neon</option>
            <option value="desert">🏜️ Desert</option>
            <option value="cyberpunk">🌃 Cyberpunk</option>
            <option value="space">🌌 Space Highway</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="bg-slate-910 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">🎯 All Difficulties</option>
            <option value="easy">Easy (WPM 30+)</option>
            <option value="medium">Medium (WPM 60+)</option>
            <option value="hard">Hard (WPM 90+)</option>
          </select>
        </div>
      </div>

      {/* Score Grid table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-1.5 bg-slate-850 p-3 h-10 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">
          <div className="col-span-1 text-center flex items-center justify-center">
            <Hash className="w-3.5 h-3.5" />
          </div>
          <div className="col-span-4 flex items-center">Driver Nickname</div>
          <div className="col-span-2 text-center flex items-center justify-center">Speed</div>
          <div className="col-span-2 text-center flex items-center justify-center">Accuracy</div>
          <div className="col-span-1 text-center flex items-center justify-center">Track</div>
          <div className="col-span-2 text-right flex items-center justify-end">Date</div>
        </div>

        <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-800/60 font-sans text-sm">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No matching lap times found. Prepare to set the first score!
            </div>
          ) : (
            filteredEntries.map((e, idx) => {
              // Highlight top 3 beautifully
              let rankStyle = "text-slate-400";
              let cardBg = "hover:bg-slate-900/40";
              if (idx === 0) {
                rankStyle = "text-amber-400 font-black text-base drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]";
                cardBg = "bg-amber-500/5 hover:bg-amber-500/10";
              } else if (idx === 1) {
                rankStyle = "text-slate-200 font-black text-base drop-shadow-[0_0_8px_rgba(241,245,249,0.3)]";
                cardBg = "bg-slate-300/5 hover:bg-slate-300/10";
              } else if (idx === 2) {
                rankStyle = "text-amber-700 font-black text-base drop-shadow-[0_0_8px_rgba(180,83,9,0.3)]";
                cardBg = "bg-amber-700/5 hover:bg-amber-700/10";
              }

              return (
                <div key={idx} className={`grid grid-cols-12 gap-1.5 p-3 items-center ${cardBg} transition-all`}>
                  <div className={`col-span-1 text-center font-mono ${rankStyle}`}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                  </div>
                  
                  <div className="col-span-4 font-semibold text-slate-200 truncate flex items-center gap-1.5">
                    {e.nickname}
                    {idx === 0 && (
                      <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1 py-0.2 rounded font-mono uppercase font-bold tracking-widest">
                        Record
                      </span>
                    )}
                  </div>
                  
                  <div className="col-span-2 text-center font-mono font-black text-cyan-400">
                    {e.wpm} <span className="text-[10px] text-slate-500 font-semibold font-sans">WPM</span>
                  </div>
                  
                  <div className="col-span-2 text-center font-mono text-emerald-400 font-bold">
                    {e.accuracy}%
                  </div>
                  
                  <div className="col-span-1 text-center flex items-center justify-center capitalize text-[10px] font-semibold font-mono text-purple-400">
                    {e.track === "city" && "🌆"}
                    {e.track === "desert" && "🏜️"}
                    {e.track === "cyberpunk" && "🌃"}
                    {e.track === "space" && "🌌"}
                  </div>
                  
                  <div className="col-span-2 text-right text-xs text-slate-500 font-mono">
                    {e.date}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

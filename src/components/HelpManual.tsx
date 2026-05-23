import { Zap, Shield, Snowflake, Award, Sparkles, HelpCircle } from "lucide-react";

export default function HelpManual() {
  return (
    <div className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden text-slate-100">
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl"></div>
      
      <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 font-sans uppercase tracking-wider flex items-center gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-amber-400" /> Type Racer Pilot Manual
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Core Rules */}
        <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
            <Sparkles className="w-3.5 h-3.5" /> Core Concept
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">
            Type the paragraphs shown in the cockpit block securely and rapidly. Every correct keystroke accelerates your customized sports car forward in your track lane!
          </p>
          <ul className="text-[11px] text-slate-500 space-y-1 font-mono list-disc list-inside">
            <li>Correct characters increase Speed</li>
            <li>Typing errors trigger slowdowns</li>
            <li>Accumulate combos to charge Boost</li>
          </ul>
        </div>

        {/* Powerups Explained */}
        <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl md:col-span-2">
          <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
            <Zap className="w-3.5 h-3.5" /> Power-Up Arsenal (Keys 1, 2, 3)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/50 p-2.5 border border-slate-800 rounded-lg">
              <span className="text-xs font-extrabold text-red-400 flex items-center gap-1 font-mono uppercase mb-1">
                <Zap className="w-3.5 h-3.5" /> 1: NITRO
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Applies a 1.5x typing speed multiplier, surging your sports car forward on the track with glowing jet flames.
              </p>
            </div>
            
            <div className="bg-slate-900/50 p-2.5 border border-slate-800 rounded-lg">
              <span className="text-xs font-extrabold text-sky-400 flex items-center gap-1 font-mono uppercase mb-1">
                <Snowflake className="w-3.5 h-3.5" /> 2: FREEZE
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Wraps the leading opponent car in an ice block for 2.0s, temporarily locking their keyboard.
              </p>
            </div>

            <div className="bg-slate-900/50 p-2.5 border border-slate-800 rounded-lg">
              <span className="text-xs font-extrabold text-cyan-400 flex items-center gap-1 font-mono uppercase mb-1">
                <Shield className="w-3.5 h-3.5" /> 3: SHIELD
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Deploys an orbit bubble that reflects any opponent ice freeze spells. Active for 7.0 seconds.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-slate-950/80 p-3.5 rounded-xl border border-dashed border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-300">💡 Professional Tip:</span>
        <span>
          A continuous combo is the fastest way to charge your boost meter! Minimize typos to secure tactical power advantages!
        </span>
      </div>
    </div>
  );
}

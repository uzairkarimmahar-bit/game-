import React, { useState, useEffect, useRef } from "react";
import { sound } from "./SoundManager.js";
import { Zap, Shield, Snowflake } from "lucide-react";

interface TypingInterfaceProps {
  targetText: string;
  isFrozen: boolean;
  boostCharge: number;
  onUpdateProgress: (typedLength: number, mistakes: number, wpm: number, accuracy: number, combo: number) => void;
  onUsePowerup: (type: "nitro" | "freeze" | "shield") => void;
  gameStatus: string;
}

export default function TypingInterface({
  targetText,
  isFrozen,
  boostCharge,
  onUpdateProgress,
  onUsePowerup,
  gameStatus
}: TypingInterfaceProps) {
  const [inputVal, setInputVal] = useState("");
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalTyped, setTotalTyped] = useState(0);

  const startTypingTimeRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when counting down or racing starts
  useEffect(() => {
    if (gameStatus === "racing" && !isFrozen) {
      inputRef.current?.focus();
    }
  }, [gameStatus, isFrozen]);

  // Reset inputs if targetText changes
  useEffect(() => {
    setInputVal("");
    setMistakes(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setTotalTyped(0);
    startTypingTimeRef.current = null;
  }, [targetText]);

  // Calculate stats in real time
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gameStatus !== "racing" || isFrozen) return;

    sound.playClick();

    const val = e.target.value;
    
    // Lazy timer initiation
    if (startTypingTimeRef.current === null) {
      startTypingTimeRef.current = Date.now();
    }

    const targetLength = targetText.length;
    // Limit typed input to text length
    const currentTyped = val.substring(0, targetLength);
    setInputVal(currentTyped);

    // Compute metrics
    let currentCorrect = 0;
    let currentMistakes = 0;

    for (let i = 0; i < currentTyped.length; i++) {
      if (currentTyped[i] === targetText[i]) {
        currentCorrect++;
      } else {
        currentMistakes++;
      }
    }

    // Accumulating total keystrokes for accurate accuracy
    const charDelta = currentTyped.length - inputVal.length;
    if (charDelta > 0) {
      setTotalTyped(t => t + charDelta);
      // Check if last letter typed was correct
      const lastCharIndex = currentTyped.length - 1;
      if (currentTyped[lastCharIndex] === targetText[lastCharIndex]) {
        setCombo(c => {
          const nextC = c + 1;
          if (nextC > maxCombo) setMaxCombo(nextC);
          return nextC;
        });
      } else {
        setCombo(0);
        setMistakes(m => m + 1);
      }
    } else if (charDelta < 0) {
      // User pressed backspace, decay combo slightly but don't count mistakes
      setCombo(c => Math.max(0, c - 1));
    }

    setCorrectCount(currentCorrect);

    // Calculate WPM & WPM formulas matching rules
    const elapsedMs = Date.now() - (startTypingTimeRef.current ?? Date.now());
    const elapsedMinutes = Math.max(0.01, elapsedMs / 60000);
    
    // Formula WPM = (TypedCorrectChars / 5) / elapsedMinutes
    const calculatedWpm = Math.floor((currentCorrect / 5) / elapsedMinutes);

    // Accuracy = (CorrectKeystrokes / TotalAttempts) * 100
    const calculatedAccuracy = totalTyped > 0 
      ? Math.floor((currentCorrect / Math.max(currentCorrect, totalTyped)) * 100) 
      : 100;

    // Raise progress trigger back to server state
    onUpdateProgress(
      currentTyped.length,
      currentMistakes + mistakes,
      calculatedWpm,
      calculatedAccuracy,
      combo
    );
  };

  // Listen to keyboard shortcuts for power-ups
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (boostCharge < 100 || isFrozen || gameStatus !== "racing") return;
      if (e.key === "1") {
        triggerPowerup("nitro");
      } else if (e.key === "2") {
        triggerPowerup("freeze");
      } else if (e.key === "3") {
        triggerPowerup("shield");
      }
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [boostCharge, isFrozen, gameStatus]);

  const triggerPowerup = (type: "nitro" | "freeze" | "shield") => {
    if (boostCharge < 100 || isFrozen) return;

    if (type === "nitro") sound.playNitro();
    if (type === "freeze") sound.playFreeze();
    
    onUsePowerup(type);
  };

  // Rendering individual characters
  const renderTextCharacters = () => {
    return targetText.split("").map((char, index) => {
      let charClass = "text-slate-400 font-sans tracking-wide text-lg md:text-xl ";
      const isTyped = index < inputVal.length;
      const isCorrect = isTyped && inputVal[index] === targetText[index];
      const isActive = index === inputVal.length;

      if (isTyped) {
        charClass = isCorrect 
          ? "text-emerald-400 border-b border-emerald-500 font-medium " 
          : "text-rose-500 bg-rose-500/20 rounded px-0.5 border-b border-rose-500 font-bold ";
      }

      return (
        <span key={index} className={`relative inline ${charClass}`}>
          {char}
          {isActive && !isFrozen && (
            <span className="absolute left-0 bottom-0 top-0 w-[3px] bg-cyan-400 animate-pulse rounded shadow-[0_0_8px_#22d3ee]"></span>
          )}
        </span>
      );
    });
  };

  const currentWpm = startTypingTimeRef.current
    ? Math.floor((correctCount / 5) / (Math.max(100, Date.now() - startTypingTimeRef.current) / 60000))
    : 0;

  const currentAccuracy = totalTyped > 0 
    ? Math.floor((correctCount / Math.max(correctCount, totalTyped)) * 100) 
    : 100;

  return (
    <div className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      {/* Background neon meshes */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>

      {isFrozen && (
        <div className="absolute inset-0 bg-sky-950/75 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-fade-in border border-sky-400/30 rounded-2xl">
          <div className="bg-sky-500/10 border border-sky-400/50 p-4 rounded-full animate-bounce mb-3 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
            <Snowflake className="w-12 h-12 text-sky-300" />
          </div>
          <h3 className="text-xl font-bold text-sky-200 tracking-wider uppercase font-sans">
            You are Frozen!
          </h3>
          <p className="text-sm text-sky-300/80 mt-1">
            Typing temporarily paused for 2.0s
          </p>
        </div>
      )}

      {/* Speedometer panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-cyan-400 font-mono tracking-wider">
            {currentWpm} WPM
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            Real Time Speed
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-emerald-400 font-mono tracking-wider">
            {currentAccuracy}%
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            Accuracy
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-purple-400 font-mono tracking-wider">
            {combo}x
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            Combo Streak
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-amber-500 font-mono tracking-wider">
            {mistakes}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            Mistakes
          </div>
        </div>
      </div>

      {/* Target Paragraph Display Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 mb-6 min-h-[140px] flex items-center justify-start leading-relaxed text-left select-none relative shadow-inner overflow-y-auto">
        <div className="whitespace-pre-wrap break-words w-full select-none selection:bg-transparent">
          {renderTextCharacters()}
        </div>
      </div>

      {/* Input Field Form Control */}
      <div className="relative mb-6">
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={handleInput}
          disabled={gameStatus !== "racing" || isFrozen}
          className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl py-3 px-4 text-white text-lg font-sans focus:outline-none focus:border-cyan-500 shadow-inner placeholder-slate-600 disabled:opacity-40"
          placeholder={
            gameStatus === "racing"
              ? isFrozen
                ? "Frozen! Wait for thaw..."
                : "Type exactly what's written above..."
              : "Waiting for race to start..."
          }
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
        />
        <div className="absolute right-4 top-3.5 text-xs text-slate-500 font-semibold font-mono">
          {inputVal.length} / {targetText.length}
        </div>
      </div>

      {/* Power-Up Charger Hub */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Charge Meter */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1 uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 animate-pulse" /> Power-Up Meter
            </span>
            <span className="text-xs font-mono font-black text-cyan-300">
              {Math.floor(boostCharge)}%
            </span>
          </div>
          <div className="w-full h-3.5 bg-slate-950 p-[2px] rounded-full border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-350 ease-out shadow-[0_0_8px_rgba(34,211,238,0.5)] ${
                boostCharge >= 100 
                  ? "bg-gradient-to-r from-cyan-400 via-purple-500 to-amber-400 animate-pulse" 
                  : "bg-cyan-500"
              }`}
              style={{ width: `${boostCharge}%` }}
            ></div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerPowerup("nitro")}
            disabled={boostCharge < 100 || isFrozen || gameStatus !== "racing"}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white font-extrabold font-mono text-xs px-3.5 py-2.5 rounded-lg border border-red-500/30 disabled:border-transparent transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            <Zap className="w-3.5 h-3.5 text-white group-hover:scale-125 transition-transform" />
            NITRO (1)
          </button>

          <button
            onClick={() => triggerPowerup("freeze")}
            disabled={boostCharge < 100 || isFrozen || gameStatus !== "racing"}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-extrabold font-mono text-xs px-3.5 py-2.5 rounded-lg border border-sky-500/30 disabled:border-transparent transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            <Snowflake className="w-3.5 h-3.5 text-white group-hover:scale-125 transition-transform" />
            FREEZE (2)
          </button>

          <button
            onClick={() => triggerPowerup("shield")}
            disabled={boostCharge < 100 || isFrozen || gameStatus !== "racing"}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-800 text-white font-extrabold font-mono text-xs px-3.5 py-2.5 rounded-lg border border-cyan-500/30 disabled:border-transparent transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            <Shield className="w-3.5 h-3.5 text-white group-hover:scale-125 transition-transform" />
            SHIELD (3)
          </button>
        </div>
      </div>
    </div>
  );
}

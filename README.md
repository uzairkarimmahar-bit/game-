# Type Racer Nitro 🏁⚡

A complete, high-octane real-time multiplayer browser typing game. Players control stylized cartoon sports cars on neon tracks by typing paragraphs quickly and accurately. The speed, accuracy, and consecutive combo streaks of of a driver fuel their car's speed and charge the tactical Nitro boost gages!

## 🕹️ Game Elements & Mechanics

### 1. Velocity Physics & WPM Calculations
* **Words Per Minute (WPM):** calculated precisely in real-time as:
  $$\text{WPM} = \frac{\text{Correct Characters} / 5}{\text{Elapsed Minutes}}$$ (assuming 5 characters equals a standard average word).
* **Accuracy:** calculated as:
  $$\text{Accuracy (\%)} = \frac{\text{Correct Keystrokes}}{\text{Total Typed Characters}} \times 100$$
* **Combos:** consecutive typing streaks. Keystroke errors reset the combo multiplier to $0$ and apply a slight cooling slowdown penalty.

### 2. Tactical Power-Ups Arsenal
Correctly typed character inputs charge your **Power-Up Gauge** ($0\%$ to $100\%$). When the meter hits full charge ($100\%$), players can release devastating tactical effects:
* **💥 NITRO (Key `1` or Click):** Ignites rocket thrusters, applying a $1.5\times$ speed factor for 4.0 seconds, leaving glowing neon exhaust particles.
* **❄️ FREEZE (Key `2` or Click):** Targets the leading opponent (human or bot), freezing them in a solid block of ice for 2.0 seconds, locking their keyboard until they thaw.
* **🛡️ SHIELD (Key `3` or Click):** Deploys a sparkling defensive force field. Active for 7.0 seconds, it completely blocks/reflects incoming Freeze spells.

### 3. Competitor AI Simulators (Bots)
* Plays with smart computer-driven AI bots if there are not enough players in a lobby (fully togglable!).
* Bots operate on three distinct difficulty levels (Easy, Medium, and Hard).
* Bots type naturally and are capable of automatically charging and targeting players with Nitro, Shields, and Freeze spells!

### 4. Gorgeous Background Environments
Four beautifully illustrated canvas themes:
* **🌆 City Neon:** Grid lines, high-rise neon wireframes, purple/blue roads, and yellow speed stripes.
* **🏜️ Desert Trails:** Warm setting sun gradients, dust clouds, and saguaro cacti.
* **🌃 Cyberpunk Matrix:** Slime green/hot pink wireframes and scrolling digital code meshes.
* **🌌 Space Highway:** Interstellar dark purple nebula spheres, revolving planetary rings, and twinkling starfields.

---

## 🛠️ Architecture & Technologies

### Frontend:
* **React 19 + TypeScript + Vite** using rapid CSS elements styled with **Tailwind CSS**.
* **HTML5 Canvas API:** provides smooth, lightweight, lag-free linear position interpolation for driving animations ($60$ FPS canvas drawing).
* **Web Audio API Synthesizer:** synthesizes crisp arcade music and cues (keyboard clicks, countdown tones, engine roaring, freeze bursts, nitro surges) locally in the browser with zero external file load dependencies (lightweight, CORS-safe, robust).

### Backend:
* **Node.js + Express + Socket.IO:** Coordinates centralized lobbies, starting count sequences, real-time typing progress streams, power-up synchronization, and memory-persisted high score rankings.
* **Full-Stack Single Ingress Architecture:** Express and Socket.IO share the exact same web server (attached to Port `3000`), allowing secure websocket binds without hardcoding URLs.

---

## 🚀 Local Setup & Running Instructions

### 1. Install Dependencies
Make sure you have Node.js installed, then execute:
```bash
npm install
```

### 2. Run in Development Mode
Launches the full-stack server using typescript runners:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build & Run in Standalone Production Mode
Compiles the static assets and bundles the express application into a high performance CJS package, then starts it on Node.js:
```bash
npm run build
npm start
```

---

## 📁 File Structure
```text
/
├── server.ts             # Express & Socket.IO authoritative server
├── package.json          # Node scripts and dependencies
├── vite.config.ts        # Vite custom serving setup
├── tsconfig.json         # TypeScript parameters
├── metadata.json         # Dashboard metadata
├── src/
│   ├── App.tsx           # Nav-screen coordinator & sockets handler
│   ├── main.tsx          # Initial React bootstrapper
│   ├── index.css         # Styling with Tailwind setup
│   ├── types.ts          # Common strict typing interfaces
│   └── components/
│       ├── SoundManager.ts   # Synthesized sound manager (Web Audio API)
│       ├── TrackCanvas.tsx   # Canvas racetrack drawers
│       ├── TypingInterface.tsx  # Dynamic keyboard inputs and gauge triggers
│       ├── Leaderboard.tsx   # Global Hall of Fame lap score tables
│       └── HelpManual.tsx    # Pilot dashboard overview guide
```

Enjoy speed typing and drifted nitro loops on the road! 🚙💨

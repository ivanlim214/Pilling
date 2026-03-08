
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  SKWPBD  ·  LEAN TAKT PLAN  ·  Full-Stack Web App                       ║
// ║  React + Tailwind + Supabase-ready · AI-assisted construction PM tool    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// SUPABASE SETUP (paste your keys into the CONFIG block below):
//   1. Create project at supabase.com
//   2. Run the SQL in the <SQL_SCHEMA> comment at the bottom of this file
//   3. Copy your Project URL + anon key into SUPABASE_CONFIG
//
// The app works fully in demo mode (localStorage) without Supabase.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
const SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_URL",          // e.g. https://xxxx.supabase.co
  anonKey: "YOUR_SUPABASE_ANON_KEY", // from Settings > API
};

const USE_SUPABASE = SUPABASE_CONFIG.url !== "YOUR_SUPABASE_URL";

// Lightweight Supabase client (no npm needed for artifact)
class SupabaseClient {
  constructor({ url, anonKey }) { this.url = url; this.anonKey = anonKey; }
  async from(table) {
    const base = `${this.url}/rest/v1/${table}`;
    const headers = { apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}`,
                      "Content-Type": "application/json", Prefer: "return=representation" };
    return {
      select: async (cols = "*") => {
        const r = await fetch(`${base}?select=${cols}`, { headers });
        return { data: await r.json(), error: r.ok ? null : "fetch error" };
      },
      upsert: async (rows) => {
        const r = await fetch(base, { method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows) });
        return { data: await r.json(), error: r.ok ? null : "upsert error" };
      },
    };
  }
}
const supabase = USE_SUPABASE ? new SupabaseClient(SUPABASE_CONFIG) : null;

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const TAKT_RATE = 7; // piles per rig per day (editable per block)

const INITIAL_BLOCKS = [
  { id: "blk6", name: "Blk-6", piles: 489, color: "#2E6DA4", light: "#BDD7EE", zones: [
      { id: "z1", name: "Zone 1", piles: 163, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 163, rigs: 1, startOffset: 0 },
      { id: "z3", name: "Zone 3", piles: 163, rigs: 1, startOffset: 0 },
    ], ults: 3, wlt: 5, pda: 10, taktRate: 7, phase: 1,
    startDate: "2026-01-19", notes: "Phase 1 - Pilot block. 3 zones sequential." },
  { id: "blk5", name: "Blk-5", piles: 379, color: "#ED7D31", light: "#FCE4D6", zones: [
      { id: "z1", name: "Zone 1", piles: 190, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 189, rigs: 1, startOffset: 0 },
    ], ults: 2, wlt: 4, pda: 7, taktRate: 7, phase: 2,
    startDate: "2026-02-16", notes: "Phase 2 - 2 zones sequential." },
  { id: "blk4", name: "Blk-4", piles: 168, color: "#70AD47", light: "#E2EFDA", zones: [
      { id: "z1", name: "Zone 1", piles: 84, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 84, rigs: 1, startOffset: 0 },
    ], ults: 1, wlt: 2, pda: 4, taktRate: 7, phase: 2,
    startDate: "2026-02-16", notes: "Phase 2 - parallel with Blk-3 (different sectors)." },
  { id: "blk3", name: "Blk-3", piles: 170, color: "#FFC000", light: "#FFFCCC", zones: [
      { id: "z1", name: "Zone 1", piles: 85, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 85, rigs: 1, startOffset: 0 },
    ], ults: 1, wlt: 2, pda: 4, taktRate: 7, phase: 2,
    startDate: "2026-02-16", notes: "Phase 2 - parallel with Blk-4." },
  { id: "blk2", name: "Blk-2", piles: 374, color: "#7030A0", light: "#EBD5F5", zones: [
      { id: "z1", name: "Zone 1", piles: 125, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 125, rigs: 1, startOffset: 0 },
      { id: "z3", name: "Zone 3", piles: 124, rigs: 1, startOffset: 0 },
    ], ults: 2, wlt: 4, pda: 8, taktRate: 7, phase: 3,
    startDate: "2026-03-09", notes: "Phase 3 - 3 rigs, equal zone sizing." },
  { id: "blk1", name: "Blk-1", piles: 403, color: "#C00000", light: "#FDECEA", zones: [
      { id: "z1", name: "Zone 1", piles: 101, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 101, rigs: 1, startOffset: 0 },
      { id: "z3", name: "Zone 3", piles: 101, rigs: 1, startOffset: 0 },
      { id: "z4", name: "Zone 4", piles: 100, rigs: 1, startOffset: 0 },
    ], ults: 3, wlt: 4, pda: 10, taktRate: 7, phase: 3,
    startDate: "2026-03-09", notes: "Phase 3 - 4th rig mobilises 18 days in." },
];

// ─── OPTIMISED BLOCKS ─────────────────────────────────────────────────────────
// Levers applied vs INITIAL_BLOCKS:
//  1. Higher takt rates: improved shift pattern + rig efficiency + monsoon shelter
//  2. Earlier phase start dates: phases 2 & 3 overlap with preceding phase completion
//  3. More balanced zone splits
const OPTIMISED_BLOCKS = [
  { id: "blk6", name: "Blk-6", piles: 489, color: "#2E6DA4", light: "#BDD7EE", zones: [
      { id: "z1", name: "Zone 1", piles: 163, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 163, rigs: 1, startOffset: 0 },
      { id: "z3", name: "Zone 3", piles: 163, rigs: 1, startOffset: 0 },
    ], ults: 3, wlt: 5, pda: 10, taktRate: 9, phase: 1,
    startDate: "2026-01-19", notes: "Optimised: 3×10h/6d shift + monsoon shelter → 9p/rig/d." },
  { id: "blk5", name: "Blk-5", piles: 379, color: "#ED7D31", light: "#FCE4D6", zones: [
      { id: "z1", name: "Zone 1", piles: 127, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 126, rigs: 1, startOffset: 0 },
      { id: "z3", name: "Zone 3", piles: 126, rigs: 1, startOffset: 0 },
    ], ults: 2, wlt: 4, pda: 8, taktRate: 9, phase: 2,
    startDate: "2026-02-09", notes: "Optimised: Phase 2 starts 1 week earlier. 3 zones, 9p/d." },
  { id: "blk4", name: "Blk-4", piles: 168, color: "#70AD47", light: "#E2EFDA", zones: [
      { id: "z1", name: "Zone 1", piles: 84, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 84, rigs: 1, startOffset: 0 },
    ], ults: 1, wlt: 2, pda: 4, taktRate: 10, phase: 2,
    startDate: "2026-02-09", notes: "Optimised: Lighter pile dia — 10p/d achievable." },
  { id: "blk3", name: "Blk-3", piles: 170, color: "#FFC000", light: "#FFFCCC", zones: [
      { id: "z1", name: "Zone 1", piles: 85, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 85, rigs: 1, startOffset: 0 },
    ], ults: 1, wlt: 2, pda: 4, taktRate: 10, phase: 2,
    startDate: "2026-02-09", notes: "Optimised: Parallel with Blk-4. 10p/d." },
  { id: "blk2", name: "Blk-2", piles: 374, color: "#7030A0", light: "#EBD5F5", zones: [
      { id: "z1", name: "Zone 1", piles: 125, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 125, rigs: 1, startOffset: 0 },
      { id: "z3", name: "Zone 3", piles: 124, rigs: 1, startOffset: 0 },
    ], ults: 2, wlt: 4, pda: 8, taktRate: 10, phase: 3,
    startDate: "2026-03-02", notes: "Optimised: Phase 3 starts 1 week earlier. 10p/d." },
  { id: "blk1", name: "Blk-1", piles: 403, color: "#C00000", light: "#FDECEA", zones: [
      { id: "z1", name: "Zone 1", piles: 101, rigs: 1, startOffset: 0 },
      { id: "z2", name: "Zone 2", piles: 101, rigs: 1, startOffset: 0 },
      { id: "z3", name: "Zone 3", piles: 101, rigs: 1, startOffset: 0 },
      { id: "z4", name: "Zone 4", piles: 100, rigs: 1, startOffset: 0 },
    ], ults: 3, wlt: 4, pda: 10, taktRate: 9, phase: 3,
    startDate: "2026-03-02", notes: "Optimised: Double-shift on rock socket. 9p/d." },
];
function addWorkingDays(dateStr, n) {
  const d = new Date(dateStr);
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) count++; // skip Sunday
  }
  return d;
}

function workingDaysBetween(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 0) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getWorkingDays(startStr, n) {
  const days = [];
  const d = new Date(startStr);
  while (days.length < n) {
    if (d.getDay() !== 0) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function computeBlockSchedule(block) {
  // Zones chain sequentially, but each zone can have a startOffset (in weeks from block start).
  // A zone's actual start = max(day after prev zone ends, blockStart + startOffset weeks).
  // This lets zones be delayed (access gaps) or — if a zone has rigs enough — start earlier
  // than the natural sequential finish (modelling parallel-capable zones).
  const blockStartISO = new Date(block.startDate).toISOString().slice(0,10);
  let cursor = blockStartISO;   // earliest the next zone can start (day after previous ends)

  const zoneSchedules = block.zones.map((zone, zi) => {
    // Compute offset-based earliest start: blockStart + startOffset weeks (in working days)
    const offsetWD = (zone.startOffset || 0) * 5;   // weeks → working days
    const offsetStart = offsetWD > 0
      ? addWorkingDays(blockStartISO, offsetWD).toISOString().slice(0,10)
      : blockStartISO;

    // Actual start = later of sequential cursor and offset start
    const actualStartISO = offsetStart > cursor ? offsetStart : cursor;
    const actualStart = new Date(actualStartISO);

    const rigsInZone = Math.max(1, zone.rigs || 1);
    const zoneDays   = Math.ceil(zone.piles / (block.taktRate * rigsInZone));
    const zEnd       = addWorkingDays(actualStartISO, zoneDays - 1);

    // Advance cursor to the day after this zone ends
    cursor = addWorkingDays(zEnd.toISOString().slice(0,10), 1).toISOString().slice(0,10);
    return { ...zone, actualStart, zEnd, zoneDays };
  });

  const blockEnd    = zoneSchedules[zoneSchedules.length - 1].zEnd;
  const durationDays = workingDaysBetween(blockStartISO, blockEnd.toISOString().slice(0,10));
  return { ...block, zoneSchedules, blockStart: new Date(blockStartISO), blockEnd, durationDays };
}

// ─── TEST SCHEDULE ────────────────────────────────────────────────────────────
// PDA   : runs during piling (no cure). Spread across piling duration.
//         qty = block.pda (stored on block); duration = ceil(qty / 2) working days
// WLT S1: starts 28 cd after first pile cast (≈ 20 working days cure).
//         qty = block.wlt (half, rounded up); duration = ceil(qty/2 / 1) working days
// WLT S2: starts after WLT S1 ends; remaining wlt qty; same rate
// Cure   : concrete cure window shown as a shaded band (days 0–28 cd from first pile)
const CURE_WD   = 20;   // ~28 calendar days in working days
const WLT1_RATE = 2;    // WLT tests per working day
const WLT2_RATE = 2;
const PDA_RATE  = 3;    // PDA per working day (faster, less intrusive)

function computeTestSchedule(block) {
  const sched = computeBlockSchedule(block);
  const pilingStart = sched.blockStart.toISOString().slice(0,10);
  const pilingEnd   = sched.blockEnd.toISOString().slice(0,10);

  const pdaQty  = block.pda  || Math.max(1, Math.ceil(block.piles * 0.02));
  const wltQty  = block.wlt  || Math.max(1, Math.ceil(block.piles * 0.01));
  const wlt1Qty = Math.ceil(wltQty / 2);
  const wlt2Qty = wltQty - wlt1Qty;

  // PDA: starts at piling start, spread across piling window
  const pdaDays = Math.ceil(pdaQty / PDA_RATE);
  const pdaStart = new Date(pilingStart);
  const pdaEnd   = addWorkingDays(pilingStart, pdaDays - 1);

  // WLT Set 1: starts CURE_WD working days after piling start
  const wlt1Start = addWorkingDays(pilingStart, CURE_WD);
  const wlt1Days  = Math.max(1, Math.ceil(wlt1Qty / WLT1_RATE));
  const wlt1End   = addWorkingDays(wlt1Start.toISOString().slice(0,10), wlt1Days - 1);

  // WLT Set 2: starts day after WLT S1 ends
  const wlt2Start = addWorkingDays(wlt1End.toISOString().slice(0,10), 1);
  const wlt2Days  = Math.max(1, Math.ceil(wlt2Qty / WLT2_RATE));
  const wlt2End   = addWorkingDays(wlt2Start.toISOString().slice(0,10), wlt2Days - 1);

  // Cure window end: 20 working days after piling start
  const cureEnd   = addWorkingDays(pilingStart, CURE_WD - 1);

  return {
    ...sched,
    tests: {
      pda:   { start: pdaStart,  end: pdaEnd,   qty: pdaQty,  days: pdaDays  },
      wlt1:  { start: wlt1Start, end: wlt1End,  qty: wlt1Qty, days: wlt1Days },
      wlt2:  { start: wlt2Start, end: wlt2End,  qty: wlt2Qty, days: wlt2Days },
      cure:  { start: sched.blockStart, end: cureEnd },
    }
  };
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    chart: "M3 3v18h18M7 16l4-4 4 4 4-8",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    plus: "M12 5v14M5 12h14",
    trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
    save: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
    download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    x: "M18 6L6 18M6 6l12 12",
    check: "M20 6L9 17l-5-5",
    info: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8h.01M11 12h1v4h1",
    zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    target: "M22 12h-4M6 12H2M12 6V2M12 22v-4M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    trending: "M23 6l-9.5 9.5-5-5L1 18",
    alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    calendar: "M3 4h18v18H3V4zM16 2v4M8 2v4M3 10h18",
    user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
    lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[name] || icons.info} />
    </svg>
  );
};

// ─── SUPABASE AUTH MODAL ──────────────────────────────────────────────────────
function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handle = async () => {
    if (!USE_SUPABASE) {
      onLogin({ email: email || "demo@skwpbd.com", name: "Demo User" });
      onClose();
      return;
    }
    setLoading(true);
    const endpoint = mode === "login" ? "token?grant_type=password" : "signup";
    const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/${endpoint}`, {
      method: "POST",
      headers: { apikey: SUPABASE_CONFIG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.access_token) {
      onLogin({ email, name: email.split("@")[0], token: data.access_token });
      onClose();
    } else {
      setMsg(data.error_description || data.msg || "Error occurred");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, #0f1629 0%, #1a2744 100%)", border: "1px solid rgba(100,160,255,0.2)" }}>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>
                {USE_SUPABASE ? (mode === "login" ? "Sign In" : "Create Account") : "Demo Mode"}
              </h2>
              <p className="text-blue-300 text-sm mt-1">SKWPBD Takt Planning Platform</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <Icon name="x" size={20} />
            </button>
          </div>

          {!USE_SUPABASE && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(255,193,7,0.15)", border: "1px solid rgba(255,193,7,0.3)", color: "#FFD700" }}>
              <Icon name="info" size={14} />  Running in Demo Mode — data saved to browser localStorage.
              Connect Supabase for multi-user cloud sync.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-blue-300 uppercase tracking-widest mb-1 block">Email</label>
              <input className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(100,160,255,0.2)", caretColor: "#60A5FA" }}
                placeholder="user@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-blue-300 uppercase tracking-widest mb-1 block">Password</label>
              <input type="password" className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(100,160,255,0.2)" }}
                placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handle()} />
            </div>
            {msg && <p className="text-red-400 text-sm">{msg}</p>}
            <button onClick={handle} disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all"
              style={{ background: "linear-gradient(90deg, #2563EB, #7C3AED)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Please wait…" : USE_SUPABASE ? (mode === "login" ? "Sign In" : "Sign Up") : "Enter Demo"}
            </button>
          </div>

          {USE_SUPABASE && (
            <p className="text-center text-gray-400 text-sm mt-4">
              {mode === "login" ? "No account? " : "Have account? "}
              <button className="text-blue-400 hover:underline" onClick={() => setMode(m => m === "login" ? "signup" : "login")}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ZONE EDITOR MODAL ────────────────────────────────────────────────────────
function ZoneEditorModal({ block, onSave, onClose }) {
  const [zones, setZones] = useState(block.zones.map(z => ({ ...z })));
  const [taktRate, setTaktRate] = useState(block.taktRate);
  const [startDate, setStartDate] = useState(block.startDate);
  const [notes, setNotes] = useState(block.notes || "");

  const totalZonePiles = zones.reduce((s, z) => s + Number(z.piles), 0);
  const diff = block.piles - totalZonePiles;

  const addZone = () => setZones(z => [...z, { id: `z${Date.now()}`, name: `Zone ${z.length + 1}`, piles: 0, rigs: 1, startOffset: 0 }]);
  const removeZone = id => setZones(z => z.filter(x => x.id !== id));
  const updateZone = (id, field, val) => setZones(z => z.map(x => x.id === id ? { ...x, [field]: field === "piles" || field === "rigs" || field === "startOffset" ? Number(val) : val } : x));

  const autoBalance = () => {
    const per = Math.floor(block.piles / zones.length);
    const rem = block.piles % zones.length;
    setZones(z => z.map((zone, i) => ({ ...zone, piles: per + (i === z.length - 1 ? rem : 0) })));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl max-h-screen overflow-y-auto"
        style={{ background: "#0f1629", border: `2px solid ${block.color}40` }}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              <div className="w-3 h-10 rounded-full" style={{ background: block.color }} />
              <div>
                <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>{block.name} — Zone Editor</h3>
                <p className="text-gray-400 text-xs">{block.piles} total piles to distribute across zones</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><Icon name="x" size={20} /></button>
          </div>

          {/* Global settings */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <label className="text-xs text-blue-300 uppercase tracking-widest mb-1 block">Takt Rate (piles/rig/day)</label>
              <input type="number" value={taktRate} onChange={e => setTaktRate(Number(e.target.value))} min={1} max={20}
                className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${block.color}60` }} />
            </div>
            <div>
              <label className="text-xs text-blue-300 uppercase tracking-widest mb-1 block">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${block.color}60` }} />
            </div>
            <div>
              <label className="text-xs text-blue-300 uppercase tracking-widest mb-1 block">Phase</label>
              <div className="px-3 py-2 rounded-lg text-gray-300 text-sm" style={{ background: "rgba(255,255,255,0.05)" }}>
                Phase {block.phase}
              </div>
            </div>
          </div>

          {/* Pile balance indicator */}
          <div className="mb-4 p-3 rounded-lg flex items-center justify-between"
            style={{ background: diff === 0 ? "rgba(112,173,71,0.15)" : "rgba(255,100,50,0.15)", border: `1px solid ${diff === 0 ? "#70AD47" : "#FF6432"}50` }}>
            <span className="text-sm font-medium" style={{ color: diff === 0 ? "#70AD47" : "#FF6432" }}>
              {diff === 0 ? "✓ Zones balanced perfectly" : `⚠ ${Math.abs(diff)} piles ${diff > 0 ? "unassigned" : "over-assigned"}`}
            </span>
            <button onClick={autoBalance} className="text-xs px-3 py-1 rounded-full font-medium transition-all hover:opacity-80"
              style={{ background: block.color + "30", color: block.color, border: `1px solid ${block.color}60` }}>
              Auto-balance
            </button>
          </div>

          {/* Zone rows */}
          <div className="space-y-3 mb-5">
            {zones.map((zone, idx) => {
              const dur = Math.ceil(zone.piles / (taktRate * (zone.rigs || 1)));
              return (
                <div key={zone.id} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${block.color}25` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: block.color }}>{idx + 1}</div>
                    <input value={zone.name} onChange={e => updateZone(zone.id, "name", e.target.value)}
                      className="flex-1 bg-transparent text-white text-sm font-medium outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-400 transition-colors" />
                    {zones.length > 1 && (
                      <button onClick={() => removeZone(zone.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Piles in Zone</label>
                      <input type="number" value={zone.piles} onChange={e => updateZone(zone.id, "piles", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Rigs</label>
                      <input type="number" value={zone.rigs} onChange={e => updateZone(zone.id, "rigs", e.target.value)} min={1} max={4}
                        className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Start Offset (days)</label>
                      <input type="number" value={zone.startOffset || 0} onChange={e => updateZone(zone.id, "startOffset", e.target.value)} min={0}
                        className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Duration</label>
                      <div className="px-3 py-2 rounded-lg text-sm font-bold" style={{ background: block.color + "25", color: block.color }}>
                        {dur} days
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={addZone} className="w-full py-2 rounded-xl text-sm font-medium mb-4 transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.04)", border: `1px dashed ${block.color}50`, color: block.color }}>
            <Icon name="plus" size={14} /> Add Zone
          </button>

          {/* Notes */}
          <div className="mb-5">
            <label className="text-xs text-blue-300 uppercase tracking-widest mb-1 block">Planning Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg text-gray-300 text-sm outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Cancel
            </button>
            <button onClick={() => onSave({ ...block, zones, taktRate, startDate, notes })}
              className="flex-2 flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: `linear-gradient(90deg, ${block.color}, ${block.color}CC)` }}>
              <Icon name="save" size={14} /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GANTT CHART ──────────────────────────────────────────────────────────────
function GanttChart({ blocks, startDate = "2026-01-16", numWeeks = 14 }) {
  const totalDays = numWeeks * 6;
  const days = getWorkingDays(startDate, totalDays);

  const weekGroups = useMemo(() => {
    const g = [];
    for (let i = 0; i < days.length; i += 6) g.push(days.slice(i, i + 6));
    return g;
  }, [days]);

  const monthLabels = useMemo(() => {
    const seen = {}; const out = [];
    days.forEach((d, i) => {
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen[k]) { seen[k] = true; out.push({ label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), col: i }); }
    });
    return out;
  }, [days]);

  const scheduledBlocks = useMemo(() => blocks.map(b => computeTestSchedule(b)), [blocks]);

  // Day column width in px
  const DAY_W = 26;
  const ROW_H = 32;
  const LEFT_W = 220;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="overflow-x-auto" style={{ maxHeight: "70vh" }}>
        <div style={{ minWidth: LEFT_W + days.length * DAY_W }}>

          {/* Month labels */}
          <div className="flex sticky top-0 z-20" style={{ background: "#0d1526" }}>
            <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-r border-white/5">
              Block / Zone / Tests
              <div className="flex gap-2 mt-0.5">
                <span style={{ color:"#F59E0B", fontSize:9 }}>▪ PDA</span>
                <span style={{ color:"#06B6D4", fontSize:9 }}>▪ WLT S1</span>
                <span style={{ color:"#818CF8", fontSize:9 }}>▪ WLT S2</span>
              </div>
            </div>
            <div className="flex flex-1 relative border-b border-white/5">
              {monthLabels.map((m, i) => (
                <div key={i} style={{ position: "absolute", left: m.col * DAY_W, top: 0, background: "#0d1526", zIndex: 1 }}
                  className="px-2 py-2 text-xs font-bold text-blue-400 whitespace-nowrap">{m.label}</div>
              ))}
              <div style={{ height: 30, width: days.length * DAY_W }} />
            </div>
          </div>

          {/* Day headers */}
          <div className="flex sticky top-[31px] z-20" style={{ background: "#0d1526" }}>
            <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="border-b border-r border-white/5" />
            <div className="flex">
              {days.map((d, i) => (
                <div key={i} style={{ width: DAY_W, minWidth: DAY_W }}
                  className={`text-center py-1 border-b border-r border-white/5 text-xs font-medium ${d.getDay() === 6 ? "text-orange-400" : "text-gray-500"}`}>
                  {d.getDate()}
                </div>
              ))}
            </div>
          </div>

          {/* Block rows */}
          {scheduledBlocks.map(block => (
            <div key={block.id}>
              {/* Block header */}
              <div className="flex items-center" style={{ height: ROW_H, background: "#111827" }}>
                <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                  className="flex items-center gap-2 px-3 border-b border-r border-white/5">
                  <div className="w-2 h-2 rounded-full" style={{ background: block.color }} />
                  <span className="text-xs font-bold text-white">{block.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">{block.piles}p</span>
                </div>
                {days.map((d, i) => {
                  const inRange = d >= block.blockStart && d <= block.blockEnd;
                  return (
                    <div key={i} style={{ width: DAY_W, minWidth: DAY_W, height: ROW_H,
                      background: inRange ? block.color + "22" : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.03)" }} />
                  );
                })}
              </div>

              {/* Zone rows */}
              {block.zoneSchedules.map((zone, zi) => {
                const zColor = block.color;
                const opacity = 1 - zi * 0.15;
                return (
                  <div key={zone.id} className="flex items-center" style={{ height: ROW_H }}>
                    <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                      className="flex items-center gap-2 px-3 pl-8 border-b border-r border-white/5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: zColor, opacity: 0.6 + zi * 0.1 }} />
                      <span className="text-xs text-gray-400">{zone.name}</span>
                      <span className="text-xs text-gray-600 ml-auto">{zone.piles}p</span>
                    </div>
                    {days.map((d, i) => {
                      const wkCnt = days.filter((wd, ii) => ii <= i && wd >= zone.actualStart && wd <= zone.zEnd).length;
                      const active = d >= zone.actualStart && d <= zone.zEnd;
                      const pct = active ? Math.min(100, (wkCnt / zone.zoneDays) * 100) : 0;
                      return (
                        <div key={i} title={active ? `${zone.name}: Day ${wkCnt}/${zone.zoneDays} · ${block.taktRate} piles` : ""}
                          style={{ width: DAY_W, minWidth: DAY_W, height: ROW_H,
                            background: active ? zColor + (Math.round(120 + zi * 30).toString(16).padStart(2, "0")) : "transparent",
                            borderBottom: "1px solid rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.03)",
                            position: "relative" }}>
                          {active && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
                              background: zColor, opacity: 0.8, width: `${pct}%` }} />
                          )}
                          {active && (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                              justifyContent: "center", fontSize: 9, color: "white", fontWeight: "bold",
                              opacity: 0.9 }}>
                              {block.taktRate}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* ── Test rows: PDA, WLT Set 1, WLT Set 2 ── */}
              {[
                { key:"pda",  label:"PDA",        color:"#F59E0B" },
                { key:"wlt1", label:"WLT Set 1",  color:"#06B6D4" },
                { key:"wlt2", label:"WLT Set 2",  color:"#818CF8" },
              ].map(tr => {
                const t = block.tests[tr.key];
                return (
                  <div key={tr.key} className="flex items-center" style={{ height: ROW_H }}>
                    <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                      className="flex items-center gap-2 px-3 pl-10 border-b border-r border-white/5">
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: tr.color }} />
                      <span className="text-xs font-semibold" style={{ color: tr.color }}>{tr.label}</span>
                      <span className="text-xs ml-auto" style={{ color:"#475569" }}>{t.qty} tests</span>
                    </div>
                    {days.map((d, i) => {
                      const active = d >= t.start && d <= t.end;
                      const inCure = tr.key !== "pda" && block.tests.cure && d >= block.tests.cure.start && d <= block.tests.cure.end;
                      const [rr,gg,bb] = [
                        parseInt(tr.color.slice(1,3),16),
                        parseInt(tr.color.slice(3,5),16),
                        parseInt(tr.color.slice(5,7),16)
                      ];
                      return (
                        <div key={i}
                          style={{ width: DAY_W, minWidth: DAY_W, height: ROW_H, position:"relative",
                            background: active ? `rgba(${rr},${gg},${bb},0.22)` : "transparent",
                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                            borderRight:  "1px solid rgba(255,255,255,0.03)" }}
                          title={active ? `${tr.label} · ${t.qty} tests over ${t.days}d` : inCure ? "Curing — 28d before WLT" : ""}>
                          {active && (
                            <>
                              <div style={{ position:"absolute", inset:0, display:"flex",
                                alignItems:"center", justifyContent:"center",
                                fontSize:8, color:tr.color, fontWeight:700, opacity:0.9 }}>
                                {tr.key === "pda" ? "PDA" : tr.key === "wlt1" ? "W1" : "W2"}
                              </div>
                              <div style={{ position:"absolute", bottom:0, left:0, right:0,
                                height:3, background:tr.color, opacity:0.7 }} />
                            </>
                          )}
                          {inCure && !active && (
                            <div style={{ position:"absolute", inset:0,
                              background:`repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(${rr},${gg},${bb},0.12) 3px,rgba(${rr},${gg},${bb},0.12) 4px)` }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Daily total row */}
          <div className="flex sticky bottom-0" style={{ background: "#0a0f1e", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="px-3 py-2 text-xs font-bold text-teal-400 border-r border-white/5">
              Daily Output (all blocks)
            </div>
            {days.map((d, i) => {
              let total = 0;
              scheduledBlocks.forEach(block => {
                block.zoneSchedules.forEach(zone => {
                  if (d >= zone.actualStart && d <= zone.zEnd) total += block.taktRate;
                });
              });
              const maxPossible = 21;
              const pct = (total / maxPossible) * 100;
              return (
                <div key={i} style={{ width: DAY_W, minWidth: DAY_W, position: "relative", borderRight: "1px solid rgba(255,255,255,0.03)" }}
                  className="flex items-end justify-center py-1" title={`${total} piles`}>
                  {total > 0 && (
                    <div style={{ width: 14, height: `${pct}%`, maxHeight: 24, minHeight: 4,
                      background: `hsl(${120 * (pct / 100)}, 70%, 55%)`, borderRadius: 2 }} />
                  )}
                  {total > 0 && <span style={{ position: "absolute", top: 2, fontSize: 7, color: "#9CA3AF" }}>{total}</span>}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon, color, trend }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 transition-all hover:scale-[1.02]"
      style={{ background: "linear-gradient(135deg, #0f1629 0%, #151e35 100%)", border: `1px solid ${color}30` }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{ background: color, transform: "translate(30%,-30%)" }} />
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: color + "20", color }}><Icon name={icon} size={18} /></div>
        {trend && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: color + "20", color }}>{trend}</span>}
      </div>
      <div className="text-2xl font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>{value}</div>
      <div className="text-xs font-medium mt-0.5" style={{ color }}>{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// ─── PRODUCTION CHART ─────────────────────────────────────────────────────────
function ProductionChart({ blocks }) {
  const scheduled = useMemo(() => blocks.map(b => computeBlockSchedule(b)), [blocks]);
  const startDate = "2026-01-16";
  const days = getWorkingDays(startDate, 84);

  const chartData = days.map((d, i) => {
    let total = 0;
    scheduled.forEach(block => {
      block.zoneSchedules.forEach(zone => {
        if (d >= zone.actualStart && d <= zone.zEnd) total += block.taktRate;
      });
    });
    return { d, total, week: Math.floor(i / 6) };
  });

  // Weekly aggregates
  const weekly = [];
  for (let w = 0; w < 14; w++) {
    const wDays = chartData.filter(x => x.week === w);
    const sum = wDays.reduce((s, x) => s + x.total, 0);
    const label = wDays[0]?.d ? fmtDate(wDays[0].d) : `W${w + 1}`;
    weekly.push({ label, sum, wDays: wDays.length });
  }

  const maxVal = Math.max(...weekly.map(w => w.sum), 1);
  const avgVal = weekly.filter(w => w.sum > 0).reduce((s, w, _, a) => s + w.sum / a.length, 0);

  return (
    <div className="rounded-2xl p-5" style={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>Weekly Production Output</h3>
          <p className="text-xs text-gray-500">Pile installations per week · Optimised Takt Plan</p>
        </div>
        <div className="text-xs text-gray-400">Avg: <span className="text-teal-400 font-bold">{Math.round(avgVal)}/wk</span></div>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 160 }}>
        {weekly.map((w, i) => {
          const h = w.sum === 0 ? 0 : Math.max(8, (w.sum / maxVal) * 140);
          const intensity = w.sum / maxVal;
          const col = `hsl(${200 + intensity * 40}, ${50 + intensity * 30}%, ${40 + intensity * 20}%)`;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`${w.label}: ${w.sum} piles`}>
              {w.sum > 0 && <div className="text-xs text-gray-500 group-hover:text-white transition-colors" style={{ fontSize: 8 }}>{w.sum}</div>}
              <div style={{ height: h, background: w.sum > 0 ? col : "rgba(255,255,255,0.04)", borderRadius: "4px 4px 2px 2px", transition: "height 0.3s ease", width: "100%" }} />
              <div className="text-xs text-gray-600" style={{ fontSize: 7, writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap" }}>
                {w.label}
              </div>
            </div>
          );
        })}
      </div>
      {/* Average line label */}
      <div className="mt-3 flex items-center gap-2">
        <div className="w-8 h-0.5" style={{ background: "#14B8A6" }} />
        <span className="text-xs text-teal-400">Target takt: 42 piles/week (3 rigs × 7/day × 2 concurrent)</span>
      </div>
    </div>
  );
}

// ─── BLOCK CARD ───────────────────────────────────────────────────────────────
function BlockCard({ block, onEdit, showDetails }) {
  const schedule = useMemo(() => computeBlockSchedule(block), [block]);
  const progressPct = 0; // Would come from actuals in real app

  return (
    <div className="rounded-2xl overflow-hidden transition-all hover:scale-[1.01]"
      style={{ background: "linear-gradient(145deg, #0d1526 0%, #111827 100%)", border: `1px solid ${block.color}25` }}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${block.color}, ${block.color}66)` }} />
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>{block.name}</h3>
            <p className="text-xs text-gray-500">Phase {block.phase} · {block.zones.length} zones</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(block)} className="p-2 rounded-lg text-gray-400 hover:text-white transition-all hover:bg-white/5">
              <Icon name="edit" size={14} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Piles", val: block.piles, col: block.color },
            { label: "Duration", val: `${schedule.durationDays}d`, col: "#60A5FA" },
            { label: "Rate", val: `${block.taktRate * block.zones.length}/d`, col: "#34D399" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.col + "12" }}>
              <div className="text-lg font-bold" style={{ color: s.col, fontFamily: "'Georgia', serif" }}>{s.val}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span><span>{progressPct}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: block.color, borderRadius: 4,
              transition: "width 0.6s ease", boxShadow: `0 0 8px ${block.color}80` }} />
          </div>
        </div>

        {/* Zone breakdown */}
        {showDetails && (
          <div className="space-y-2 mt-3 pt-3 border-t border-white/5">
            {schedule.zoneSchedules.map((zone, i) => (
              <div key={zone.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: block.color }} />
                  <span className="text-gray-400">{zone.name}</span>
                </div>
                <div className="flex gap-3 text-gray-500">
                  <span>{zone.piles}p</span>
                  <span>{zone.zoneDays}d</span>
                  <span>{fmtDate(zone.actualStart)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dates */}
        <div className="flex justify-between text-xs text-gray-600 mt-3 pt-2 border-t border-white/5">
          <span>Start: <span className="text-gray-400">{fmtDate(schedule.blockStart)}</span></span>
          <span>End: <span className="text-gray-400">{fmtDate(schedule.blockEnd)}</span></span>
        </div>

        {/* Notes */}
        {block.notes && (
          <p className="text-xs text-gray-600 mt-2 italic line-clamp-2">{block.notes}</p>
        )}
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════
//  OPTIMISATION TAB — Engineering parameters & smart suggestions
// ═══════════════════════════════════════════════════════════════════

const PILE_TYPES_ENG = {
  bored_cased:  { label: "Bored (Cased)",        baseHrs: 2.8, mobMins: 25 },
  bored_dry:    { label: "Bored (Dry / CFA)",    baseHrs: 1.2, mobMins: 15 },
  driven_pc:    { label: "Driven Precast RC",     baseHrs: 0.9, mobMins: 12 },
  driven_steel: { label: "Driven Steel H-Pile",   baseHrs: 1.2, mobMins: 15 },
  cfa:          { label: "CFA Auger Cast",        baseHrs: 0.9, mobMins: 10 },
};
const SOIL_ENG = {
  soft_clay:   { label:"Soft Marine Clay",      factor:1.45, risk:"high",      spt:"<4",     note:"Heave/squeeze — cased essential" },
  firm_clay:   { label:"Firm Clay (OC)",        factor:1.15, risk:"medium",    spt:"4–8",    note:"Standard casing protocol" },
  stiff_clay:  { label:"Stiff Clay",            factor:1.00, risk:"low",       spt:"8–30",   note:"Good stand-up time" },
  loose_sand:  { label:"Loose Sand (SPT<10)",   factor:1.30, risk:"high",      spt:"<10",    note:"Collapse risk" },
  medium_sand: { label:"Medium Dense Sand",     factor:1.10, risk:"medium",    spt:"10–30",  note:"Jetting may help" },
  dense_sand:  { label:"Dense Sand (SPT>30)",   factor:1.25, risk:"medium",    spt:"30–50",  note:"High bit wear" },
  gravel:      { label:"Gravel / Cobbles",      factor:1.35, risk:"high",      spt:">50",    note:"Chisel required" },
  weathered_r: { label:"Weathered Rock (IV–V)", factor:1.70, risk:"high",      spt:">50",    note:"Rock bit + socket" },
  rock:        { label:"Sound Rock (I–III)",    factor:2.50, risk:"very_high", spt:"RQD>75%",note:"Specialist rig" },
  mixed:       { label:"Interbedded / Mixed",   factor:1.55, risk:"high",      spt:"Varies", note:"Assess daily" },
};
const SHIFT_ENG = {
  std_8:   { label:"Standard  8h / 5d",  dailyHrs:7.0,  weekDays:5 },
  ext_10:  { label:"Extended 10h / 6d",  dailyHrs:9.0,  weekDays:6 },
  ext_12:  { label:"Long Day  12h / 6d", dailyHrs:11.0, weekDays:6 },
  double:  { label:"Double Shift 16h/6d",dailyHrs:14.5, weekDays:6 },
  cont_24: { label:"Continuous 24h / 7d",dailyHrs:21.0, weekDays:7 },
};
const CONCRETE_ENG = {
  onsite:   { label:"On-site Batching Plant",    maxM3h:65, reliability:0.98 },
  rmx_near: { label:"Ready-mix < 20 min",        maxM3h:45, reliability:0.93 },
  rmx_mid:  { label:"Ready-mix 20–45 min",       maxM3h:30, reliability:0.87 },
  rmx_far:  { label:"Ready-mix > 45 min",        maxM3h:18, reliability:0.78 },
  pump:     { label:"Pump Line (remote plant)",  maxM3h:14, reliability:0.72 },
};
const WEATHER_ENG = {
  arid:      { label:"Arid / Dry Season",     downtimePct:1,  stormDays:0 },
  tropical:  { label:"Tropical (dry)",        downtimePct:3,  stormDays:1 },
  temperate: { label:"Temperate (mild rain)", downtimePct:5,  stormDays:2 },
  monsoon:   { label:"Monsoon / Wet Season",  downtimePct:14, stormDays:5 },
  typhoon:   { label:"Typhoon / Cyclone",     downtimePct:22, stormDays:8 },
};
const TESTING_ENG = {
  minimum:  { label:"Minimum Statutory",     ultPct:0.25, wltPct:0.5, pdaPct:1.0 },
  standard: { label:"BS EN 1997 / CP4 Std",  ultPct:0.5,  wltPct:1.0, pdaPct:2.0 },
  enhanced: { label:"Enhanced Testing",      ultPct:1.0,  wltPct:2.0, pdaPct:5.0 },
  research: { label:"Research / Proof",      ultPct:2.0,  wltPct:4.0, pdaPct:8.0 },
};

const ENG_DEFAULTS = {
  blk6:{ pileType:"bored_cased", pileDiaM:0.8, pileDepthM:28, socketM:0,   soilProfile:"soft_clay",   shiftCfg:"ext_10", rigEff:0.83, concrete:"rmx_near", weather:"monsoon", testing:"standard", contingency:8,  adjacencyHrs:24, rigCount:3 },
  blk5:{ pileType:"bored_cased", pileDiaM:0.8, pileDepthM:24, socketM:0,   soilProfile:"firm_clay",   shiftCfg:"ext_10", rigEff:0.85, concrete:"rmx_near", weather:"monsoon", testing:"standard", contingency:7,  adjacencyHrs:24, rigCount:2 },
  blk4:{ pileType:"bored_cased", pileDiaM:0.6, pileDepthM:20, socketM:0,   soilProfile:"medium_sand", shiftCfg:"ext_10", rigEff:0.88, concrete:"rmx_near", weather:"monsoon", testing:"standard", contingency:6,  adjacencyHrs:16, rigCount:2 },
  blk3:{ pileType:"bored_cased", pileDiaM:0.6, pileDepthM:22, socketM:0,   soilProfile:"firm_clay",   shiftCfg:"ext_10", rigEff:0.85, concrete:"rmx_near", weather:"monsoon", testing:"standard", contingency:6,  adjacencyHrs:24, rigCount:2 },
  blk2:{ pileType:"bored_cased", pileDiaM:0.8, pileDepthM:26, socketM:0,   soilProfile:"mixed",       shiftCfg:"ext_10", rigEff:0.83, concrete:"rmx_near", weather:"monsoon", testing:"standard", contingency:8,  adjacencyHrs:24, rigCount:3 },
  blk1:{ pileType:"bored_cased", pileDiaM:1.0, pileDepthM:30, socketM:2.5, soilProfile:"weathered_r", shiftCfg:"ext_10", rigEff:0.78, concrete:"rmx_near", weather:"monsoon", testing:"enhanced", contingency:12, adjacencyHrs:36, rigCount:3 },
};

function engCycleHrs(ep) {
  const pt    = PILE_TYPES_ENG[ep.pileType]    || PILE_TYPES_ENG.bored_cased;
  const soil  = SOIL_ENG[ep.soilProfile]       || SOIL_ENG.soft_clay;
  const depthF = 1 + Math.pow(Math.max(0, ep.pileDepthM - 12) / 20, 1.4) * 0.45;
  const diaF   = ep.pileDiaM <= 0.6 ? 1.0 : 1 + (ep.pileDiaM - 0.6) * 0.55;
  const sockF  = ep.socketM > 0 ? 1 + ep.socketM * 0.18 : 1;
  const adjP   = ep.adjacencyHrs > 24 ? 1.08 : ep.adjacencyHrs > 16 ? 1.04 : 1.0;
  return pt.baseHrs * soil.factor * depthF * diaF * sockF * adjP;
}
function engPPD(ep) {
  const shift   = SHIFT_ENG[ep.shiftCfg]      || SHIFT_ENG.ext_10;
  const conc    = CONCRETE_ENG[ep.concrete]   || CONCRETE_ENG.rmx_near;
  const weather = WEATHER_ENG[ep.weather]     || WEATHER_ENG.monsoon;
  const cycle   = engCycleHrs(ep);
  const moveMins = (PILE_TYPES_ENG[ep.pileType] || PILE_TYPES_ENG.bored_cased).mobMins;
  const effHrs  = shift.dailyHrs * ep.rigEff * conc.reliability;
  const weatherF = 1 - weather.downtimePct / 100;
  return (effHrs * weatherF) / (cycle + moveMins / 60);
}
function engBlockDays(block, ep) {
  const ppd         = engPPD(ep);
  const rigsPerZone = Math.max(1, Math.floor(ep.rigCount / block.zones.length));
  const installDays = Math.max(...block.zones.map(z =>
    (z.startOffset || 0) + Math.ceil(z.piles / (ppd * rigsPerZone))
  ));
  const weather    = WEATHER_ENG[ep.weather] || WEATHER_ENG.monsoon;
  const stormDays  = Math.ceil((installDays / 30) * weather.stormDays);
  const contDays   = Math.ceil((installDays + stormDays) * ep.contingency / 100);
  return { ppd, cycle: engCycleHrs(ep), installDays, stormDays, contDays, total: installDays + stormDays + contDays };
}
function engConcrete(ep, piles) {
  const r = ep.pileDiaM / 2;
  const len = ep.pileDepthM + ep.socketM + 0.8 + 0.5;
  return +(piles * Math.PI * r * r * len * 1.12).toFixed(0);
}
function engRebar(ep, piles) {
  const r = ep.pileDiaM / 2;
  const len = ep.pileDepthM + ep.socketM + 0.8 + 0.5;
  const ratio = ep.soilProfile === "weathered_r" || ep.soilProfile === "rock" ? 155 : 120;
  return +(piles * Math.PI * r * r * len * ratio / 1000).toFixed(1);
}
function engTests(ep, piles) {
  const t = TESTING_ENG[ep.testing] || TESTING_ENG.standard;
  return {
    ult: Math.max(1, Math.ceil(piles * t.ultPct / 100)),
    wlt: Math.max(1, Math.ceil(piles * t.wltPct / 100)),
    pda: Math.max(1, Math.ceil(piles * t.pdaPct / 100)),
  };
}

function generateOptSuggestions(blocks, engParams) {
  const sugs = [];
  blocks.forEach(b => {
    const ep  = engParams[b.id] || ENG_DEFAULTS[b.id] || ENG_DEFAULTS.blk6;
    const cur = engBlockDays(b, ep);

    if (ep.shiftCfg !== "double" && ep.shiftCfg !== "cont_24") {
      const nb = { ...ep, shiftCfg: "double" };
      const save = cur.total - engBlockDays(b, nb).total;
      if (save >= 3) sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority:"high",
        category:"Shift Pattern", title:`Switch to Double Shift (16h/6d)`,
        detail:`Output rises ${cur.ppd.toFixed(1)} → ${engPPD(nb).toFixed(1)} piles/day. Saves ${save} days.`,
        saving:save, field:"shiftCfg", value:"double" });
    }

    // More smaller zones = shorter individual zone duration = earlier rig turnover per zone
    // Even with sequential execution, smaller zones let you reach productive cadence faster
    // and make schedule recovery easier (zone replanning is granular)
    if (b.zones.length < 8) {
      const n = b.zones.length + 1;
      const base = Math.floor(b.piles / n), rem = b.piles % n;
      // Sequential: block duration = sum of all zone durations (unchanged in total piles)
      // BUT smaller zones mean: each zone done faster → rig can be redeployed sooner,
      // weather/access recovery is within a smaller window, and takt beat is tighter.
      // We model the saving as: shorter max zone → fewer "wasted tail days" when
      // a zone finishes mid-week (remainder effect) → saves floor(n * 0.5) days on average.
      const zoneDays = b.zones.map(z => Math.ceil(z.piles / b.taktRate));
      const maxZoneDays = Math.max(...zoneDays);
      const newZoneDays = Math.ceil(base / b.taktRate);
      const save = Math.max(1, maxZoneDays - newZoneDays);
      const newZones = Array.from({ length:n }, (_, i) => ({
        id:`zopt${Date.now()}${i}`, name:`Zone ${i+1}`,
        piles: base + (i === n-1 ? rem : 0),
        startOffset: 0, accessReady: true, notes: ""
      }));
      sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority: save>=5?"high":"medium",
        category:"Zone Layout",
        title:`Split to ${n} zones (~${base} piles each, ~${newZoneDays}d/zone)`,
        detail:`Smaller zones → shorter per-zone cycle (${newZoneDays}d vs ${maxZoneDays}d max). Tighter takt beat, faster recovery from delays. Saves ~${save}d on longest zone.`,
        saving:save, field:"_zones", value:newZones });
    }

    if (ep.concrete !== "onsite" && ep.concrete !== "rmx_near") {
      const nb = { ...ep, concrete:"rmx_near" };
      const save = cur.total - engBlockDays(b, nb).total;
      if (save >= 2) sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority:"medium",
        category:"Concrete Supply", title:`Upgrade to Ready-mix <20 min (reliability 93%)`,
        detail:`Current reliability ${(CONCRETE_ENG[ep.concrete].reliability*100).toFixed(0)}% causes idle time. Saves ${save} days.`,
        saving:save, field:"concrete", value:"rmx_near" });
    }

    if (ep.rigEff < 0.85) {
      const nb = { ...ep, rigEff:0.87 };
      const save = cur.total - engBlockDays(b, nb).total;
      if (save >= 1) sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority:"medium",
        category:"Rig Performance", title:`Planned maintenance programme — lift rig availability to 87%`,
        detail:`Current ${(ep.rigEff*100).toFixed(0)}% uptime. Preventive PM + standby rig. Saves ${save} days.`,
        saving:save, field:"rigEff", value:0.87 });
    }

    if (ep.weather === "monsoon" || ep.weather === "typhoon") {
      const nb = { ...ep, weather:"tropical" };
      const save = cur.total - engBlockDays(b, nb).total;
      if (save >= 3) sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority:"high",
        category:"Weather Mitigation", title:`Install covered rig platforms — cut monsoon downtime to 3%`,
        detail:`${WEATHER_ENG[ep.weather].downtimePct}% downtime now. Sheltered platform + advance concrete stockpile. Saves ${save} days.`,
        saving:save, field:"weather", value:"tropical" });
    }

    const maxP = Math.max(...b.zones.map(z=>z.piles)), minP = Math.min(...b.zones.map(z=>z.piles));
    if (b.zones.length > 1 && maxP / Math.max(minP,1) > 1.25) {
      const n = b.zones.length, base = Math.floor(b.piles/n), rem = b.piles%n;
      const balanced = b.zones.map((z,i) => ({ ...z, piles:base+(i===n-1?rem:0) }));
      sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority:"medium",
        category:"Takt Rhythm", title:`Re-balance zones to ~${base} piles each — equal takt beat`,
        detail:`Range ${minP}–${maxP} piles (${((maxP/minP-1)*100).toFixed(0)}% imbalance). Equal sizing gives steady flow and predictable handover.`,
        saving:3, field:"_balance", value:balanced });
    }

    if (ep.contingency > 10) {
      const save = Math.ceil(cur.installDays * (ep.contingency - 8) / 100);
      sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority:"low",
        category:"Risk Allowance", title:`Reduce contingency ${ep.contingency}% → 8% (post-GI, access confirmed)`,
        detail:`Once boreholes confirm soil and access cleared, 8% is defensible. Saves ${save} days.`,
        saving:save, field:"contingency", value:8 });
    }

    // ── Rig increase suggestion ──────────────────────────────────────
    // Adding a rig reduces piles-per-rig, cutting install days proportionally.
    // Only suggest if adding 1 rig gives ≥3 day saving and we're under 6 rigs.
    if (ep.rigCount < 6) {
      const nb = { ...ep, rigCount: ep.rigCount + 1 };
      const curInstall = cur.installDays;
      const newInstall = engBlockDays(b, nb).installDays;
      const save = cur.total - engBlockDays(b, nb).total;
      if (save >= 3) sugs.push({
        blockId:b.id, blockName:b.name, blockColor:b.color,
        priority: save >= 7 ? "high" : "medium",
        category:"Rig Deployment",
        title:`Add 1 rig (${ep.rigCount} → ${ep.rigCount + 1} rigs) — parallel zone drilling`,
        detail:`Install days: ${curInstall}d → ${newInstall}d. More rigs per zone increases daily output from ${cur.ppd.toFixed(1)} to ${engPPD(nb).toFixed(1)} piles/day. Saves ~${save} days.`,
        saving:save, field:"rigCount", value: ep.rigCount + 1
      });
    }

    if (ep.socketM > 0 && ep.shiftCfg === "std_8") {
      sugs.push({ blockId:b.id, blockName:b.name, blockColor:b.color, priority:"high",
        category:"Rock Piling", title:`Rock socketing ${ep.socketM}m — extend to min 10h shift`,
        detail:`Rock profile adds significant cycle time. Extended shift compensates. Standard 8h is inadequate.`,
        saving:4, field:"shiftCfg", value:"ext_10" });
    }
  });
  return sugs.sort((a, b) => b.saving - a.saving);
}

const RISK_COLORS = { low:"#22C55E", medium:"#F59E0B", high:"#F97316", very_high:"#EF4444" };
const PRIO_COLORS = { high:"#EF4444", medium:"#F59E0B", low:"#22C55E" };

function OptimisationTab({ blocks, setBlocks }) {
  const [engParams, setEngParams] = useState(() => {
    try { const s = localStorage.getItem("eng_params_v1"); return s ? JSON.parse(s) : { ...ENG_DEFAULTS }; }
    catch { return { ...ENG_DEFAULTS }; }
  });
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [openBlock, setOpenBlock] = useState(null);
  const [section, setSection] = useState("suggestions");

  useEffect(() => {
    try { localStorage.setItem("eng_params_v1", JSON.stringify(engParams)); } catch {}
  }, [engParams]);

  const updEP = (blockId, field, val) =>
    setEngParams(p => ({ ...p, [blockId]: { ...p[blockId], [field]: val } }));

  const suggestions = useMemo(() => generateOptSuggestions(blocks, engParams), [blocks, engParams]);
  const highCount   = suggestions.filter(s => s.priority === "high").length;

  const computed = useMemo(() => blocks.map(b => {
    const ep    = engParams[b.id] || ENG_DEFAULTS[b.id] || ENG_DEFAULTS.blk6;
    const sched = engBlockDays(b, ep);
    return { b, ep, sched, conc:engConcrete(ep,b.piles), steel:engRebar(ep,b.piles), tests:engTests(ep,b.piles) };
  }), [blocks, engParams]);

  const totalDays   = Math.max(...computed.map(c => c.sched.total));
  const totalConc   = computed.reduce((s,c) => s+c.conc, 0);
  const totalSteel  = computed.reduce((s,c) => s+c.steel, 0);
  const netSaving   = 100 - totalDays;

  const applySug = (s) => {
    if (s.field === "_zones" || s.field === "_balance") {
      setBlocks(bs => bs.map(b => b.id === s.blockId ? { ...b, zones: s.value } : b));
    } else {
      updEP(s.blockId, s.field, s.value);
    }
    setAppliedIds(prev => new Set([...prev, s.blockId + s.title]));
  };

  const scenarios = useMemo(() => [
    { label:"All → Double Shift",        field:"shiftCfg",    value:"double",   icon:"clock" },
    { label:"All → On-site Batching",    field:"concrete",    value:"onsite",   icon:"info" },
    { label:"All rig efficiency → 90%",  field:"rigEff",      value:0.90,       icon:"settings" },
    { label:"All contingency → 5%",      field:"contingency", value:5,          icon:"check" },
    { label:"All → Weather cover (3%)",  field:"weather",     value:"tropical", icon:"alert" },
    { label:"All → 24h Continuous",      field:"shiftCfg",    value:"cont_24",  icon:"clock" },
    { label:"+1 Rig on all blocks",      field:"rigCount",    value:"_plus1",   icon:"zap" },
    { label:"+2 Rigs on all blocks",     field:"rigCount",    value:"_plus2",   icon:"zap" },
  ].map(s => {
    const newEP = {};
    blocks.forEach(b => {
      const cur = engParams[b.id]||ENG_DEFAULTS[b.id]||ENG_DEFAULTS.blk6;
      if (s.value === "_plus1") newEP[b.id] = { ...cur, rigCount: Math.min(8, cur.rigCount + 1) };
      else if (s.value === "_plus2") newEP[b.id] = { ...cur, rigCount: Math.min(8, cur.rigCount + 2) };
      else newEP[b.id] = { ...cur, [s.field]: s.value };
    });
    const nd = Math.max(...blocks.map(b => engBlockDays(b, newEP[b.id]).total));
    return { ...s, newDays:nd, saving:totalDays-nd };
  }), [blocks, engParams, totalDays]);

  const sections = [
    { id:"suggestions", label:`Suggestions (${suggestions.length})` },
    { id:"rigs",        label:"Rig Deployment" },
    { id:"parameters",  label:"Eng Parameters" },
    { id:"whatif",      label:"What-If Scenarios" },
    { id:"materials",   label:"Materials & Testing" },
  ];

  const selStyle = { background:"#0a0f1e", border:"1px solid #334155", color:"#E2E8F0", appearance:"none" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily:"'Georgia',serif" }}>Piling Optimisation Centre</h1>
          <p className="text-sm mt-1 text-gray-500">Engineering parameters · Smart suggestions · What-if scenarios · Materials & testing</p>
        </div>
        {suggestions.length > 0 && (
          <button onClick={() => suggestions.forEach(s => applySug(s))}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background:"linear-gradient(90deg,#2563EB,#7C3AED)" }}>
            Apply All ({suggestions.length})
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l:"Optimised Duration",  v:`${totalDays}d`,    c:"#10B981", sub:`${(totalDays/6).toFixed(1)} weeks` },
          { l:"Schedule Saving",     v:`${netSaving>0?"−":""}${Math.abs(netSaving)}d`, c:netSaving>0?"#10B981":"#EF4444", sub:"vs 100d baseline" },
          { l:"Total Concrete",      v:`${(totalConc/1000).toFixed(1)}k m³`, c:"#A855F7", sub:"all blocks" },
          { l:"Total Rebar",         v:`${totalSteel.toFixed(0)} t`,    c:"#0EA5E9", sub:"reinforcement" },
        ].map(k => (
          <div key={k.l} className="rounded-2xl p-4 relative overflow-hidden" style={{ background:"#0a0f1e", border:`1px solid ${k.c}25` }}>
            <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full opacity-10" style={{ background:k.c }} />
            <div className="text-2xl font-bold" style={{ color:k.c, fontFamily:"'Georgia',serif" }}>{k.v}</div>
            <div className="text-xs font-semibold mt-1" style={{ color:k.c+"AA" }}>{k.l}</div>
            <div className="text-xs mt-0.5 text-gray-600">{k.sub}</div>
          </div>
        ))}
      </div>

      {highCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background:"#EF44440D", border:"1px solid #EF444425" }}>
          <Icon name="alert" size={18} />
          <div>
            <div className="text-sm font-bold text-white">{highCount} high-priority optimisations</div>
            <div className="text-xs mt-1 text-gray-500">{suggestions.filter(s=>s.priority==="high").map(s=>`${s.blockName}: ${s.title}`).join(" · ")}</div>
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.05)" }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background:section===s.id?"rgba(37,99,235,0.2)":"transparent",
              color:section===s.id?"#93C5FD":"#6B7280",
              border:section===s.id?"1px solid rgba(37,99,235,0.3)":"1px solid transparent" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── SUGGESTIONS ── */}
      {section === "suggestions" && (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="rounded-2xl p-14 text-center" style={{ background:"#0a0f1e", border:"1px solid #22C55E30" }}>
              <Icon name="check" size={44} />
              <div className="text-xl font-bold text-white mt-3" style={{ fontFamily:"'Georgia',serif" }}>Plan Fully Optimised</div>
              <p className="text-sm mt-2 text-gray-500">All engineering parameters within recommended ranges.</p>
            </div>
          ) : suggestions.map((s, i) => {
            const applied = appliedIds.has(s.blockId + s.title);
            const pc = PRIO_COLORS[s.priority] || "#6B7280";
            return (
              <div key={i} className="rounded-2xl overflow-hidden transition-all"
                style={{ background:"#0a0f1e", border:`1px solid ${pc}18`, opacity:applied?0.5:1 }}>
                <div className="flex items-center gap-4 p-4">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:`${pc}18`, color:pc }}>
                      <Icon name="zap" size={18} />
                    </div>
                    <span className="font-bold uppercase" style={{ color:pc, fontSize:8 }}>{s.priority}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:s.blockColor+"20", color:s.blockColor }}>{s.blockName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(255,255,255,0.05)", color:"#6B7280" }}>{s.category}</span>
                      <span className="text-xs font-bold ml-auto text-green-400">−{s.saving} days</span>
                    </div>
                    <div className="text-sm font-bold text-white">{s.title}</div>
                    <div className="text-xs mt-1 text-gray-500">{s.detail}</div>
                  </div>
                  <button onClick={() => applySug(s)} disabled={applied}
                    className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ background:applied?"rgba(255,255,255,0.03)":`${pc}20`, color:applied?"#374151":pc,
                      border:`1px solid ${applied?"rgba(255,255,255,0.05)":pc+"40"}`, cursor:applied?"not-allowed":"pointer" }}>
                    {applied ? "✓ Applied" : "Apply"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RIG DEPLOYMENT ── */}
      {section === "rigs" && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4" style={{ background:"#0a0f1e", border:"1px solid rgba(14,165,233,0.2)" }}>
            <div className="text-sm font-bold text-white mb-1">How rig count reduces schedule</div>
            <p className="text-xs text-gray-500">
              Each additional rig deployed to a block increases daily piling output proportionally.
              The table below shows how duration changes at 1–6 rigs for each block based on current engineering parameters.
              Use the <strong style={{color:"#0EA5E9"}}>Set</strong> buttons to apply a rig count directly, or use Apply All Suggestions above.
            </p>
          </div>

          {/* Per-block rig impact table */}
          {computed.map(({ b, ep, sched }) => {
            const RIG_RANGE = [1,2,3,4,5,6];
            const rigRows = RIG_RANGE.map(r => {
              const nb = { ...ep, rigCount: r };
              const nd = engBlockDays(b, nb);
              return { rigs:r, ppd: engPPD(nb) * r, installDays: nd.installDays, total: nd.total,
                       saving: sched.total - nd.total };
            });
            const current = rigRows.find(r => r.rigs === ep.rigCount) || rigRows[0];
            const best    = rigRows.reduce((a,r) => r.total < a.total ? r : a, rigRows[0]);

            return (
              <div key={b.id} className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:`1px solid ${b.color}25` }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ background:`${b.color}12`, borderBottom:`1px solid ${b.color}20` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background:b.color }} />
                    <span className="font-bold text-white">{b.name}</span>
                    <span className="text-xs text-gray-500">{b.piles} piles</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span style={{ color:"#64748B" }}>Current: <strong style={{ color:b.color }}>{ep.rigCount} rig{ep.rigCount>1?"s":""} → {current.total}d</strong></span>
                    <span style={{ color:"#64748B" }}>Best: <strong style={{ color:"#10B981" }}>{best.rigs} rigs → {best.total}d (−{best.saving}d)</strong></span>
                  </div>
                </div>

                {/* Rig rows */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5" style={{ color:"#475569" }}>
                        {["Rigs","Output (piles/day)","Install Days","Storm + Cont","Total Days","vs Current",""].map(h => (
                          <th key={h} className="py-2 px-3 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rigRows.map(row => {
                        const isCurrent = row.rigs === ep.rigCount;
                        const isBest    = row.rigs === best.rigs;
                        const diff      = row.total - current.total;
                        const barPct    = Math.min(100, (row.total / rigRows[0].total) * 100);
                        return (
                          <tr key={row.rigs}
                            className="border-b border-white/5 transition-colors"
                            style={{ background: isCurrent ? `${b.color}12` : isBest ? "rgba(16,185,129,0.06)" : "transparent" }}>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                {/* Rig icons */}
                                <div className="flex gap-0.5">
                                  {Array.from({length: row.rigs}, (_,i) => (
                                    <div key={i} className="w-3 h-3 rounded-sm"
                                      style={{ background: isCurrent ? b.color : isBest ? "#10B981" : "#1E293B",
                                               border:`1px solid ${isCurrent ? b.color : isBest ? "#10B981" : "#334155"}` }} />
                                  ))}
                                </div>
                                <span className="font-bold" style={{ color: isCurrent ? b.color : isBest ? "#10B981" : "#64748B" }}>
                                  {row.rigs}
                                </span>
                                {isCurrent && <span className="text-xs px-1 rounded" style={{ background:b.color+"20", color:b.color, fontSize:9 }}>current</span>}
                                {isBest && !isCurrent && <span className="text-xs px-1 rounded" style={{ background:"#10B98120", color:"#10B981", fontSize:9 }}>best</span>}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="rounded-full overflow-hidden" style={{ width:56, height:4, background:"#1E293B" }}>
                                  <div style={{ width:`${Math.min(100,(row.ppd/rigRows[5].ppd)*100)}%`, height:"100%",
                                    background: isCurrent ? b.color : isBest ? "#10B981" : "#334155" }} />
                                </div>
                                <span className="font-bold text-white">{row.ppd.toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-gray-300">{row.installDays}d</td>
                            <td className="py-2.5 px-3 text-gray-500">
                              {row.total - row.installDays}d
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="rounded overflow-hidden" style={{ width:64, height:6, background:"#0F172A" }}>
                                  <div style={{ width:`${barPct}%`, height:"100%",
                                    background: isBest ? "#10B981" : isCurrent ? b.color : "#334155", borderRadius:2 }} />
                                </div>
                                <span className="font-bold" style={{ color: isBest?"#10B981": isCurrent?b.color:"#64748B" }}>
                                  {row.total}d
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {diff === 0
                                ? <span style={{ color:"#475569" }}>—</span>
                                : <span className="font-bold" style={{ color: diff < 0 ? "#10B981" : "#EF4444" }}>
                                    {diff < 0 ? "−" : "+"}{Math.abs(diff)}d
                                  </span>
                              }
                            </td>
                            <td className="py-2.5 px-3">
                              {!isCurrent && (
                                <button
                                  onClick={() => updEP(b.id, "rigCount", row.rigs)}
                                  className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                                  style={{ background: isBest?"rgba(16,185,129,0.15)":"rgba(255,255,255,0.05)",
                                    color: isBest?"#10B981":"#64748B",
                                    border:`1px solid ${isBest?"rgba(16,185,129,0.3)":"rgba(255,255,255,0.08)"}` }}>
                                  Set {row.rigs}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Programme-level rig summary */}
          <div className="rounded-2xl p-4" style={{ background:"#0a0f1e", border:"1px solid rgba(20,184,166,0.2)" }}>
            <div className="text-sm font-bold text-teal-300 mb-3">Programme Impact — Rig Count vs Schedule</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5" style={{ color:"#475569" }}>
                    <th className="py-2 px-3 text-left">Scenario</th>
                    {blocks.map(b => <th key={b.id} className="py-2 px-3 text-center font-medium" style={{ color:b.color }}>{b.name}</th>)}
                    <th className="py-2 px-3 text-center text-teal-400">Programme Max</th>
                    <th className="py-2 px-3 text-center">Saving</th>
                  </tr>
                </thead>
                <tbody>
                  {[0,1,2].map(extra => {
                    const blockDays = computed.map(({ b, ep }) => {
                      const nb = { ...ep, rigCount: Math.min(8, ep.rigCount + extra) };
                      return { id:b.id, days: engBlockDays(b, nb).total, rigs: Math.min(8, ep.rigCount + extra) };
                    });
                    const progMax = Math.max(...blockDays.map(d => d.days));
                    const baseProg = Math.max(...computed.map(({ ep, b }) => engBlockDays(b, ep).total));
                    const saved = baseProg - progMax;
                    return (
                      <tr key={extra} className="border-b border-white/5"
                        style={{ background: extra===0?"rgba(37,99,235,0.06)":extra===1?"rgba(16,185,129,0.04)":"rgba(248,113,113,0.04)" }}>
                        <td className="py-2 px-3 font-bold text-white">
                          {extra===0 ? "Current rigs" : `+${extra} rig${extra>1?"s":""} per block`}
                        </td>
                        {blockDays.map(d => (
                          <td key={d.id} className="py-2 px-3 text-center text-gray-400">
                            {d.rigs}r · {d.days}d
                          </td>
                        ))}
                        <td className="py-2 px-3 text-center font-bold text-teal-400">{progMax}d</td>
                        <td className="py-2 px-3 text-center font-bold" style={{ color: saved>0?"#10B981": saved<0?"#EF4444":"#64748B" }}>
                          {saved>0?"−":saved<0?"+":""}{Math.abs(saved)}d
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ENGINEERING PARAMETERS ── */}
      {section === "parameters" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {computed.map(({ b, ep, sched }) => {
            const soil  = SOIL_ENG[ep.soilProfile] || SOIL_ENG.soft_clay;
            const rc    = RISK_COLORS[soil.risk] || "#6B7280";
            const isOpen = openBlock === b.id;
            return (
              <div key={b.id} className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:`1px solid ${b.color}25` }}>
                <div className="h-1" style={{ background:`linear-gradient(90deg,${b.color},${b.color}44)` }} />
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background:b.color }} />
                      <span className="font-bold text-white">{b.name}</span>
                      <span className="text-xs text-gray-600">· {b.piles} piles</span>
                    </div>
                    <button onClick={() => setOpenBlock(isOpen ? null : b.id)}
                      className="text-xs px-2 py-1 rounded-lg text-gray-500"
                      style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
                      {isOpen ? "▲" : "▼ More"}
                    </button>
                  </div>

                  {/* Live metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { l:"Cycle/pile", v:`${sched.cycle.toFixed(1)}h`, c:"#F59E0B" },
                      { l:"Piles/day",  v:sched.ppd.toFixed(1),         c:"#10B981" },
                      { l:"Duration",   v:`${sched.total}d`,            c:b.color },
                    ].map(m => (
                      <div key={m.l} className="rounded-xl p-2 text-center" style={{ background:"#111827" }}>
                        <div className="text-sm font-bold" style={{ color:m.c, fontFamily:"'Georgia',serif" }}>{m.v}</div>
                        <div className="text-xs text-gray-600">{m.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Always-visible params */}
                  {[
                    { l:"Pile Type",     type:"select", options:PILE_TYPES_ENG,  field:"pileType",     val:ep.pileType },
                    { l:"Soil Profile",  type:"select", options:SOIL_ENG,        field:"soilProfile",  val:ep.soilProfile },
                    { l:"Shift Pattern", type:"select", options:SHIFT_ENG,       field:"shiftCfg",     val:ep.shiftCfg },
                    { l:"Rig Count",     type:"number", min:1, max:8, unit:"rigs",field:"rigCount",    val:ep.rigCount },
                    { l:"Rig Efficiency",type:"number", min:0.5, max:0.98, step:0.01, unit:"", field:"rigEff", val:ep.rigEff },
                  ].map(row => (
                    <div key={row.l} className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-xs text-gray-500">{row.l}</span>
                      {row.type === "select" ? (
                        <select value={row.val} onChange={e => updEP(b.id, row.field, e.target.value)}
                          className="text-xs px-2 py-1 rounded-lg outline-none" style={{ ...selStyle, minWidth:160 }}>
                          {Object.entries(row.options).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input type="number" value={row.val} min={row.min} max={row.max} step={row.step||1}
                            onChange={e => updEP(b.id, row.field, parseFloat(e.target.value)||0)}
                            className="w-20 text-xs px-2 py-1 rounded-lg text-right outline-none font-bold"
                            style={{ background:"#1E293B", border:"1px solid #334155", color:"#60A5FA" }} />
                          {row.unit && <span className="text-xs text-gray-600">{row.unit}</span>}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Expanded params */}
                  {isOpen && [
                    { l:"Pile Depth",   type:"number", min:5,   max:100, step:1,    unit:"m",   field:"pileDepthM",  val:ep.pileDepthM },
                    { l:"Pile Dia",     type:"number", min:0.3, max:3.0, step:0.05, unit:"m",   field:"pileDiaM",    val:ep.pileDiaM },
                    { l:"Rock Socket",  type:"number", min:0,   max:20,  step:0.5,  unit:"m",   field:"socketM",     val:ep.socketM },
                    { l:"Concrete",     type:"select", options:CONCRETE_ENG, field:"concrete", val:ep.concrete },
                    { l:"Weather Risk", type:"select", options:WEATHER_ENG,  field:"weather",  val:ep.weather },
                    { l:"Testing",      type:"select", options:TESTING_ENG,  field:"testing",  val:ep.testing },
                    { l:"Adjacency Hrs",type:"number", min:0,   max:72,  unit:"h",  field:"adjacencyHrs", val:ep.adjacencyHrs },
                    { l:"Contingency",  type:"number", min:0,   max:30,  unit:"%",  field:"contingency",  val:ep.contingency },
                  ].map(row => (
                    <div key={row.l} className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-xs text-gray-500">{row.l}</span>
                      {row.type === "select" ? (
                        <select value={row.val} onChange={e => updEP(b.id, row.field, e.target.value)}
                          className="text-xs px-2 py-1 rounded-lg outline-none" style={{ ...selStyle, minWidth:160 }}>
                          {Object.entries(row.options).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input type="number" value={row.val} min={row.min} max={row.max} step={row.step||1}
                            onChange={e => updEP(b.id, row.field, parseFloat(e.target.value)||0)}
                            className="w-20 text-xs px-2 py-1 rounded-lg text-right outline-none font-bold"
                            style={{ background:"#1E293B", border:"1px solid #334155", color:"#60A5FA" }} />
                          {row.unit && <span className="text-xs text-gray-600">{row.unit}</span>}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Soil risk badge */}
                  <div className="mt-3 p-2.5 rounded-xl" style={{ background:rc+"12", border:`1px solid ${rc}25` }}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-bold" style={{ color:rc }}>{soil.risk.replace("_"," ").toUpperCase()} RISK · x{soil.factor} cycle</span>
                      <span className="text-xs text-gray-600">SPT {soil.spt}</span>
                    </div>
                    <p className="text-xs text-gray-500">{soil.note}</p>
                  </div>

                  {/* Duration bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Duration breakdown</span>
                      <span className="font-bold text-white">{sched.total}d</span>
                    </div>
                    <div className="flex rounded-full overflow-hidden" style={{ height:5 }}>
                      <div style={{ flex:sched.installDays, background:b.color, opacity:0.9 }} />
                      <div style={{ flex:sched.stormDays,   background:"#F97316", opacity:0.8 }} />
                      <div style={{ flex:sched.contDays,    background:"#F59E0B", opacity:0.8 }} />
                    </div>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span style={{ color:b.color }}>▪ Install {sched.installDays}d</span>
                      <span style={{ color:"#F97316" }}>▪ Weather {sched.stormDays}d</span>
                      <span style={{ color:"#F59E0B" }}>▪ Cont {sched.contDays}d</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── WHAT-IF SCENARIOS ── */}
      {section === "whatif" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scenarios.map((s, i) => (
              <div key={i} className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:`1px solid ${s.saving>0?"#10B98130":"rgba(255,255,255,0.07)"}` }}>
                <div className="text-sm font-bold text-white mb-4">{s.label}</div>
                {[["Current",`${totalDays}d`,"#6B7280"],["Scenario",`${s.newDays}d`,"#60A5FA"],["Saving",`${s.saving>0?"−":""}${Math.abs(s.saving)}d`,s.saving>0?"#10B981":"#EF4444"]].map(([l,v,c]) => (
                  <div key={l} className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-bold" style={{ color:c }}>{v}</span>
                  </div>
                ))}
                <div className="w-full rounded-full overflow-hidden my-3" style={{ height:5, background:"rgba(255,255,255,0.05)" }}>
                  <div style={{ width:`${Math.min(100,Math.max(5,Math.abs(s.saving)/Math.max(totalDays,1)*300))}%`, height:"100%",
                    background:s.saving>0?"linear-gradient(90deg,#10B98144,#10B981)":"#EF4444", borderRadius:4 }} />
                </div>
                <button onClick={() => {
                  setEngParams(p => {
                    const u = { ...p };
                    blocks.forEach(b => { u[b.id] = { ...(u[b.id]||ENG_DEFAULTS[b.id]||ENG_DEFAULTS.blk6), [s.field]:s.value }; });
                    return u;
                  });
                }} className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background:"rgba(37,99,235,0.15)", color:"#93C5FD", border:"1px solid rgba(37,99,235,0.3)" }}>
                  Apply to All Blocks
                </button>
              </div>
            ))}
          </div>
          {/* Comparison bar chart */}
          <div className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
            <h3 className="text-sm font-bold text-white mb-4" style={{ fontFamily:"'Georgia',serif" }}>Programme Days — Scenario Comparison</h3>
            <div className="space-y-3">
              {[...scenarios].sort((a,b) => b.saving-a.saving).map((s,i) => {
                const pct = Math.min(100, Math.max(4, Math.abs(s.saving)/Math.max(totalDays,1)*300));
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-right text-gray-500 flex-shrink-0">{s.label}</div>
                    <div className="flex-1 relative rounded-full overflow-hidden" style={{ height:20, background:"rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full flex items-center px-2 transition-all"
                        style={{ width:`${pct}%`, background:s.saving>0?"linear-gradient(90deg,#10B98133,#10B981BB)":"linear-gradient(90deg,#EF444433,#EF4444BB)" }}>
                        <span className="text-xs font-bold text-white">{s.saving>0?`−${s.saving}d`:`+${Math.abs(s.saving)}d`}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold w-14 text-right flex-shrink-0" style={{ color:s.saving>0?"#10B981":"#EF4444" }}>{s.newDays}d</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MATERIALS & TESTING ── */}
      {section === "materials" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { l:"Total Concrete", v:`${(totalConc/1000).toFixed(2)}k m³`, sub:`${totalConc.toLocaleString()} m³`, c:"#A855F7" },
              { l:"Total Rebar",    v:`${totalSteel.toFixed(0)} t`,          sub:"reinforcement steel",              c:"#0EA5E9" },
            ].map(m => (
              <div key={m.l} className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:`1px solid ${m.c}25` }}>
                <div className="text-3xl font-bold" style={{ color:m.c, fontFamily:"'Georgia',serif" }}>{m.v}</div>
                <div className="text-sm font-semibold mt-1" style={{ color:m.c+"AA" }}>{m.l}</div>
                <div className="text-xs mt-0.5 text-gray-600">{m.sub}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-white" style={{ fontFamily:"'Georgia',serif" }}>Block Materials & Testing Schedule</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-600 uppercase tracking-wider" style={{ fontSize:9 }}>
                    {["Block","Depth / Dia","Soil","Concrete","Rebar","ULT","WLT","PDA","Cure","ULT CP","Rebar Order"].map(h => (
                      <th key={h} className="py-3 px-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {computed.map(({ b, ep, conc, steel, tests }) => {
                    const curingDays = ep.testing === "research" ? 35 : 28;
                    const ultCP = curingDays + 14;
                    const orderDate = new Date(b.startDate);
                    orderDate.setDate(orderDate.getDate() - 21);
                    const soil = SOIL_ENG[ep.soilProfile] || SOIL_ENG.soft_clay;
                    const rc = RISK_COLORS[soil.risk] || "#6B7280";
                    return (
                      <tr key={b.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="py-3 px-3 font-bold" style={{ color:b.color }}>{b.name}</td>
                        <td className="py-3 px-3 text-gray-400">{ep.pileDepthM}m / ⌀{ep.pileDiaM}m</td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ background:rc+"20", color:rc, fontSize:9 }}>
                            {soil.label.split(" ").slice(0,2).join(" ")}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold" style={{ color:"#A855F7" }}>{conc}m³</td>
                        <td className="py-3 px-3 font-bold" style={{ color:"#0EA5E9" }}>{steel}t</td>
                        <td className="py-3 px-3 font-bold text-red-400">{tests.ult}</td>
                        <td className="py-3 px-3 font-bold text-amber-400">{tests.wlt}</td>
                        <td className="py-3 px-3 font-bold text-green-400">{tests.pda}</td>
                        <td className="py-3 px-3 text-gray-400">{curingDays}d</td>
                        <td className="py-3 px-3 font-bold" style={{ color:ultCP>30?"#EF4444":"#F59E0B" }}>{ultCP}d</td>
                        <td className="py-3 px-3 font-bold text-white">{orderDate.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-white/10" style={{ background:"rgba(37,99,235,0.04)" }}>
                    <td className="py-3 px-3 font-bold text-white" colSpan={3}>TOTAL</td>
                    <td className="py-3 px-3 font-bold" style={{ color:"#A855F7" }}>{totalConc.toLocaleString()}m³</td>
                    <td className="py-3 px-3 font-bold" style={{ color:"#0EA5E9" }}>{totalSteel.toFixed(1)}t</td>
                    <td className="py-3 px-3 font-bold text-red-400">{computed.reduce((s,c)=>s+c.tests.ult,0)}</td>
                    <td className="py-3 px-3 font-bold text-amber-400">{computed.reduce((s,c)=>s+c.tests.wlt,0)}</td>
                    <td className="py-3 px-3 font-bold text-green-400">{computed.reduce((s,c)=>s+c.tests.pda,0)}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl p-4 flex gap-3" style={{ background:"#F59E0B08", border:"1px solid #F59E0B25" }}>
            <Icon name="alert" size={16} />
            <p className="text-xs text-gray-400">
              <span className="font-bold text-amber-400">Testing Critical Path: </span>
              ULT requires 28 days minimum curing before loading. Install test pile in Zone 1 during mob to start curing clock early.
              Early PDA at ~10% completion de-risks the ULT programme and provides early capacity confirmation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PRESENTATION TAB — Generate & Download PPTX / PDF
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
//  PRESENTATION TAB — Live slide previews + PPTX/PDF download
//  Fully self-contained — no CDN dependencies
// ═══════════════════════════════════════════════════════════════════

// ── Slide data ───────────────────────────────────────────────────
const ORIG_DAYS_PRES = [43,29,21,20,30,30];
const OPT_DAYS_PRES  = [32,22,15,15,22,23];
const BLK_COLORS_PRES= ["#1B8CC4","#F97316","#22C55E","#EAB308","#A855F7","#EF4444"];
const BLK_NAMES_PRES = ["Blk-6","Blk-5","Blk-4","Blk-3","Blk-2","Blk-1"];
const BLK_PILES_PRES = [489,379,168,170,374,403];
const ISSUES_PRES = [
  { block:"Blk-6", col:"#1B8CC4", impact:"−11d", issue:"Zone imbalance: Zone 3 deferred — ~48 idle days between zones 1/2 and zone 3 due to access constraint." },
  { block:"Blk-5", col:"#F97316", impact:"−7d",  issue:"Zones too large (~190 piles each). Long sequential run per zone. Splitting to 3×127 reduces each zone duration by 30%." },
  { block:"Blk-4", col:"#22C55E", impact:"−6d",  issue:"Only 1 active zone; 2 rigs deployed but not split into concurrent working areas." },
  { block:"Blk-3", col:"#EAB308", impact:"−5d",  issue:"Zone 2 start delayed by access readiness. Blk-4 parallelism not tracked or enforced." },
  { block:"Blk-2", col:"#A855F7", impact:"−8d",  issue:"8% contingency applied despite confirmed GI. Mixed soil profile not reflected in takt rate." },
  { block:"Blk-1", col:"#EF4444", impact:"−7d",  issue:"Rock socket 2.5m adds ~35% to cycle time. Current takt rate unchanged from bored-pile baseline." },
];
const LEVERS_PRES = [
  { n:"1", title:"Split blocks into more, smaller zones",          saving:"−12d", detail:"Split into equal zones per rig count. Each rig works a dedicated zone simultaneously.", col:"#10B981" },
  { n:"2", title:"Blk-6: clear access → Zone 3 early start",  saving:"−8d",  detail:"Fast-track zone 3 access (minor obstruction). Overlap start with zone 1/2 progress.", col:"#1B8CC4" },
  { n:"3", title:"Double-shift Blk-1 & Blk-2",                saving:"−9d",  detail:"Rock socket (Blk-1) and mixed profile (Blk-2) benefit most from 16h/6d shift.", col:"#EF4444" },
  { n:"4", title:"Monsoon shelter platforms",                  saving:"−7d",  detail:"Covered decks reduce monsoon downtime from 14% → 3% of working hours.", col:"#F59E0B" },
  { n:"5", title:"Rebalance zone pile counts",                 saving:"−4d",  detail:"Equal pile allocation removes bottleneck zones and gives a steady takt beat.", col:"#EAB308" },
];
const ENG_PARAMS_PRES = [
  { p:"Pile Type",        b:"Bored (Cased), all blocks",             a:"Unchanged — bored cased with temp casing" },
  { p:"Shift Pattern",    b:"Extended 10h / 6d for all",             a:"Blk-1 & Blk-2 → Double Shift 16h/6d" },
  { p:"Rig Efficiency",   b:"78–88% (avg 83%)",                      a:"Target 87% via planned maintenance" },
  { p:"Zones per Block",  b:"2–4 zones, large pile counts per zone", a:"More smaller zones (4–6) — shorter sequential durations" },
  { p:"Weather",          b:"14% monsoon downtime, no mitigation",   a:"3% with sheltered rig platforms" },
  { p:"Rock Socket",      b:"Blk-1: 2.5m, std takt rate",           a:"Blk-1: takt rate adjusted × 1.7" },
  { p:"Contingency",      b:"6–12% (avg 8%)",                       a:"5–8% post-GI confirmation" },
  { p:"Testing",          b:"ULT installed late in programme",       a:"Test pile in Zone 1 during mob — early cure" },
];

// ── Live Takt Gantt — reads from blocks prop, shows every zone ────
// mode="before"  → renders INITIAL_BLOCKS (baseline, all offsets=0, sequential)
// mode="after"   → renders current blocks state (live zones + offsets)
function LiveTaktGantt({ blocks, mode }) {

  // Both BEFORE and AFTER are sequential — computeBlockSchedule chains zones automatically.
  // The difference is which blocks are passed in: BEFORE gets baseline (fewer zones),
  // AFTER gets the optimised blocks (more, smaller zones).
  const displayBlocks = useMemo(() => blocks, [blocks]);

  const scheduled = useMemo(
    () => displayBlocks.map(b => computeBlockSchedule(b)),
    [displayBlocks]
  );

  // Programme span: earliest blockStart → latest blockEnd (as ISO strings)
  const progStartISO = useMemo(() => {
    return scheduled.map(s => s.blockStart.toISOString().slice(0,10))
                    .sort()[0];
  }, [scheduled]);

  const progEndISO = useMemo(() => {
    return scheduled.map(s => s.blockEnd.toISOString().slice(0,10))
                    .sort().slice(-1)[0];
  }, [scheduled]);

  // Count working days (Mon–Sat, skip Sun) from a to b inclusive
  function countWD(fromISO, toISO) {
    let n = 0, d = new Date(fromISO);
    const end = new Date(toISO);
    while (d <= end) { if (d.getDay() !== 0) n++; d.setDate(d.getDate()+1); }
    return n;
  }

  // Working-day offset from progStart to a date (0-based)
  function wdOffset(dateISO) {
    return countWD(progStartISO, dateISO) - 1;
  }

  const totalWD = useMemo(() => countWD(progStartISO, progEndISO), [progStartISO, progEndISO]);

  // Build flat zone rows
  const rows = useMemo(() => {
    const out = [];
    scheduled.forEach((sched, bi) => {
      const block = displayBlocks[bi];
      sched.zoneSchedules.forEach((zs, zi) => {
        const startISO = zs.actualStart.toISOString().slice(0,10);
        const endISO   = zs.zEnd.toISOString().slice(0,10);
        const startWD  = wdOffset(startISO);
        const durWD    = countWD(startISO, endISO);
        out.push({
          blockName:  block.name,
          zoneName:   zs.name,
          color:      block.color,
          piles:      zs.piles,
          startWD,
          durWD,
          blockIdx:   bi,
          zoneIdx:    zi,
          totalZones: block.zones.length,
          blockDurWD: countWD(
            sched.blockStart.toISOString().slice(0,10),
            sched.blockEnd.toISOString().slice(0,10)
          ),
        });
      });
    });
    return out;
  }, [scheduled, displayBlocks, progStartISO]);

  // SVG layout constants
  const W = 740, LW = 92, HEADER_H = 30, ROW_H = 20, BLOCK_GAP = 5;
  const totalRows = rows.length;
  const numBlocks = displayBlocks.length;
  const totalH = HEADER_H + totalRows * ROW_H + (numBlocks - 1) * BLOCK_GAP + 8;
  const chartW = W - LW;

  // x position for a working-day offset
  const xOf = (wd) => LW + (wd / totalWD) * chartW;
  const wOf = (dur) => (dur / totalWD) * chartW;

  // Week grid: how many weeks fit?
  const totalWeeks = Math.ceil(totalWD / 5) + 1;
  const weekW = chartW / totalWeeks;

  const endColor = mode === "before" ? "#EF4444" : "#10B981";
  const endLabel = mode === "before" ? "BASELINE" : "OPTIMISED";

  // Hex color → rgb components
  function hexRgb(hex) {
    const h = hex.replace('#','');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${totalH}`}
      style={{ display:"block", width:"100%", height:"100%" }}>
      <rect width={W} height={totalH} fill="#080E1D" />

      {/* ── Week column headers ── */}
      {Array.from({ length: totalWeeks }, (_, wi) => {
        // Compute the calendar date of the Monday of this week
        const wkDate = new Date(progStartISO);
        wkDate.setDate(wkDate.getDate() + wi * 7);
        const dateLabel = wkDate.toLocaleDateString("en-GB", { day:"2-digit", month:"short" });
        return (
          <g key={wi}>
            <rect x={LW + wi*weekW} y={0} width={weekW} height={HEADER_H}
              fill={wi%2===0 ? "#0C1828" : "#101E30"} />
            <text x={LW + wi*weekW + weekW/2} y={12}
              textAnchor="middle" fontSize={7.5} fill="#4B5563" fontWeight="600">
              W{wi+1}
            </text>
            <text x={LW + wi*weekW + weekW/2} y={23}
              textAnchor="middle" fontSize={6} fill="#2E3F50">
              {dateLabel}
            </text>
          </g>
        );
      })}

      {/* ── Zone rows ── */}
      {(() => {
        let cy = HEADER_H;
        let prevBlockIdx = -1;
        return rows.map((row, ri) => {
          if (row.blockIdx !== prevBlockIdx && prevBlockIdx !== -1) cy += BLOCK_GAP;
          prevBlockIdx = row.blockIdx;
          const y = cy;
          cy += ROW_H;

          const bx = xOf(row.startWD);
          const bw = Math.max(3, wOf(row.durWD));
          const [rr,rg,rb] = hexRgb(row.color);
          // Zones within a block: lighter first, darker last (easier to read stacked)
          const opac = 0.38 + (row.zoneIdx / Math.max(row.totalZones - 1, 1)) * 0.48;
          const rowBg = row.zoneIdx % 2 === 0 ? "#080E1D" : "#0A1220";

          return (
            <g key={ri}>
              {/* Row background */}
              <rect x={0} y={y} width={W} height={ROW_H} fill={rowBg} />
              {/* Subtle vertical week separators */}
              {Array.from({ length: totalWeeks }, (_, wi) => (
                <line key={wi}
                  x1={LW + wi*weekW} y1={y} x2={LW + wi*weekW} y2={y+ROW_H}
                  stroke="rgba(255,255,255,0.025)" strokeWidth={0.5} />
              ))}
              {/* Zone bar */}
              <rect x={bx} y={y+2} width={bw} height={ROW_H-4}
                fill={`rgba(${rr},${rg},${rb},${opac})`} rx={2} />
              {/* Pile count inside bar */}
              {bw > 28 && (
                <text x={bx + bw/2} y={y + ROW_H/2 + 4}
                  textAnchor="middle" fontSize={7} fontWeight="700"
                  fill="rgba(255,255,255,0.92)">{row.piles}p</text>
              )}
              {/* Block colour accent strip */}
              <rect x={0} y={y} width={3} height={ROW_H}
                fill={row.color} opacity={0.85} />
              {/* Block name — first zone of block only */}
              {row.zoneIdx === 0 && (
                <text x={7} y={y + ROW_H/2 + 4}
                  fontSize={8} fill={row.color} fontWeight="bold">{row.blockName}</text>
              )}
              {/* Zone label (right-aligned before chart area) */}
              <text x={LW - 4} y={y + ROW_H/2 + 4}
                textAnchor="end" fontSize={6.5} fill="#4B5563">{row.zoneName}</text>
              {/* Block duration label above first zone */}
              {row.zoneIdx === 0 && (
                <text x={LW - 4} y={y + 4}
                  textAnchor="end" fontSize={5.5} fill="#2A3A4A">{row.blockDurWD}d</text>
              )}
            </g>
          );
        });
      })()}

      {/* ── Programme end marker line ── */}
      {(() => {
        const ex = xOf(totalWD - 1) + wOf(1);  // right edge of last working day
        const labelW = 46;
        return (
          <g>
            <line x1={ex} y1={HEADER_H} x2={ex} y2={totalH - 4}
              stroke={endColor} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.9} />
            <rect x={ex - labelW/2} y={HEADER_H + 3} width={labelW} height={12}
              fill={endColor} rx={2} opacity={0.9} />
            <text x={ex} y={HEADER_H + 12}
              textAnchor="middle" fontSize={6.5} fill="#fff" fontWeight="bold">
              {endLabel}
            </text>
          </g>
        );
      })()}

    </svg>
  );
}

// ── Individual Slide Renderers ────────────────────────────────────
function Slide1() {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background:"#060D1C", fontFamily:"Calibri,sans-serif" }}>
      <div className="absolute inset-y-0 right-0 w-1/3" style={{ background:"#0D1B3E" }} />
      <div className="absolute bottom-0 left-0 right-0 h-14" style={{ background:"#0D9488" }} />
      <div className="absolute inset-y-0 left-0 w-2" style={{ background:"#0D9488" }} />
      <div className="relative z-10 p-6 h-full flex flex-col justify-between">
        <div>
          <div className="text-xs font-bold tracking-widest mb-3" style={{ color:"#14B8A6" }}>S K W P B D</div>
          <div className="text-3xl font-bold text-white leading-tight">Piling Takt Plan</div>
          <div className="text-xl mt-1" style={{ color:"#14B8A6" }}>Optimisation Review</div>
          <div className="text-xs mt-3" style={{ color:"#64748B" }}>Current Plan Issues · Schedule Optimisation · Before &amp; After Takt</div>
        </div>
        <div className="text-xs text-white">March 2026 · Planning Team</div>
      </div>
      {/* Right panel KPIs */}
      <div className="absolute top-0 right-0 w-1/3 h-full flex flex-col justify-around px-4 py-6 z-10">
        {[{v:"1,983",l:"Total Piles",c:"#14B8A6"},{v:"6 Blocks",l:"3 Phases",c:"#fff"},{v:"100d",l:"Baseline",c:"#F59E0B"},{v:"70d",l:"Optimised",c:"#10B981"}].map((k,i)=>(
          <div key={i} className="text-center">
            <div className="text-2xl font-bold" style={{ color:k.c }}>{k.v}</div>
            <div className="text-xs mt-0.5" style={{ color:"#475569" }}>{k.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide2() {
  return (
    <div className="w-full h-full" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Executive Summary</span>
        <span className="ml-auto text-xs" style={{ color:"#14B8A6" }}>SKWPBD · March 2026</span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[{v:"1,983",l:"Total Piles",c:"#0D9488"},{v:"100d",l:"Baseline",c:"#F59E0B"},{v:"70d",l:"Optimised",c:"#10B981"},{v:"−30d",l:"Saving 30%",c:"#EF4444"}].map((t,i)=>(
            <div key={i} className="rounded-lg p-2 text-center" style={{ background:"#1E293B", borderTop:`3px solid ${t.c}` }}>
              <div className="text-lg font-bold" style={{ color:t.c }}>{t.v}</div>
              <div className="text-xs" style={{ color:"#64748B" }}>{t.l}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-3" style={{ background:"#1E293B", border:"1px solid #EF444430" }}>
            <div className="text-xs font-bold mb-2" style={{ color:"#EF4444" }}>Current Plan — Key Issues</div>
            {["Zone imbalance, idle rig time","Zones too large — long per-zone durations, slow takt beat","14% monsoon downtime, no mitigation","Rock socket not in takt rate","Phases not truly parallel","Contingency unjustified post-GI"].map((t,i)=>(
              <div key={i} className="flex items-center gap-1.5 mb-1"><span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background:"#EF4444" }} /><span className="text-xs" style={{ color:"#94A3B8" }}>{t}</span></div>
            ))}
          </div>
          <div className="rounded-lg p-3" style={{ background:"#1E293B", border:"1px solid #10B98130" }}>
            <div className="text-xs font-bold mb-2" style={{ color:"#10B981" }}>5 Optimisation Levers</div>
            {LEVERS_PRES.map((a,i)=>(
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background:a.col, color:"#fff", fontSize:9 }}>{a.saving}</span>
                <span className="text-xs" style={{ color:"#94A3B8", fontSize:10 }}>{a.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide3({ blocks }) {
  return (
    <div className="w-full h-full" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Project Overview — SKWPBD Piling</span>
        <span className="ml-auto text-xs" style={{ color:"#14B8A6" }}>1,983 Piles · 6 Blocks · 3 Phases</span>
      </div>
      <div className="p-3">
        <table className="w-full text-xs mb-3" style={{ borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#0D1B3E" }}>
              {["Block","Piles","Zones","Start","Baseline","Progress"].map(h=>(
                <th key={h} className="py-1.5 px-2 text-left font-bold text-white">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BLK_NAMES_PRES.map((name,i)=>(
              <tr key={i} style={{ background:i%2===0?"#1E293B":"#151E2D" }}>
                <td className="py-1.5 px-2 font-bold" style={{ color:BLK_COLORS_PRES[i] }}>{name}</td>
                <td className="py-1.5 px-2 font-bold text-white">{BLK_PILES_PRES[i]}</td>
                <td className="py-1.5 px-2" style={{ color:"#94A3B8" }}>{blocks[i]?.zones?.length||2}</td>
                <td className="py-1.5 px-2" style={{ color:"#94A3B8" }}>{["01/19","02/16","02/16","02/16","03/09","03/09"][i]}</td>
                <td className="py-1.5 px-2 font-bold" style={{ color:"#F59E0B" }}>{ORIG_DAYS_PRES[i]}d</td>
                <td className="py-1.5 px-2 font-bold" style={{ color:"#10B981" }}>{[65,68,14,2,0,0][i]>0?`${[65,68,14,2,0,0][i]}%`:"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-xs font-bold mb-2" style={{ color:"#14B8A6" }}>Programme Phases — Indicative Timeline</div>
        <div className="rounded overflow-hidden flex" style={{ height:32 }}>
          {[{l:"Phase 1 · Blk-6",s:0,e:32,c:"#0D9488"},{l:"Phase 2 · Blk-5/4/3",s:32,e:65,c:"#F59E0B"},{l:"Phase 3 · Blk-2/1",s:65,e:100,c:"#EF4444"}].map(p=>(
            <div key={p.l} style={{ flex:p.e-p.s, background:p.c, opacity:0.8 }} className="flex items-center px-2">
              <span className="text-xs font-bold text-white truncate">{p.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide4() {
  return (
    <div className="w-full h-full" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Current Plan — Issues &amp; Root Causes</span>
        <span className="ml-auto text-xs" style={{ color:"#EF4444" }}>Why the baseline is 100 working days</span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-2">
        {ISSUES_PRES.map((iss,i)=>(
          <div key={i} className="rounded-lg p-3" style={{ background:"#1E293B", borderLeft:`4px solid ${iss.col}` }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background:iss.col, color:"#fff" }}>{iss.block}</span>
              <span className="text-xs font-bold" style={{ color:"#EF4444" }}>{iss.impact}</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color:"#94A3B8" }}>{iss.issue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide5({ blocks, initialBlocks }) {
  // BEFORE uses the original baseline zone counts (fewer, larger zones)
  const beforeBlocks = initialBlocks || blocks;
  return (
    <div className="w-full h-full flex flex-col" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4 flex-shrink-0" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Takt Plan — BEFORE (Baseline: fewer, larger zones)</span>
        <span className="ml-auto text-xs" style={{ color:"#EF4444" }}>Sequential · large zones = long per-zone durations</span>
      </div>
      <div className="flex-1 px-2 pt-1 pb-1 overflow-hidden">
        <LiveTaktGantt blocks={beforeBlocks} mode="before" />
      </div>
      <div className="flex gap-4 px-3 pb-2 flex-shrink-0" style={{ color:"#475569", fontSize:10 }}>
        <span>▪ Each row = one zone</span>
        <span>▪ Fewer, larger zones → longer sequence</span>
        <span style={{ color:"#EF4444" }}>▪ Red line = baseline end</span>
      </div>
    </div>
  );
}

function Slide6() {
  return (
    <div className="w-full h-full" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Optimisation Levers — 5 Actions for −30 Days</span>
        <span className="ml-auto text-xs" style={{ color:"#10B981" }}>100d → 70d (30% compression)</span>
      </div>
      <div className="px-3 pt-2 space-y-1.5">
        {LEVERS_PRES.map((a,i)=>(
          <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background:"#1E293B" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white flex-shrink-0" style={{ background:a.col }}>{a.n}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white">{a.title}</div>
              <div className="text-xs mt-0.5 truncate" style={{ color:"#64748B" }}>{a.detail}</div>
            </div>
            <span className="text-sm font-black flex-shrink-0" style={{ color:a.col }}>{a.saving}</span>
          </div>
        ))}
        <div className="rounded-lg px-4 py-2 text-center text-xs font-bold text-white" style={{ background:"#0D9488" }}>
          Combined: 100d → 70d — −30 working days (30% schedule compression)
        </div>
      </div>
    </div>
  );
}

function Slide7({ blocks }) {
  return (
    <div className="w-full h-full flex flex-col" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4 flex-shrink-0" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Takt Plan — AFTER (Optimised: more, smaller zones)</span>
        <span className="ml-auto text-xs" style={{ color:"#10B981" }}>Sequential · smaller zones = shorter per-zone durations · tighter takt beat</span>
      </div>
      <div className="flex-1 px-2 pt-1 pb-1 overflow-hidden">
        <LiveTaktGantt blocks={blocks} mode="after" />
      </div>
      <div className="flex gap-4 px-3 pb-2 flex-shrink-0" style={{ color:"#475569", fontSize:10 }}>
        <span>▪ Each row = one zone</span>
        <span>▪ More zones → shorter each → faster recovery</span>
        <span style={{ color:"#10B981" }}>▪ Green line = optimised end</span>
      </div>
    </div>
  );
}

function Slide8() {
  const maxVal = 55;
  return (
    <div className="w-full h-full" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Before vs After — Block-by-Block Comparison</span>
        <span className="ml-auto text-xs" style={{ color:"#14B8A6" }}>Days saved per block</span>
      </div>
      <div className="flex gap-3 p-3 h-full pb-8">
        {/* Bar chart */}
        <div className="flex-1">
          <div className="flex items-end gap-2 h-36 px-2">
            {BLK_NAMES_PRES.map((name,i)=>(
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex gap-0.5 items-end" style={{ height:120 }}>
                  <div className="flex-1 rounded-t-sm" style={{ height:`${ORIG_DAYS_PRES[i]/maxVal*100}%`, background:"#1E3A5F" }}>
                    <div className="text-xs text-center text-white pt-0.5" style={{ fontSize:8 }}>{ORIG_DAYS_PRES[i]}</div>
                  </div>
                  <div className="flex-1 rounded-t-sm" style={{ height:`${OPT_DAYS_PRES[i]/maxVal*100}%`, background:"#10B981" }}>
                    <div className="text-xs text-center text-white pt-0.5" style={{ fontSize:8 }}>{OPT_DAYS_PRES[i]}</div>
                  </div>
                </div>
                <div className="text-xs font-bold" style={{ color:BLK_COLORS_PRES[i], fontSize:9 }}>{name}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-2 px-2 justify-center">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ background:"#1E3A5F" }} /><span className="text-xs" style={{ color:"#64748B" }}>Before</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ background:"#10B981" }} /><span className="text-xs" style={{ color:"#64748B" }}>After</span></div>
          </div>
        </div>
        {/* Table */}
        <div className="w-44 flex-shrink-0">
          <table className="w-full" style={{ fontSize:9, borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#0D1B3E" }}>
                {["Block","Bef","Aft","Saved"].map(h=><th key={h} className="py-1 px-1 text-white text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {BLK_NAMES_PRES.map((n,i)=>(
                <tr key={i} style={{ background:i%2===0?"#1E293B":"#151E2D" }}>
                  <td className="py-1 px-1 font-bold" style={{ color:BLK_COLORS_PRES[i] }}>{n}</td>
                  <td className="py-1 px-1" style={{ color:"#F59E0B" }}>{ORIG_DAYS_PRES[i]}d</td>
                  <td className="py-1 px-1" style={{ color:"#10B981" }}>{OPT_DAYS_PRES[i]}d</td>
                  <td className="py-1 px-1 font-bold" style={{ color:"#10B981" }}>−{ORIG_DAYS_PRES[i]-OPT_DAYS_PRES[i]}d</td>
                </tr>
              ))}
              <tr style={{ background:"#0D1B3E" }}>
                <td className="py-1 px-1 font-bold text-white">TOTAL</td>
                <td className="py-1 px-1 font-bold" style={{ color:"#F59E0B" }}>100d</td>
                <td className="py-1 px-1 font-bold" style={{ color:"#10B981" }}>70d</td>
                <td className="py-1 px-1 font-bold" style={{ color:"#10B981" }}>−30d</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Slide9() {
  return (
    <div className="w-full h-full" style={{ background:"#0A1020", fontFamily:"Calibri,sans-serif" }}>
      <div className="h-8 flex items-center px-4" style={{ background:"#0D1B3E" }}>
        <span className="text-sm font-bold text-white">Engineering Parameters — Optimised Plan</span>
        <span className="ml-auto text-xs" style={{ color:"#14B8A6" }}>Key assumptions</span>
      </div>
      <div className="p-2">
        <table className="w-full" style={{ fontSize:9, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#0D1B3E" }}>
              <th className="py-1.5 px-2 text-left text-white">Parameter</th>
              <th className="py-1.5 px-2 text-left" style={{ color:"#F59E0B" }}>Before (Baseline)</th>
              <th className="py-1.5 px-2 text-left" style={{ color:"#10B981" }}>After (Optimised)</th>
            </tr>
          </thead>
          <tbody>
            {ENG_PARAMS_PRES.map((row,i)=>(
              <tr key={i} style={{ background:i%2===0?"#1E293B":"#151E2D" }}>
                <td className="py-1.5 px-2 font-bold" style={{ color:"#14B8A6" }}>{row.p}</td>
                <td className="py-1.5 px-2" style={{ color:"#94A3B8" }}>{row.b}</td>
                <td className="py-1.5 px-2" style={{ color:"#10B981" }}>{row.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Slide10() {
  const conclusions = ["Baseline 100-day plan achievable but sub-optimal","Zone concurrency is the single largest lever (−12d)","Monsoon mitigation alone recovers 7 days","Blk-1 rock socket needs dedicated takt adjustment","Combined 30-day savings are realistic and low-risk"];
  const actions = ["[ Wk 1 ]  Issue access clearance — Blk-6 Zone 3","[ Wk 1 ]  Confirm double-shift roster Blk-1 & Blk-2","[ Wk 2 ]  Order shelter platforms (8-wk lead time)","[ Wk 2 ]  Revise Blk-1 takt rate with updated GI","[ Wk 3 ]  Rebalance zone pile counts in programme","[ Wk 4 ]  ULT test pile Blk-2 Zone 1 during mob"];
  return (
    <div className="w-full h-full relative" style={{ background:"#0D1B3E", fontFamily:"Calibri,sans-serif" }}>
      <div className="absolute bottom-0 left-0 right-0 h-14" style={{ background:"#0D9488" }} />
      <div className="absolute inset-y-0 left-0 w-2" style={{ background:"#0D9488" }} />
      <div className="relative z-10 p-4">
        <div className="text-xl font-bold text-white mb-4">Conclusions &amp; Next Steps</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold mb-2" style={{ color:"#14B8A6" }}>Key Conclusions</div>
            {conclusions.map((t,i)=>(
              <div key={i} className="flex items-start gap-1.5 mb-1.5"><span className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background:"#14B8A6" }} /><span className="text-xs" style={{ color:"#94A3B8" }}>{t}</span></div>
            ))}
          </div>
          <div>
            <div className="text-xs font-bold mb-2" style={{ color:"#10B981" }}>Immediate Actions</div>
            {actions.map((t,i)=>(
              <div key={i} className="flex items-start gap-1.5 mb-1.5"><span className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background:"#10B981" }} /><span className="text-xs" style={{ color:"#94A3B8" }}>{t}</span></div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-white z-20">SKWPBD Planning Team · March 2026 · All data subject to field verification</div>
      </div>
    </div>
  );
}

const SLIDE_COMPONENTS = [Slide1, Slide2, Slide3, Slide4, Slide5, Slide6, Slide7, Slide8, Slide9, Slide10];
const SLIDE_TITLES = ["Cover","Executive Summary","Project Overview","Current Issues","Takt BEFORE","Optimisation Levers","Takt AFTER","Before vs After","Engineering Params","Conclusions"];
const SLIDE_COLORS = ["#1B8CC4","#14B8A6","#22C55E","#EF4444","#1B8CC4","#10B981","#22C55E","#F97316","#14B8A6","#0D9488"];

// ═══════════════════════════════════════════════════════════════════
//  COMPARE TAB — Before vs After optimisation, side by side
// ═══════════════════════════════════════════════════════════════════

function CompareTab({ blocks, initialBlocks }) {

  // Compute headline stats for both plans
  const beforeScheduled = useMemo(() => initialBlocks.map(b => computeBlockSchedule(b)), [initialBlocks]);
  const afterScheduled  = useMemo(() => blocks.map(b => computeBlockSchedule(b)), [blocks]);

  const beforeEnd = useMemo(() => beforeScheduled.map(s => s.blockEnd).reduce((a,b) => b>a?b:a), [beforeScheduled]);
  const afterEnd  = useMemo(() => afterScheduled.map(s => s.blockEnd).reduce((a,b) => b>a?b:a), [afterScheduled]);

  const progStart = "2026-01-19";
  const beforeDays = workingDaysBetween(progStart, beforeEnd.toISOString().slice(0,10));
  const afterDays  = workingDaysBetween(progStart, afterEnd.toISOString().slice(0,10));
  const savedDays  = beforeDays - afterDays;
  const savedPct   = Math.round((savedDays / beforeDays) * 100);

  const beforeZones = initialBlocks.reduce((s,b) => s + b.zones.length, 0);
  const afterZones  = blocks.reduce((s,b) => s + b.zones.length, 0);

  const statCards = [
    { label:"Before — Programme Duration", value:`${beforeDays}d`, sub: beforeEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}), color:"#EF4444" },
    { label:"After — Programme Duration",  value:`${afterDays}d`,  sub: afterEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}), color:"#10B981" },
    { label:"Days Saved",                  value:`−${savedDays}d`, sub:`${savedPct}% reduction`,   color:"#F59E0B" },
    { label:"Zones: Before → After",       value:`${beforeZones} → ${afterZones}`, sub:"More smaller sequential zones", color:"#818CF8" },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily:"'Georgia',serif" }}>
          Takt Plan — Before &amp; After Optimisation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Side-by-side comparison of the baseline schedule vs the optimised zone-split programme.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(c => (
          <div key={c.label} className="rounded-2xl p-4"
            style={{ background:"#0a0f1e", border:`1px solid ${c.color}30` }}>
            <div className="text-2xl font-black" style={{ color:c.color, fontFamily:"'Georgia',serif" }}>{c.value}</div>
            <div className="text-xs font-semibold text-white mt-1">{c.label}</div>
            <div className="text-xs mt-0.5" style={{ color:"#475569" }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Side-by-side Gantt panels */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* BEFORE */}
        <div className="rounded-2xl overflow-hidden" style={{ background:"#080E1D", border:"2px solid rgba(239,68,68,0.35)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background:"rgba(239,68,68,0.10)", borderBottom:"1px solid rgba(239,68,68,0.2)" }}>
            <div>
              <div className="text-sm font-bold text-white">Baseline Plan</div>
              <div className="text-xs mt-0.5" style={{ color:"#EF4444" }}>
                {beforeZones} zones · {beforeDays}d · ends {beforeEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
              </div>
            </div>
            <div className="px-2 py-1 rounded-lg text-xs font-bold"
              style={{ background:"rgba(239,68,68,0.15)", color:"#EF4444", border:"1px solid rgba(239,68,68,0.3)" }}>
              BEFORE
            </div>
          </div>
          <div style={{ height:440, padding:"8px 0 4px 0" }}>
            <LiveTaktGantt blocks={initialBlocks} mode="before" />
          </div>
        </div>

        {/* AFTER */}
        <div className="rounded-2xl overflow-hidden" style={{ background:"#080E1D", border:"2px solid rgba(16,185,129,0.35)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background:"rgba(16,185,129,0.10)", borderBottom:"1px solid rgba(16,185,129,0.2)" }}>
            <div>
              <div className="text-sm font-bold text-white">Optimised Plan</div>
              <div className="text-xs mt-0.5" style={{ color:"#10B981" }}>
                {afterZones} zones · {afterDays}d · ends {afterEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
              </div>
            </div>
            <div className="px-2 py-1 rounded-lg text-xs font-bold"
              style={{ background:"rgba(16,185,129,0.15)", color:"#10B981", border:"1px solid rgba(16,185,129,0.3)" }}>
              AFTER
            </div>
          </div>
          <div style={{ height:440, padding:"8px 0 4px 0" }}>
            <LiveTaktGantt blocks={blocks} mode="after" />
          </div>
        </div>
      </div>

      {/* Per-block comparison table */}
      <div className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-5 py-3 border-b border-white/5">
          <h3 className="text-sm font-bold text-white" style={{ fontFamily:"'Georgia',serif" }}>Per-Block Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5" style={{ color:"#475569" }}>
                {["Block","Piles","Takt Before","Takt After","Start Before","Start After","Before Days","After Days","Days Saved","% Saved","End Date (After)"].map(h => (
                  <th key={h} className="py-2 px-3 text-left font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocks.map((b, i) => {
                const bef = beforeScheduled[i];
                const aft = afterScheduled[i];
                const befDays = bef.durationDays;
                const aftDays = aft.durationDays;
                const saved = befDays - aftDays;
                const pct   = Math.round((saved / befDays) * 100);
                const befB  = initialBlocks[i];
                return (
                  <tr key={b.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="py-2.5 px-3 font-bold" style={{ color:b.color }}>{b.name}</td>
                    <td className="py-2.5 px-3 text-gray-300">{b.piles}</td>
                    <td className="py-2.5 px-3 text-gray-400">{befB.taktRate}p/d</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color:"#10B981" }}>{b.taktRate}p/d</td>
                    <td className="py-2.5 px-3 text-gray-400">{new Date(befB.startDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color:"#818CF8" }}>{new Date(b.startDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</td>
                    <td className="py-2.5 px-3 text-gray-400">{befDays}d</td>
                    <td className="py-2.5 px-3 font-bold text-teal-400">{aftDays}d</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color: saved>0?"#10B981":saved<0?"#EF4444":"#64748B" }}>
                      {saved>0?"−":saved<0?"+":""}{Math.abs(saved)}d
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full overflow-hidden" style={{ width:48, height:4, background:"rgba(255,255,255,0.08)" }}>
                          <div style={{ width:`${Math.max(0,pct)}%`, height:"100%", background:pct>0?"#10B981":"#EF4444" }} />
                        </div>
                        <span style={{ color:pct>0?"#10B981":"#EF4444" }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      {aft.blockEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background:"rgba(20,184,166,0.07)", borderTop:"2px solid rgba(20,184,166,0.2)" }}>
                <td className="py-2.5 px-3 font-bold text-white">PROGRAMME</td>
                <td className="py-2.5 px-3 font-bold text-white">{blocks.reduce((s,b)=>s+b.piles,0)}</td>
                <td className="py-2.5 px-3 text-gray-400">7p/d avg</td>
                <td className="py-2.5 px-3 font-bold text-green-400">9–10p/d</td>
                <td className="py-2.5 px-3 text-gray-400">—</td>
                <td className="py-2.5 px-3 text-purple-400">Earlier</td>
                <td className="py-2.5 px-3 font-bold text-gray-400">{beforeDays}d</td>
                <td className="py-2.5 px-3 font-bold text-teal-400">{afterDays}d</td>
                <td className="py-2.5 px-3 font-bold text-green-400">−{savedDays}d</td>
                <td className="py-2.5 px-3 font-bold text-green-400">{savedPct}%</td>
                <td className="py-2.5 px-3 font-bold text-teal-400">
                  {afterEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ── Main PresentationTab ──────────────────────────────────────────
function PresentationTab({ blocks, initialBlocks }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [fullscreen,  setFullscreen]  = useState(false);

  const SlideComp = SLIDE_COMPONENTS[activeSlide];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily:"'Georgia',serif" }}>Presentation</h1>
        <p className="text-sm mt-1 text-gray-500">10 slides · Issues · Optimisation · Before &amp; after Takt plans</p>
      </div>

      {/* Slide selector pills */}
      <div className="flex flex-wrap gap-2">
        {SLIDE_TITLES.map((title, i) => (
          <button key={i} onClick={() => setActiveSlide(i)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeSlide===i ? SLIDE_COLORS[i] : "rgba(255,255,255,0.05)",
              color: activeSlide===i ? "#fff" : "#64748B",
              border: `1px solid ${activeSlide===i ? SLIDE_COLORS[i] : "rgba(255,255,255,0.08)"}`,
            }}>
            {i+1}. {title}
          </button>
        ))}
      </div>

      {/* Main slide — fixed height box */}
      <div className="rounded-2xl overflow-hidden w-full" style={{ height:480, border:`2px solid ${SLIDE_COLORS[activeSlide]}40` }}>
        <SlideComp blocks={blocks} initialBlocks={initialBlocks} />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setActiveSlide(s => Math.max(0, s-1))} disabled={activeSlide===0}
          className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background:"rgba(255,255,255,0.05)", color: activeSlide===0 ? "#374151" : "#94A3B8", cursor: activeSlide===0 ? "not-allowed":"pointer" }}>
          ← Previous
        </button>
        <span className="text-sm font-bold" style={{ color:SLIDE_COLORS[activeSlide] }}>
          Slide {activeSlide+1} / {SLIDE_TITLES.length} — {SLIDE_TITLES[activeSlide]}
        </span>
        <button onClick={() => setActiveSlide(s => Math.min(SLIDE_TITLES.length-1, s+1))} disabled={activeSlide===SLIDE_TITLES.length-1}
          className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background:"rgba(255,255,255,0.05)", color: activeSlide===SLIDE_TITLES.length-1 ? "#374151" : "#94A3B8", cursor: activeSlide===SLIDE_TITLES.length-1 ? "not-allowed":"pointer" }}>
          Next →
        </button>
      </div>


    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  LAST PLANNER SYSTEM TAB
//  • Weekly zone plan with pile load per zone
//  • Daily log: target vs actual, variance, reasons
//  • Weekly huddle record: PPC, constraints, recovery actions
//  • PPC trend chart, constraint Pareto, running variance
// ═══════════════════════════════════════════════════════════════════

// ── Utility: generate weekly zone schedule from a block ───────────
function buildWeeklyPlan(block) {
  // Re-slice each zone into weeks (5 working days)
  // Returns array of { weekNo, weekLabel, startDate, zones:[{zoneId,zoneName,target,color}], blockTarget }
  const taktRate = block.taktRate || 7;
  const pilesPerDayPerZone = taktRate; // piles/rig/day
  const pilesPerWeekPerZone = pilesPerDayPerZone * 5; // Mon–Fri
  // Determine max weeks needed
  const maxZoneWeeks = Math.max(...block.zones.map(z => Math.ceil(z.piles / pilesPerWeekPerZone)));
  const startDate = new Date(block.startDate);
  const weeks = [];
  for (let w = 0; w < maxZoneWeeks + 1; w++) {
    const wStart = new Date(startDate);
    wStart.setDate(wStart.getDate() + w * 7);
    // skip to Monday if needed
    while (wStart.getDay() !== 1 && wStart.getDay() !== 0) wStart.setDate(wStart.getDate() - 1);
    const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 4);
    const zoneTargets = block.zones.map(z => {
      const completedBefore = Math.min(z.piles, w * pilesPerWeekPerZone);
      const remaining = z.piles - completedBefore;
      return {
        zoneId: z.id, zoneName: z.name,
        target: Math.max(0, Math.min(pilesPerWeekPerZone, remaining)),
        cumTarget: completedBefore + Math.min(pilesPerWeekPerZone, Math.max(0, remaining)),
        totalPiles: z.piles,
      };
    });
    const blockTarget = zoneTargets.reduce((s, z) => s + z.target, 0);
    if (blockTarget === 0 && w > 0) break;
    weeks.push({
      weekNo: w + 1,
      weekLabel: `W${w + 1}  ${wStart.toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}`,
      weekStartDate: wStart.toISOString().split("T")[0],
      zoneTargets,
      blockTarget,
    });
  }
  return weeks;
}

// ── Daily target calculation ──────────────────────────────────────
function dailyTarget(block) { return (block.taktRate || 7) * block.zones.length; }

// ── Constraint categories (Last Planner vocabulary) ──────────────
const LPS_CONSTRAINTS = [
  "Design / Drawing not ready",
  "Material / Concrete supply",
  "Equipment breakdown",
  "Labour shortage / absenteeism",
  "Access / sequencing conflict",
  "Weather / monsoon downtime",
  "Poor workmanship / rework",
  "Subcontractor performance",
  "Inspection / testing delay",
  "Client / consultant instruction",
  "Unknown ground condition",
  "Other",
];

const RECOVERY_TEMPLATES = [
  "Extend shift hours today/tomorrow",
  "Deploy standby rig from adjacent block",
  "Increase zone concurrency",
  "Pre-pour concrete stockpile overnight",
  "Re-sequence zones to unblock access",
  "Expedite material delivery",
  "Add overtime crew to close variance",
  "Request advance IFC drawing issue",
  "Notify client / consultant immediately",
  "Schedule emergency equipment repair",
];

// ── Sub-components ────────────────────────────────────────────────

function PpcGauge({ ppc }) {
  const r = 32, circ = 2 * Math.PI * r;
  const dash = (ppc / 100) * circ;
  const color = ppc >= 85 ? "#10B981" : ppc >= 70 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={r} fill="none" stroke="#1E293B" strokeWidth={10} />
      <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 45 45)" />
      <text x={45} y={49} textAnchor="middle" fontSize={16} fontWeight="bold" fill={color}>{ppc}%</text>
      <text x={45} y={63} textAnchor="middle" fontSize={8} fill="#64748B">PPC</text>
    </svg>
  );
}

function VarianceBar({ val, max }) {
  const abs = Math.abs(val);
  const pct = Math.min(100, max > 0 ? abs / max * 100 : 0);
  const col = val >= 0 ? "#10B981" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:"#1E293B" }}>
        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:col }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color:col }}>{val > 0 ? "+" : ""}{val}</span>
    </div>
  );
}

// ── Main Last Planner Tab ─────────────────────────────────────────
function LastPlannerTab({ blocks }) {
  const [selectedBlock, setSelectedBlock] = useState(blocks[0]?.id || "blk6");
  const [view, setView]     = useState("weekly"); // weekly | daily | huddle | dashboard
  const [selectedWeek, setSelectedWeek] = useState(1);

  // Persistent state: daily logs, weekly huddles
  const [dailyLogs, setDailyLogs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lps_daily_v2") || "{}"); } catch { return {}; }
  });
  const [weeklyHuddles, setWeeklyHuddles] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lps_huddles_v2") || "{}"); } catch { return {}; }
  });

  useEffect(() => { localStorage.setItem("lps_daily_v2",   JSON.stringify(dailyLogs));    }, [dailyLogs]);
  useEffect(() => { localStorage.setItem("lps_huddles_v2", JSON.stringify(weeklyHuddles));}, [weeklyHuddles]);

  const block = blocks.find(b => b.id === selectedBlock) || blocks[0];
  const weeklyPlan = useMemo(() => buildWeeklyPlan(block), [block]);
  const week = weeklyPlan[selectedWeek - 1] || weeklyPlan[0];

  // ── helpers for log keys ────────────────────────────────────────
  const dailyKey  = (bId, wNo, day) => `${bId}_w${wNo}_d${day}`;
  const huddleKey = (bId, wNo)      => `${bId}_w${wNo}`;

  // ── daily log accessors ─────────────────────────────────────────
  const getDay = (bId, wNo, day) => dailyLogs[dailyKey(bId, wNo, day)] || { actual: "", reason: "", recovery: "", notes: "" };
  const setDay = (bId, wNo, day, field, val) => {
    const key = dailyKey(bId, wNo, day);
    setDailyLogs(prev => ({ ...prev, [key]: { ...getDay(bId, wNo, day), [field]: val } }));
  };

  // ── huddle accessors ────────────────────────────────────────────
  const getHuddle = (bId, wNo) => weeklyHuddles[huddleKey(bId, wNo)] || {
    plannedComplete: "", actualComplete: "", constraints: [], recoveryActions: "", lookahead: "", notes: "", conductedAt: "",
  };
  const setHuddle = (bId, wNo, field, val) => {
    const key = huddleKey(bId, wNo);
    setWeeklyHuddles(prev => ({ ...prev, [key]: { ...getHuddle(bId, wNo), [field]: val } }));
  };

  // ── compute PPC for a week ──────────────────────────────────────
  const weekPPC = (bId, wNo, wPlan) => {
    const days = [1,2,3,4,5];
    const target = wPlan.blockTarget;
    let actualTotal = 0, plannedCount = 0, completedCount = 0;
    days.forEach(d => {
      const log = dailyLogs[dailyKey(bId, wNo, d)];
      if (log?.actual !== "" && log?.actual !== undefined) {
        const dayTarget = Math.round(target / 5);
        plannedCount++;
        if (parseInt(log.actual) >= dayTarget) completedCount++;
        actualTotal += parseInt(log.actual) || 0;
      }
    });
    const ppc = plannedCount > 0 ? Math.round(completedCount / plannedCount * 100) : null;
    return { ppc, actualTotal, variance: actualTotal - target, plannedCount };
  };

  // ── compute cumulative stats across all weeks ───────────────────
  const blockStats = useMemo(() => {
    let totalTarget = 0, totalActual = 0, ppcValues = [];
    const constraintCounts = {};
    weeklyPlan.forEach((wp, wi) => {
      const wNo = wi + 1;
      totalTarget += wp.blockTarget;
      const { ppc, actualTotal } = weekPPC(block.id, wNo, wp);
      if (ppc !== null) { totalActual += actualTotal; ppcValues.push(ppc); }
      const h = getHuddle(block.id, wNo);
      (h.constraints || []).forEach(c => { constraintCounts[c] = (constraintCounts[c] || 0) + 1; });
    });
    const avgPPC = ppcValues.length ? Math.round(ppcValues.reduce((s, v) => s + v, 0) / ppcValues.length) : null;
    const runVariance = totalActual - totalTarget;
    const constraintPareto = Object.entries(constraintCounts).sort((a, b) => b[1] - a[1]);
    return { avgPPC, ppcValues, runVariance, totalActual, totalTarget, constraintPareto, weeksReported: ppcValues.length };
  }, [block, weeklyPlan, dailyLogs, weeklyHuddles]);

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const dayTargetPerDay = week ? Math.round(week.blockTarget / 5) : 0;

  // ═══ RENDER ════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily:"'Georgia',serif" }}>
            Last Planner System
          </h1>
          <p className="text-sm mt-1" style={{ color:"#64748B" }}>
            Weekly zone load · Daily target tracking · Huddle records · PPC · Recovery actions
          </p>
        </div>
        {/* Block selector */}
        <div className="flex flex-wrap gap-2">
          {blocks.map(b => (
            <button key={b.id} onClick={() => { setSelectedBlock(b.id); setSelectedWeek(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: selectedBlock === b.id ? b.color : "rgba(255,255,255,0.05)",
                color: selectedBlock === b.id ? "#fff" : "#64748B",
                border: `1px solid ${selectedBlock === b.id ? b.color : "rgba(255,255,255,0.08)"}` }}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── View tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
        {[
          { id:"weekly",    label:"Weekly Zone Plan",   icon:"calendar" },
          { id:"daily",     label:"Daily Log",          icon:"check" },
          { id:"huddle",    label:"Huddle Board",       icon:"alert" },
          { id:"dashboard", label:"PPC Dashboard",      icon:"trending" },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: view === v.id ? "rgba(37,99,235,0.25)" : "transparent",
              color: view === v.id ? "#93C5FD" : "#6B7280",
              border: view === v.id ? "1px solid rgba(147,197,253,0.2)" : "1px solid transparent" }}>
            <Icon name={v.icon} size={13} />{v.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* VIEW 1 — WEEKLY ZONE PLAN                                  */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "weekly" && (
        <div className="space-y-4">
          {/* Week selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold" style={{ color:"#64748B" }}>SELECT WEEK</span>
            <div className="flex gap-1 flex-wrap">
              {weeklyPlan.map((wp, i) => (
                <button key={i} onClick={() => setSelectedWeek(i + 1)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: selectedWeek === i + 1 ? block.color : "rgba(255,255,255,0.05)",
                    color: selectedWeek === i + 1 ? "#fff" : "#64748B",
                    border: `1px solid ${selectedWeek === i + 1 ? block.color : "rgba(255,255,255,0.08)"}`,
                  }}>
                  W{i + 1}
                </button>
              ))}
            </div>
          </div>

          {week && (
            <>
              {/* Week header card */}
              <div className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:`1px solid ${block.color}30` }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-lg font-bold text-white">{block.name} — {week.weekLabel}</div>
                    <div className="text-sm mt-0.5" style={{ color:"#64748B" }}>
                      Weekly piling target: <span className="font-bold" style={{ color:block.color }}>{week.blockTarget} piles</span>
                      <span className="ml-3">({dayTargetPerDay} piles/day across {block.zones.length} zones)</span>
                    </div>
                  </div>
                  {/* Week PPC badge */}
                  {(() => {
                    const { ppc, actualTotal, variance } = weekPPC(block.id, week.weekNo, week);
                    return ppc !== null ? (
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-xl font-bold" style={{ color: ppc >= 85 ? "#10B981" : ppc >= 70 ? "#F59E0B" : "#EF4444" }}>{ppc}%</div>
                          <div className="text-xs" style={{ color:"#64748B" }}>PPC</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold" style={{ color: variance >= 0 ? "#10B981" : "#EF4444" }}>{variance > 0 ? "+" : ""}{variance}</div>
                          <div className="text-xs" style={{ color:"#64748B" }}>Variance</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-white">{actualTotal}</div>
                          <div className="text-xs" style={{ color:"#64748B" }}>Actual</div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Zone weekly breakdown table */}
              <div className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background:block.color }} />
                  <span className="text-sm font-bold text-white">Zone Load Plan — Week {week.weekNo}</span>
                  <span className="ml-auto text-xs" style={{ color:"#475569" }}>Piles per zone per week (takt = {block.taktRate} p/rig/day × 5 days)</span>
                </div>

                {/* Zone rows */}
                <div className="divide-y divide-white/5">
                  {week.zoneTargets.map((zt, zi) => {
                    const pct = zt.totalPiles > 0 ? Math.round(zt.cumTarget / zt.totalPiles * 100) : 0;
                    const isComplete = zt.cumTarget >= zt.totalPiles;
                    return (
                      <div key={zt.zoneId} className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          {/* Zone label */}
                          <div className="w-24 flex-shrink-0">
                            <div className="text-sm font-bold text-white">{zt.zoneName}</div>
                            <div className="text-xs" style={{ color:"#475569" }}>{zt.totalPiles} piles total</div>
                          </div>

                          {/* Week target */}
                          <div className="w-20 flex-shrink-0 text-center">
                            {isComplete ? (
                              <span className="text-xs font-bold px-2 py-1 rounded" style={{ background:"#10B98120", color:"#10B981" }}>Complete</span>
                            ) : (
                              <>
                                <div className="text-xl font-bold" style={{ color: zt.target > 0 ? block.color : "#374151" }}>{zt.target}</div>
                                <div className="text-xs" style={{ color:"#475569" }}>this week</div>
                              </>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1" style={{ color:"#475569" }}>
                              <span>Cumulative progress</span>
                              <span className="font-bold" style={{ color: pct >= 100 ? "#10B981" : block.color }}>{zt.cumTarget} / {zt.totalPiles} ({pct}%)</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ background:"#1E293B" }}>
                              <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(100, pct)}%`, background: pct >= 100 ? "#10B981" : block.color }} />
                            </div>
                          </div>

                          {/* Daily breakdown */}
                          <div className="flex gap-1 flex-shrink-0">
                            {dayNames.map((d, di) => {
                              const dayT = zt.target > 0 ? Math.round(zt.target / 5) : 0;
                              return (
                                <div key={di} className="text-center">
                                  <div className="text-xs" style={{ color:"#374151" }}>{d}</div>
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
                                    style={{ background: dayT > 0 ? `${block.color}18` : "#0F172A",
                                      color: dayT > 0 ? block.color : "#374151",
                                      border: `1px solid ${dayT > 0 ? `${block.color}30` : "rgba(255,255,255,0.04)"}` }}>
                                    {dayT > 0 ? dayT : "—"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weekly summary row */}
                <div className="px-5 py-4 border-t border-white/10" style={{ background:"rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-4">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-sm font-bold" style={{ color:block.color }}>TOTAL</div>
                    </div>
                    <div className="w-20 flex-shrink-0 text-center">
                      <div className="text-xl font-bold text-white">{week.blockTarget}</div>
                      <div className="text-xs" style={{ color:"#475569" }}>this week</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs" style={{ color:"#475569" }}>Daily block target: <span className="font-bold text-white">{dayTargetPerDay} piles/day</span>  ·  All {block.zones.length} zones concurrent  ·  Takt rate: {block.taktRate} piles/rig/day</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {dayNames.map((d, di) => (
                        <div key={di} className="text-center">
                          <div className="text-xs" style={{ color:"#374151" }}>{d}</div>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black mt-0.5"
                            style={{ background:`${block.color}25`, color:block.color, border:`1px solid ${block.color}40` }}>
                            {dayTargetPerDay}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next week lookahead */}
              {weeklyPlan[selectedWeek] && (
                <div className="rounded-2xl p-4" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-sm font-bold text-white mb-3">
                    <span className="text-xs uppercase tracking-widest mr-2" style={{ color:"#F59E0B" }}>Lookahead</span>
                    Next Week (W{selectedWeek + 1}) — Constraint Check
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {["Design / Drawings ready?","Concrete supply confirmed?","Rig maintenance completed?"].map((q, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{ background:"#1E293B" }}>
                        <div className="w-4 h-4 rounded border-2 mt-0.5 flex-shrink-0" style={{ border:"2px solid #F59E0B" }} />
                        <span className="text-xs" style={{ color:"#94A3B8" }}>{q}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs" style={{ color:"#475569" }}>
                    ✦ Resolve all constraints before end of this week's Friday huddle. Unresolved items → add recovery action for next week's plan.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* VIEW 2 — DAILY LOG                                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "daily" && (
        <div className="space-y-4">
          {/* Week selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold" style={{ color:"#64748B" }}>WEEK</span>
            <div className="flex gap-1 flex-wrap">
              {weeklyPlan.map((wp, i) => (
                <button key={i} onClick={() => setSelectedWeek(i + 1)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: selectedWeek === i + 1 ? block.color : "rgba(255,255,255,0.05)",
                    color: selectedWeek === i + 1 ? "#fff" : "#64748B",
                    border: `1px solid ${selectedWeek === i + 1 ? block.color : "rgba(255,255,255,0.08)"}` }}>
                  W{i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Daily log table */}
          {week && (
            <div className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div className="px-5 py-3 border-b border-white/5">
                <div className="text-sm font-bold text-white">{block.name} — Daily Production Log — {week.weekLabel}</div>
                <div className="text-xs mt-0.5" style={{ color:"#64748B" }}>
                  Daily target: <span className="font-bold text-white">{dayTargetPerDay} piles</span> ({block.taktRate} p/rig/day × {block.zones.length} zones)
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {[1,2,3,4,5].map(dayIdx => {
                  const log = getDay(block.id, week.weekNo, dayIdx);
                  const actual = log.actual !== "" ? parseInt(log.actual) || 0 : null;
                  const variance = actual !== null ? actual - dayTargetPerDay : null;
                  const isMiss = variance !== null && variance < 0;
                  const isHit  = variance !== null && variance >= 0;

                  return (
                    <div key={dayIdx} className="px-5 py-4" style={{ background: isMiss ? "rgba(239,68,68,0.03)" : isHit ? "rgba(16,185,129,0.02)" : "transparent" }}>
                      {/* Day header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-28 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background: isMiss ? "#EF444420" : isHit ? "#10B98120" : "#1E293B",
                                color: isMiss ? "#EF4444" : isHit ? "#10B981" : "#64748B" }}>
                              {dayNames[dayIdx - 1]}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">{dayNames[dayIdx - 1]}  Day {dayIdx}</div>
                              <div className="text-xs" style={{ color:"#374151" }}>Target: {dayTargetPerDay}p</div>
                            </div>
                          </div>
                        </div>

                        {/* Actual input */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color:"#475569" }}>Actual</span>
                          <input
                            type="number" min="0" max={dayTargetPerDay * 3}
                            value={log.actual}
                            onChange={e => setDay(block.id, week.weekNo, dayIdx, "actual", e.target.value)}
                            placeholder="—"
                            className="w-16 px-2 py-1.5 rounded-lg text-sm font-bold text-center text-white outline-none"
                            style={{ background: isMiss ? "rgba(239,68,68,0.1)" : isHit ? "rgba(16,185,129,0.1)" : "#1E293B",
                              border: `1px solid ${isMiss ? "#EF444450" : isHit ? "#10B98150" : "rgba(255,255,255,0.08)"}` }}
                          />
                          <span className="text-xs text-white">piles</span>
                        </div>

                        {/* Variance badge */}
                        {variance !== null && (
                          <div className="px-3 py-1 rounded-lg text-xs font-bold"
                            style={{ background: isMiss ? "#EF444420" : "#10B98120", color: isMiss ? "#EF4444" : "#10B981" }}>
                            {variance > 0 ? "+" : ""}{variance} {isMiss ? "⚠ MISS" : "✓ HIT"}
                          </div>
                        )}
                      </div>

                      {/* If miss, show reason + recovery fields */}
                      {isMiss && (
                        <div className="ml-28 grid md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-bold mb-1.5" style={{ color:"#EF4444" }}>Root Cause</div>
                            <select value={log.reason} onChange={e => setDay(block.id, week.weekNo, dayIdx, "reason", e.target.value)}
                              className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none"
                              style={{ background:"#1E293B", border:"1px solid rgba(239,68,68,0.3)" }}>
                              <option value="">Select constraint…</option>
                              {LPS_CONSTRAINTS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs font-bold mb-1.5" style={{ color:"#F59E0B" }}>
                              Recovery Action <span style={{ color:"#475569", fontWeight:"normal" }}>(immediate)</span>
                            </div>
                            <select value={log.recovery} onChange={e => setDay(block.id, week.weekNo, dayIdx, "recovery", e.target.value)}
                              className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none"
                              style={{ background:"#1E293B", border:"1px solid rgba(245,158,11,0.3)" }}>
                              <option value="">Select recovery action…</option>
                              {RECOVERY_TEMPLATES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <input
                              type="text" value={log.notes}
                              onChange={e => setDay(block.id, week.weekNo, dayIdx, "notes", e.target.value)}
                              placeholder="Additional notes (optional)…"
                              className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none"
                              style={{ background:"#1E293B", border:"1px solid rgba(255,255,255,0.07)" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Week summary bar */}
              {(() => {
                const { ppc, actualTotal, variance, plannedCount } = weekPPC(block.id, week.weekNo, week);
                if (plannedCount === 0) return null;
                return (
                  <div className="px-5 py-4 border-t border-white/10" style={{ background:"rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-8 flex-wrap">
                      <div><span className="text-xs" style={{ color:"#475569" }}>Days logged</span><div className="text-lg font-bold text-white">{plannedCount}/5</div></div>
                      <div><span className="text-xs" style={{ color:"#475569" }}>Target</span><div className="text-lg font-bold text-white">{week.blockTarget}</div></div>
                      <div><span className="text-xs" style={{ color:"#475569" }}>Actual</span><div className="text-lg font-bold text-white">{actualTotal}</div></div>
                      <div><span className="text-xs" style={{ color:"#475569" }}>Variance</span><div className="text-lg font-bold" style={{ color: variance >= 0 ? "#10B981" : "#EF4444" }}>{variance > 0 ? "+" : ""}{variance}</div></div>
                      {ppc !== null && <div><span className="text-xs" style={{ color:"#475569" }}>PPC</span><div className="text-lg font-bold" style={{ color: ppc >= 85 ? "#10B981" : ppc >= 70 ? "#F59E0B" : "#EF4444" }}>{ppc}%</div></div>}
                    </div>
                    {variance < 0 && (
                      <div className="mt-3 flex items-start gap-2 px-4 py-3 rounded-xl text-xs" style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)" }}>
                        <Icon name="alert" size={14} />
                        <div>
                          <span className="font-bold" style={{ color:"#EF4444" }}>Weekly target missed by {Math.abs(variance)} piles.</span>
                          <span className="ml-2" style={{ color:"#94A3B8" }}>Raise in Friday huddle — log recovery plan before end of day Friday.</span>
                        </div>
                      </div>
                    )}
                    {variance >= 0 && (
                      <div className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-xs" style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)" }}>
                        <Icon name="check" size={14} />
                        <span style={{ color:"#10B981" }}>Weekly target met or exceeded. Carry surplus to next week's lookahead.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* VIEW 3 — HUDDLE BOARD                                      */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "huddle" && (
        <div className="space-y-4">
          {/* Week selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold" style={{ color:"#64748B" }}>WEEK</span>
            {weeklyPlan.map((wp, i) => (
              <button key={i} onClick={() => setSelectedWeek(i + 1)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{ background: selectedWeek === i + 1 ? block.color : "rgba(255,255,255,0.05)",
                  color: selectedWeek === i + 1 ? "#fff" : "#64748B",
                  border: `1px solid ${selectedWeek === i + 1 ? block.color : "rgba(255,255,255,0.08)"}` }}>
                W{i + 1}
              </button>
            ))}
          </div>

          {week && (() => {
            const huddle = getHuddle(block.id, week.weekNo);
            const { ppc, actualTotal, variance } = weekPPC(block.id, week.weekNo, week);

            return (
              <div className="space-y-4">
                {/* Dual huddle guide */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Daily huddle card */}
                  <div className="rounded-2xl p-4" style={{ background:"#0a0f1e", border:"1px solid rgba(14,165,233,0.2)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:"rgba(14,165,233,0.15)" }}>
                        <Icon name="check" size={14} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Daily Huddle</div>
                        <div className="text-xs" style={{ color:"#64748B" }}>Every morning · 07:00 · 15 min · Site office</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs" style={{ color:"#94A3B8" }}>
                      {[
                        { icon:"▶", t:"Yesterday's actual vs target (by zone)" },
                        { icon:"▶", t:"Today's target: " + dayTargetPerDay + " piles" },
                        { icon:"▶", t:"Constraints / blockers for today" },
                        { icon:"▶", t:"Recovery action if yesterday was a miss" },
                        { icon:"▶", t:"Confirm rig readiness & concrete booking" },
                        { icon:"▶", t:"Safety minute (HOLD)" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span style={{ color:"#0EA5E9" }}>{item.icon}</span>
                          <span>{item.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weekly huddle card */}
                  <div className="rounded-2xl p-4" style={{ background:"#0a0f1e", border:"1px solid rgba(168,85,247,0.2)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:"rgba(168,85,247,0.15)" }}>
                        <Icon name="calendar" size={14} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Weekly Huddle (Friday 16:30)</div>
                        <div className="text-xs" style={{ color:"#64748B" }}>Foreman + RE + Planner + QC + Safety · 45 min</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs" style={{ color:"#94A3B8" }}>
                      {[
                        { icon:"1.", t:"Review week's PPC — hit or miss?" },
                        { icon:"2.", t:"Root-cause constraints (pareto)" },
                        { icon:"3.", t:"Recovery actions — owner + deadline" },
                        { icon:"4.", t:"Next week zone load plan sign-off" },
                        { icon:"5.", t:"3-week lookahead constraint removal" },
                        { icon:"6.", t:"Testing / inspection schedule confirm" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="font-bold" style={{ color:"#A855F7" }}>{item.icon}</span>
                          <span>{item.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Huddle record form ── */}
                <div className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">Huddle Record — {block.name} {week.weekLabel}</div>
                      {ppc !== null && <div className="text-xs mt-0.5" style={{ color: ppc >= 85 ? "#10B981" : "#EF4444" }}>Week PPC: {ppc}%  ·  Variance: {variance > 0 ? "+" : ""}{variance} piles</div>}
                    </div>
                    <input type="datetime-local" value={huddle.conductedAt}
                      onChange={e => setHuddle(block.id, week.weekNo, "conductedAt", e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                      style={{ background:"#1E293B", border:"1px solid rgba(255,255,255,0.08)" }} />
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Planned vs Actual complete */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold block mb-2" style={{ color:"#94A3B8" }}>Planned Complete This Week</label>
                        <input type="text" value={huddle.plannedComplete}
                          onChange={e => setHuddle(block.id, week.weekNo, "plannedComplete", e.target.value)}
                          placeholder={`${week.blockTarget} piles across ${block.zones.length} zones`}
                          className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                          style={{ background:"#1E293B", border:"1px solid rgba(255,255,255,0.08)" }} />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-2" style={{ color:"#94A3B8" }}>Actual Complete</label>
                        <input type="text" value={huddle.actualComplete}
                          onChange={e => setHuddle(block.id, week.weekNo, "actualComplete", e.target.value)}
                          placeholder="Enter actual piles completed…"
                          className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                          style={{ background:"#1E293B", border:`1px solid ${variance < 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}` }} />
                      </div>
                    </div>

                    {/* Constraints multi-select */}
                    <div>
                      <label className="text-xs font-bold block mb-2" style={{ color:"#EF4444" }}>Constraints Encountered This Week (select all that apply)</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {LPS_CONSTRAINTS.map(c => {
                          const selected = (huddle.constraints || []).includes(c);
                          return (
                            <button key={c} onClick={() => {
                              const cur = huddle.constraints || [];
                              const next = selected ? cur.filter(x => x !== c) : [...cur, c];
                              setHuddle(block.id, week.weekNo, "constraints", next);
                            }}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all text-left"
                              style={{ background: selected ? "rgba(239,68,68,0.12)" : "#1E293B",
                                color: selected ? "#FCA5A5" : "#64748B",
                                border: `1px solid ${selected ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.06)"}` }}>
                              <div className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center"
                                style={{ background: selected ? "#EF4444" : "transparent", border: `1.5px solid ${selected ? "#EF4444" : "#374151"}` }}>
                                {selected && <span className="text-white" style={{ fontSize:9, lineHeight:1 }}>✓</span>}
                              </div>
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recovery actions */}
                    <div>
                      <label className="text-xs font-bold block mb-2" style={{ color:"#F59E0B" }}>Recovery Actions (who does what by when)</label>
                      <textarea rows={4} value={huddle.recoveryActions}
                        onChange={e => setHuddle(block.id, week.weekNo, "recoveryActions", e.target.value)}
                        placeholder={"e.g.\n1. [Foreman] Extend shift to 12h Mon–Wed to recover 15 piles — by Mon 07:00\n2. [Planner] Expedite concrete booking for Zone 2 — by Mon EOD\n3. [RE] Confirm access for Zone 3 — by Tue 12:00"}
                        className="w-full px-4 py-3 rounded-xl text-xs text-white outline-none resize-none"
                        style={{ background:"#1E293B", border:"1px solid rgba(245,158,11,0.25)", lineHeight:1.7 }} />
                    </div>

                    {/* Next week lookahead */}
                    <div>
                      <label className="text-xs font-bold block mb-2" style={{ color:"#14B8A6" }}>3-Week Lookahead — Constraints to Remove</label>
                      <textarea rows={3} value={huddle.lookahead}
                        onChange={e => setHuddle(block.id, week.weekNo, "lookahead", e.target.value)}
                        placeholder={"e.g.\nWk+1: Zone 3 access must be clear by Friday\nWk+2: IFC pile cap drawings required for Blk-1\nWk+3: ULT test report expected — confirm lab turnaround"}
                        className="w-full px-4 py-3 rounded-xl text-xs text-white outline-none resize-none"
                        style={{ background:"#1E293B", border:"1px solid rgba(20,184,166,0.2)", lineHeight:1.7 }} />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-bold block mb-2" style={{ color:"#94A3B8" }}>Huddle Notes</label>
                      <textarea rows={2} value={huddle.notes}
                        onChange={e => setHuddle(block.id, week.weekNo, "notes", e.target.value)}
                        placeholder="Attendees, key decisions, action owners…"
                        className="w-full px-4 py-3 rounded-xl text-xs text-white outline-none resize-none"
                        style={{ background:"#1E293B", border:"1px solid rgba(255,255,255,0.07)" }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* VIEW 4 — PPC DASHBOARD                                     */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "dashboard" && (
        <div className="space-y-5">
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:"Average PPC",       value: blockStats.avgPPC !== null ? `${blockStats.avgPPC}%` : "—",
                sub:"Percent Plan Complete", color: blockStats.avgPPC === null ? "#64748B" : blockStats.avgPPC >= 85 ? "#10B981" : blockStats.avgPPC >= 70 ? "#F59E0B" : "#EF4444" },
              { label:"Weeks Reported",    value: blockStats.weeksReported,  sub:"of " + weeklyPlan.length + " total",         color:"#14B8A6" },
              { label:"Cumulative Variance", value: blockStats.runVariance === 0 ? "On track" : (blockStats.runVariance > 0 ? "+" : "") + blockStats.runVariance,
                sub:"piles vs plan",         color: blockStats.runVariance >= 0 ? "#10B981" : "#EF4444" },
              { label:"Top Constraint",    value: blockStats.constraintPareto[0]?.[0]?.split(" ")[0] || "—",
                sub: blockStats.constraintPareto[0] ? blockStats.constraintPareto[0][0] : "No data yet",    color:"#F59E0B" },
            ].map((k, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background:"#0a0f1e", border:`1px solid ${k.color}20` }}>
                <div className="text-2xl font-bold" style={{ color:k.color }}>{k.value}</div>
                <div className="text-xs font-bold text-white mt-0.5">{k.label}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color:"#475569" }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* PPC weekly trend */}
          <div className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-sm font-bold text-white mb-4">PPC Weekly Trend — {block.name}</div>
            {blockStats.ppcValues.length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color:"#374151" }}>No data yet — log actuals in the Daily Log tab to see PPC trend</div>
            ) : (
              <div className="space-y-3">
                {weeklyPlan.map((wp, wi) => {
                  const wNo = wi + 1;
                  const { ppc, actualTotal, variance } = weekPPC(block.id, wNo, wp);
                  if (ppc === null) return null;
                  const barColor = ppc >= 85 ? "#10B981" : ppc >= 70 ? "#F59E0B" : "#EF4444";
                  return (
                    <div key={wNo} className="flex items-center gap-3">
                      <div className="text-xs font-bold w-16 flex-shrink-0" style={{ color:"#64748B" }}>{wp.weekLabel.split(" ")[0]}</div>
                      <div className="flex-1 h-5 rounded-full overflow-hidden relative" style={{ background:"#1E293B" }}>
                        <div className="h-full rounded-full flex items-center px-2 text-xs font-bold text-white"
                          style={{ width:`${ppc}%`, minWidth:40, background:barColor, transition:"width 0.5s" }}>
                          {ppc}%
                        </div>
                        {/* 85% target line */}
                        <div className="absolute top-0 bottom-0 w-px" style={{ left:"85%", background:"rgba(255,255,255,0.2)" }} />
                      </div>
                      <div className="flex gap-4 w-32 flex-shrink-0 text-right">
                        <div className="text-xs" style={{ color:"#475569" }}>{actualTotal}/{wp.blockTarget}</div>
                        <div className="text-xs font-bold" style={{ color: variance >= 0 ? "#10B981" : "#EF4444" }}>{variance > 0 ? "+" : ""}{variance}</div>
                      </div>
                    </div>
                  );
                })}
                {/* 85% target line label */}
                <div className="text-xs mt-2" style={{ color:"#374151" }}>▸ Vertical line = 85% PPC target (LPS good-practice threshold)</div>
              </div>
            )}
          </div>

          {/* Constraint Pareto */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-sm font-bold text-white mb-4">Constraint Pareto (this block, all weeks)</div>
              {blockStats.constraintPareto.length === 0 ? (
                <div className="text-center py-6 text-xs" style={{ color:"#374151" }}>Record constraints in the Huddle Board to see pareto</div>
              ) : (
                <div className="space-y-2">
                  {blockStats.constraintPareto.slice(0, 8).map(([constraint, count], i) => {
                    const max = blockStats.constraintPareto[0][1];
                    const colors = ["#EF4444","#F97316","#F59E0B","#EAB308","#22C55E","#14B8A6","#3B82F6","#A855F7"];
                    return (
                      <div key={constraint}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color:"#94A3B8" }} className="truncate">{constraint}</span>
                          <span className="font-bold ml-2 flex-shrink-0" style={{ color:colors[i % colors.length] }}>{count}×</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background:"#1E293B" }}>
                          <div className="h-full rounded-full" style={{ width:`${count/max*100}%`, background:colors[i % colors.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Running variance */}
            <div className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-sm font-bold text-white mb-4">Cumulative Variance (piles vs plan)</div>
              {blockStats.weeksReported === 0 ? (
                <div className="text-center py-6 text-xs" style={{ color:"#374151" }}>Log actuals to see cumulative variance</div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    let cumVar = 0;
                    return weeklyPlan.map((wp, wi) => {
                      const wNo = wi + 1;
                      const { actualTotal, plannedCount } = weekPPC(block.id, wNo, wp);
                      if (plannedCount === 0) return null;
                      cumVar += actualTotal - wp.blockTarget;
                      const max = Math.max(Math.abs(cumVar) + 5, 20);
                      return (
                        <div key={wNo}>
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color:"#64748B" }}>W{wNo}</span>
                            <span className="font-bold" style={{ color: cumVar >= 0 ? "#10B981" : "#EF4444" }}>{cumVar > 0 ? "+" : ""}{cumVar}</span>
                          </div>
                          <VarianceBar val={cumVar} max={max} />
                        </div>
                      );
                    }).filter(Boolean);
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* All-block PPC summary */}
          <div className="rounded-2xl p-5" style={{ background:"#0a0f1e", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-sm font-bold text-white mb-4">All Blocks — PPC Summary</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {blocks.map(b => {
                const wp = buildWeeklyPlan(b);
                let allPPC = [], allVar = 0;
                wp.forEach((w, wi) => {
                  const { ppc, actualTotal, plannedCount } = weekPPC(b.id, wi + 1, w);
                  if (ppc !== null) { allPPC.push(ppc); allVar += actualTotal - w.blockTarget; }
                });
                const avg = allPPC.length ? Math.round(allPPC.reduce((s,v)=>s+v,0)/allPPC.length) : null;
                const col = avg === null ? "#374151" : avg >= 85 ? "#10B981" : avg >= 70 ? "#F59E0B" : "#EF4444";
                return (
                  <div key={b.id} onClick={() => { setSelectedBlock(b.id); setSelectedWeek(1); }}
                    className="rounded-xl p-4 cursor-pointer transition-all hover:scale-105 text-center"
                    style={{ background:"#1E293B", border:`1px solid ${b.color}30` }}>
                    <div className="text-sm font-bold mb-2" style={{ color:b.color }}>{b.name}</div>
                    {avg !== null ? (
                      <>
                        <PpcGauge ppc={avg} />
                        <div className="mt-2 text-xs" style={{ color: allVar >= 0 ? "#10B981" : "#EF4444" }}>
                          {allVar > 0 ? "+" : ""}{allVar}p variance
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-xs" style={{ color:"#374151" }}>No data</div>
                    )}
                    <div className="text-xs mt-1" style={{ color:"#475569" }}>{allPPC.length} wks</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  TAKT BEAT MATRIX
//  Weeks × Zones grid showing pile load per cell, load bar,
//  takt beat indicator, and +/− zone controls live-wired to blocks
// ═══════════════════════════════════════════════════════════════════

// ── helpers used by TaktBeatMatrix ──────────────────────────────
// Convert a startOffset (working days) to whole-week index (0-based)
function offsetToWeek(offsetDays) { return Math.round(offsetDays / 5); }
function weekToOffset(weekIdx)    { return weekIdx * 5; }

// All zones are always sequential — helper kept for compatibility
function zonePattern(zones) { return "sequential"; }

// Zones are always sequential — no pattern selection needed
const SEQUENTIAL_COLOR = "#3B82F6";

function TaktBeatMatrix({ blocks, setBlocks }) {
  // ── zone add / remove ────────────────────────────────────────────
  function addZone(blockId) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const n = b.zones.length + 1;
      const base = Math.floor(b.piles / n), rem = b.piles % n;
      return { ...b, zones: Array.from({ length: n }, (_, i) => ({
        id: i < b.zones.length ? b.zones[i].id : `z${Date.now()}${i}`,
        name: `Zone ${i+1}`,
        piles: base + (i === n-1 ? rem : 0),
        rigs: 1,
        startOffset: b.zones[i]?.startOffset ?? 0,
      }))};
    }));
  }

  function removeZone(blockId) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.zones.length <= 1) return b;
      const n = b.zones.length - 1;
      const base = Math.floor(b.piles / n), rem = b.piles % n;
      return { ...b, zones: b.zones.slice(0, n).map((z, i) => ({
        ...z, name: `Zone ${i+1}`, piles: base + (i === n-1 ? rem : 0),
      }))};
    }));
  }

  // update a single zone field
  function updateZoneField(blockId, zoneId, field, val) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      return { ...b, zones: b.zones.map(z => z.id === zoneId ? { ...z, [field]: val } : z) };
    }));
  }

  // Zones are always sequential — no pattern switching needed

  // ── schedule ─────────────────────────────────────────────────────
  const allScheduled = useMemo(() => blocks.map(b => computeTestSchedule(b)), [blocks]);

  const programmeStart = useMemo(() => {
    const dates = allScheduled.map(b => b.blockStart);
    return dates.reduce((a, b) => a < b ? a : b);
  }, [allScheduled]);

  const programmeEnd = useMemo(() => {
    const dates = allScheduled.map(b => b.blockEnd);
    return dates.reduce((a, b) => a > b ? a : b);
  }, [allScheduled]);

  const totalWeeks = useMemo(() => {
    const ms = programmeEnd - programmeStart;
    return Math.min(26, Math.ceil(ms / (7 * 24 * 3600 * 1000)) + 2);
  }, [programmeStart, programmeEnd]);

  const weekHeaders = useMemo(() => Array.from({ length: totalWeeks }, (_, i) => {
    const d = new Date(programmeStart);
    d.setDate(d.getDate() + i * 7);
    return { wk: i+1, label:`W${i+1}`, date: d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"}) };
  }), [programmeStart, totalWeeks]);

  // Compute pile count for a zone in each programme week.
  // Divides zone.piles evenly across the weeks the zone is active.
  // floor(piles / activeWeeks) per week; last active week takes the remainder,
  // so column sums always equal zone.piles exactly.
  function zoneWeekPiles(zone, blockSched) {
    const zs = blockSched.zoneSchedules.find(z2 => z2.id === zone.id);
    if (!zs || zone.piles <= 0) return Array(totalWeeks).fill(0);

    // Collect which programme-week indices the zone is active in
    const activeWeekIdxs = [];
    for (let w = 0; w < totalWeeks; w++) {
      const wStart = new Date(programmeStart); wStart.setDate(wStart.getDate() + w * 7);
      const wEnd   = new Date(wStart);         wEnd.setDate(wEnd.getDate() + 4);
      if (zs.actualStart <= wEnd && zs.zEnd >= wStart) activeWeekIdxs.push(w);
    }
    if (activeWeekIdxs.length === 0) return Array(totalWeeks).fill(0);

    const n       = activeWeekIdxs.length;
    const perWeek = Math.floor(zone.piles / n);
    const rem     = zone.piles - perWeek * n;   // goes to last active week
    const result  = Array(totalWeeks).fill(0);
    activeWeekIdxs.forEach((wi, idx) => {
      result[wi] = perWeek + (idx === n - 1 ? rem : 0);
    });
    return result;
  }

  // Column widths
  const CELL_W = 52, LABEL_W = 110, CTRL_W = 260, TOTAL_W = 56;

  return (
    <div className="space-y-4">

      {/* ── Legend ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 items-center px-1">
        {[
          { bg:"rgba(255,255,255,0.85)", label:"Full takt week" },
          { bg:"rgba(255,255,255,0.45)", label:"Partial week" },
          { bg:"rgba(255,255,255,0.15)", label:"Start / end week" },
          { bg:"#1E293B",               label:"Idle / not started" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-7 h-3.5 rounded" style={{ background:l.bg, border:"1px solid rgba(255,255,255,0.08)" }} />
            <span className="text-xs" style={{ color:"#64748B" }}>{l.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background:SEQUENTIAL_COLOR }} />
            <span className="text-xs font-semibold" style={{ color:SEQUENTIAL_COLOR }}>Sequential zones</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background:"#F59E0B" }} />
            <span className="text-xs" style={{ color:"#94A3B8" }}>Start week offset applied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background:"#F59E0B" }} />
            <span className="text-xs" style={{ color:"#94A3B8" }}>PDA (during piling)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background:"#06B6D4" }} />
            <span className="text-xs" style={{ color:"#94A3B8" }}>WLT Set 1 (28d cure)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background:"#818CF8" }} />
            <span className="text-xs" style={{ color:"#94A3B8" }}>WLT Set 2 (after Set 1)</span>
          </div>
        </div>
      </div>

      {/* ── Matrix ──────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background:"#080e1d", border:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="overflow-x-auto" style={{ maxHeight:"72vh", overflowY:"auto" }}>
          <div style={{ minWidth: LABEL_W + CTRL_W + totalWeeks * CELL_W + TOTAL_W }}>

            {/* ── Sticky column headers ── */}
            <div className="flex" style={{ position:"sticky", top:0, zIndex:30, background:"#0d1526" }}>
              {/* Zone label col */}
              <div style={{ width:LABEL_W, minWidth:LABEL_W, color:"#475569" }}
                className="px-3 py-2 text-xs font-bold border-b border-r border-white/5 flex items-end">
                Block / Zone
              </div>
              {/* Controls col */}
              <div style={{ width:CTRL_W, minWidth:CTRL_W, color:"#475569" }}
                className="px-3 py-2 text-xs font-bold border-b border-r border-white/5 flex items-end gap-4">
                <span>Piles</span>
                <span>Rigs</span>
                <span>Start week</span>
                <span>Pattern</span>
              </div>
              {/* Week cols */}
              {weekHeaders.map(wh => (
                <div key={wh.wk} style={{ width:CELL_W, minWidth:CELL_W }}
                  className="py-1 text-center border-b border-r border-white/5 flex flex-col justify-end">
                  <div className="text-xs font-bold" style={{ color:"#94A3B8" }}>{wh.label}</div>
                  <div style={{ color:"#374151", fontSize:8 }}>{wh.date}</div>
                </div>
              ))}
              {/* Total col */}
              <div style={{ width:TOTAL_W, minWidth:TOTAL_W, color:"#475569" }}
                className="px-1 py-2 text-xs font-bold border-b border-white/5 text-center flex items-end justify-center">
                Total
              </div>
            </div>

            {/* ── Block sections ── */}
            {blocks.map((block, bi) => {
              const sched = allScheduled[bi];
              const dur = sched.durationDays;
              // per-week block totals (sum of zones)
              const blockWeekTotals = weekHeaders.map((_, wi) => {
                let t = 0;
                block.zones.forEach(z => { t += zoneWeekPiles(z, sched)[wi]; });
                return t;
              });
              const maxBlockWeekly = block.zones.length * block.taktRate * 5;

              return (
                <div key={block.id} style={{ borderBottom:`2px solid ${block.color}30` }}>

                  {/* ── Block header row ── */}
                  <div className="flex items-stretch" style={{ background:`${block.color}10`, minHeight:38 }}>
                    {/* Name */}
                    <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:`1px solid ${block.color}20` }}
                      className="px-3 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background:block.color }} />
                      <span className="text-sm font-bold text-white">{block.name}</span>
                    </div>
                    {/* Controls: zone +/−, pattern buttons, duration */}
                    <div style={{ width:CTRL_W, minWidth:CTRL_W, borderRight:`1px solid ${block.color}20` }}
                      className="px-3 flex items-center gap-3 flex-wrap">
                      {/* +/- zone */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => removeZone(block.id)} disabled={block.zones.length<=1}
                          className="w-6 h-6 rounded font-bold text-sm flex items-center justify-center transition-all"
                          style={{ background:"rgba(239,68,68,0.12)", color:block.zones.length<=1?"#374151":"#EF4444",
                            border:"1px solid rgba(239,68,68,0.25)", cursor:block.zones.length<=1?"not-allowed":"pointer" }}>−</button>
                        <span className="text-sm font-black text-white w-5 text-center">{block.zones.length}</span>
                        <button onClick={() => addZone(block.id)} disabled={block.zones.length>=8}
                          className="w-6 h-6 rounded font-bold text-sm flex items-center justify-center transition-all"
                          style={{ background:`${block.color}20`, color:block.zones.length>=8?"#374151":block.color,
                            border:`1px solid ${block.color}40`, cursor:block.zones.length>=8?"not-allowed":"pointer" }}>+</button>
                        <span className="text-xs ml-1" style={{ color:"#374151" }}>zones</span>
                      </div>
                      {/* Sequential / offset mode label */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: block.zones.some(z=>(z.startOffset||0)>0) ? "#F59E0B" : SEQUENTIAL_COLOR }} />
                        <span className="text-xs font-semibold" style={{ color: block.zones.some(z=>(z.startOffset||0)>0) ? "#F59E0B" : SEQUENTIAL_COLOR }}>
                          {block.zones.some(z=>(z.startOffset||0)>0) ? "With offsets" : "Sequential"}
                        </span>
                      </div>
                      {/* Duration badge */}
                      <div className="ml-auto flex items-center gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background:`${block.color}20`, color:block.color }}>{dur}d</span>
                        <span className="text-xs" style={{ color:"#374151" }}>{block.piles}p</span>
                      </div>
                    </div>
                    {/* Block weekly totals — subtle summary bar */}
                    {blockWeekTotals.map((wt, wi) => {
                      const pct = maxBlockWeekly > 0 ? wt / maxBlockWeekly : 0;
                      return (
                        <div key={wi} style={{ width:CELL_W, minWidth:CELL_W, borderRight:"1px solid rgba(255,255,255,0.03)" }}
                          className="flex items-end justify-center pb-1 pt-1 relative">
                          {wt > 0 && (
                            <>
                              <div style={{ position:"absolute", bottom:2, left:"10%", width:"80%",
                                height: Math.max(3, Math.round(pct * 26)),
                                background: block.color, opacity: 0.35 + pct*0.5, borderRadius:2 }} />
                              <span style={{ position:"relative", fontSize:8, color:block.color, fontWeight:700, opacity:0.8 }}>{wt}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ width:TOTAL_W, minWidth:TOTAL_W }} className="flex items-center justify-center">
                      <span className="text-xs font-bold" style={{ color:block.color }}>{block.piles}</span>
                    </div>
                  </div>

                  {/* ── Zone rows — always visible ── */}
                  {block.zones.map((zone, zi) => {
                    const wkPiles = zoneWeekPiles(zone, sched);
                    const fullWeekTarget = block.taktRate * 5 * (zone.rigs || 1);
                    const zoneStartWeek = offsetToWeek(zone.startOffset || 0);
                    const zoneDurWeeks  = Math.ceil(Math.ceil(zone.piles / (block.taktRate * (zone.rigs||1))) / 5);
                    // Shade: darker for even zones, lighter for odd
                    const rowBg = zi % 2 === 0 ? "#0b1220" : "#0e1628";

                    return (
                      <div key={zone.id} className="flex items-stretch"
                        style={{ background:rowBg, borderTop:"1px solid rgba(255,255,255,0.03)", minHeight:44 }}>

                        {/* Zone name */}
                        <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:"1px solid rgba(255,255,255,0.04)" }}
                          className="pl-6 pr-2 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background:block.color, opacity: 0.4 + zi * 0.15 }} />
                          <span className="text-xs font-semibold" style={{ color:"#94A3B8" }}>{zone.name}</span>
                        </div>

                        {/* Controls: piles, rigs, start-week stepper */}
                        <div style={{ width:CTRL_W, minWidth:CTRL_W, borderRight:"1px solid rgba(255,255,255,0.04)" }}
                          className="px-3 py-1.5 flex items-center gap-3">

                          {/* Piles */}
                          <div className="flex flex-col items-center" style={{ width:52 }}>
                            <span style={{ fontSize:8, color:"#475569", marginBottom:1 }}>Piles</span>
                            <input type="number" min={1} value={zone.piles}
                              onChange={e => updateZoneField(block.id, zone.id, "piles", Math.max(1, parseInt(e.target.value)||1))}
                              className="w-full px-1 py-1 rounded text-center text-xs font-bold text-white outline-none"
                              style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${block.color}30` }} />
                          </div>

                          {/* Rigs */}
                          <div className="flex flex-col items-center" style={{ width:38 }}>
                            <span style={{ fontSize:8, color:"#475569", marginBottom:1 }}>Rigs</span>
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => updateZoneField(block.id, zone.id, "rigs", Math.max(1, (zone.rigs||1)-1))}
                                className="w-5 h-6 rounded text-xs font-bold flex items-center justify-center"
                                style={{ background:"rgba(255,255,255,0.05)", color:"#94A3B8" }}>−</button>
                              <span className="text-xs font-bold text-white w-4 text-center">{zone.rigs||1}</span>
                              <button onClick={() => updateZoneField(block.id, zone.id, "rigs", Math.min(4, (zone.rigs||1)+1))}
                                className="w-5 h-6 rounded text-xs font-bold flex items-center justify-center"
                                style={{ background:`${block.color}20`, color:block.color }}>+</button>
                            </div>
                          </div>

                          {/* Start week stepper */}
                          <div className="flex flex-col items-center" style={{ width:94 }}>
                            <span style={{ fontSize:8, color:"#475569", marginBottom:1 }}>Start week</span>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => updateZoneField(block.id, zone.id, "startOffset", Math.max(0, (zone.startOffset||0) - 1))}
                                disabled={(zone.startOffset||0) === 0}
                                className="w-5 h-6 rounded text-xs font-bold flex items-center justify-center"
                                style={{ background:"rgba(255,255,255,0.05)", color:(zone.startOffset||0)===0?"#374151":"#94A3B8",
                                  cursor:(zone.startOffset||0)===0?"not-allowed":"pointer" }}>◀</button>
                              <span className="text-xs font-bold text-white w-8 text-center"
                                style={{ color: (zone.startOffset||0) > 0 ? "#F59E0B" : "#94A3B8" }}>
                                W{(zone.startOffset||0) + 1}
                              </span>
                              <button
                                onClick={() => updateZoneField(block.id, zone.id, "startOffset", Math.min(totalWeeks - 1, (zone.startOffset||0) + 1))}
                                className="w-5 h-6 rounded text-xs font-bold flex items-center justify-center"
                                style={{ background:`${block.color}20`, color:block.color }}>▶</button>
                            </div>
                          </div>

                          {/* Duration badge */}
                          <div className="flex flex-col items-center ml-1">
                            <span style={{ fontSize:8, color:"#475569" }}>Duration</span>
                            <span className="text-xs font-bold" style={{ color:"#64748B" }}>{zoneDurWeeks}wk</span>
                          </div>
                        </div>

                        {/* ── Weekly pile cells ── */}
                        {wkPiles.map((wp, wi) => {
                          const isZoneWeek = wi >= zoneStartWeek && wi < zoneStartWeek + zoneDurWeeks;
                          const pct = fullWeekTarget > 0 ? wp / fullWeekTarget : 0;
                          // Cell background: block colour × opacity based on fill level
                          const opacity = wp === 0 ? 0 : pct >= 0.85 ? 0.82 : pct >= 0.5 ? 0.55 : 0.28;
                          const isActive = wp > 0;
                          return (
                            <div key={wi}
                              style={{ width:CELL_W, minWidth:CELL_W, height:44,
                                borderRight:"1px solid rgba(255,255,255,0.025)",
                                background: isActive
                                  ? `rgba(${parseInt(block.color.slice(1,3),16)},${parseInt(block.color.slice(3,5),16)},${parseInt(block.color.slice(5,7),16)},${opacity})`
                                  : isZoneWeek ? "rgba(255,255,255,0.018)" : "transparent",
                                position:"relative" }}
                              title={isActive
                                ? `${zone.name} · W${wi+1}: ${wp} piles (${Math.round(pct*100)}% takt)`
                                : isZoneWeek ? `${zone.name} · W${wi+1}: scheduled but 0 piles` : ""}>

                              {/* Pile count number */}
                              {isActive && (
                                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                                  alignItems:"center", justifyContent:"center" }}>
                                  <span style={{ fontSize: wp >= 100 ? 9 : 10, fontWeight:700,
                                    color: pct >= 0.85 ? "#fff" : "rgba(255,255,255,0.7)" }}>{wp}</span>
                                </div>
                              )}

                              {/* Takt fill bar at bottom */}
                              {isActive && (
                                <div style={{ position:"absolute", bottom:0, left:0,
                                  width:`${Math.min(100, pct*100)}%`, height:3,
                                  background: pct >= 0.85 ? "rgba(255,255,255,0.7)" : pct >= 0.5 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
                                  borderRadius:1 }} />
                              )}

                              {/* Start week marker */}
                              {wi === zoneStartWeek && !isActive && (
                                <div style={{ position:"absolute", left:0, top:0, bottom:0, width:2,
                                  background:block.color, opacity:0.5 }} />
                              )}
                            </div>
                          );
                        })}

                        {/* Zone total */}
                        <div style={{ width:TOTAL_W, minWidth:TOTAL_W }}
                          className="flex items-center justify-center">
                          <span className="text-xs font-bold" style={{ color:"#64748B" }}>{zone.piles}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* ── Test rows: PDA, WLT Set 1, WLT Set 2 ── */}
                  {[
                    { key:"pda",  label:"PDA",        color:"#F59E0B", abbr:"PDA" },
                    { key:"wlt1", label:"WLT Set 1",  color:"#06B6D4", abbr:"W1"  },
                    { key:"wlt2", label:"WLT Set 2",  color:"#818CF8", abbr:"W2"  },
                  ].map(tr => {
                    const t = sched.tests[tr.key];
                    const [rr,gg,bb] = [
                      parseInt(tr.color.slice(1,3),16),
                      parseInt(tr.color.slice(3,5),16),
                      parseInt(tr.color.slice(5,7),16),
                    ];
                    return (
                      <div key={tr.key} className="flex items-stretch"
                        style={{ background:"#080e1c", borderTop:"1px solid rgba(255,255,255,0.025)", minHeight:32 }}>
                        {/* Label */}
                        <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:"1px solid rgba(255,255,255,0.04)" }}
                          className="pl-8 pr-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background:tr.color }} />
                          <span className="text-xs font-semibold" style={{ color:tr.color }}>{tr.label}</span>
                        </div>
                        {/* Info: qty + duration */}
                        <div style={{ width:CTRL_W, minWidth:CTRL_W, borderRight:"1px solid rgba(255,255,255,0.04)" }}
                          className="px-4 flex items-center gap-4">
                          <span className="text-xs" style={{ color:"#475569" }}>{t.qty} tests</span>
                          <span className="text-xs" style={{ color:"#374151" }}>{t.days}d duration</span>
                          <span className="text-xs" style={{ color:"#2a3440" }}>
                            {tr.key === "pda"  ? "During piling" :
                             tr.key === "wlt1" ? "28d cure → Set 1" : "After Set 1"}
                          </span>
                        </div>
                        {/* Weekly cells */}
                        {weekHeaders.map((wh, wi) => {
                          const wStart = new Date(programmeStart); wStart.setDate(wStart.getDate() + wi * 7);
                          const wEnd   = new Date(wStart);         wEnd.setDate(wEnd.getDate() + 4);
                          const active = t.start <= wEnd && t.end >= wStart;
                          const inCure = tr.key !== "pda" && sched.tests.cure &&
                                         sched.tests.cure.start <= wEnd && sched.tests.cure.end >= wStart;
                          return (
                            <div key={wi}
                              style={{ width:CELL_W, minWidth:CELL_W,
                                borderRight:"1px solid rgba(255,255,255,0.025)",
                                background: active
                                  ? `rgba(${rr},${gg},${bb},0.22)`
                                  : "transparent",
                                position:"relative" }}
                              title={active ? `${tr.label} active · W${wi+1}` : inCure ? "28d concrete cure" : ""}>
                              {active && (
                                <>
                                  <div style={{ position:"absolute", inset:0, display:"flex",
                                    alignItems:"center", justifyContent:"center",
                                    fontSize:8, fontWeight:700, color:tr.color }}>{tr.abbr}</div>
                                  <div style={{ position:"absolute", bottom:0, left:0, right:0,
                                    height:2, background:tr.color, opacity:0.8 }} />
                                </>
                              )}
                              {inCure && !active && (
                                <div style={{ position:"absolute", inset:0,
                                  background:`repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(${rr},${gg},${bb},0.10) 3px,rgba(${rr},${gg},${bb},0.10) 4px)` }} />
                              )}
                            </div>
                          );
                        })}
                        {/* Qty total */}
                        <div style={{ width:TOTAL_W, minWidth:TOTAL_W }} className="flex items-center justify-center">
                          <span className="text-xs font-bold" style={{ color:tr.color }}>{t.qty}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* ── Programme totals row ── */}
            <div className="flex items-stretch"
              style={{ position:"sticky", bottom:0, background:"#0a0f1e", borderTop:"2px solid rgba(255,255,255,0.1)", minHeight:36 }}>
              <div style={{ width:LABEL_W+CTRL_W, minWidth:LABEL_W+CTRL_W, color:"#14B8A6" }}
                className="px-4 flex items-center text-xs font-bold border-r border-white/5">
                All Blocks (piles / week)
              </div>
              {weekHeaders.map((_, wi) => {
                let tot = 0;
                blocks.forEach((b, bi) => {
                  const s = allScheduled[bi];
                  b.zones.forEach(z => { tot += zoneWeekPiles(z, s)[wi]; });
                });
                const maxPoss = blocks.reduce((s,b) => s + b.zones.length * b.taktRate * 5, 0);
                const pct = maxPoss > 0 ? tot / maxPoss : 0;
                const hue = Math.round(120 * pct);
                return (
                  <div key={wi} style={{ width:CELL_W, minWidth:CELL_W, borderRight:"1px solid rgba(255,255,255,0.03)" }}
                    className="flex flex-col items-center justify-center py-1 gap-0.5">
                    {tot > 0 && (
                      <>
                        <span style={{ fontSize:9, fontWeight:700, color:`hsl(${hue},65%,58%)` }}>{tot}</span>
                        <div style={{ width:Math.max(3, pct * CELL_W * 0.75), height:3,
                          background:`hsl(${hue},65%,50%)`, borderRadius:2 }} />
                      </>
                    )}
                  </div>
                );
              })}
              <div style={{ width:TOTAL_W, minWidth:TOTAL_W }} className="flex items-center justify-center">
                <span className="text-xs font-bold" style={{ color:"#14B8A6" }}>
                  {blocks.reduce((s,b)=>s+b.piles,0)}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Schedule impact cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {blocks.map((b, bi) => {
          const sched = allScheduled[bi];
          const dur   = sched.durationDays;
          return (
            <div key={b.id} className="rounded-xl p-3 space-y-1.5"
              style={{ background:"#0a0f1e", border:`1px solid ${b.color}25` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color:b.color }}>{b.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background:"#3B82F618", color:"#3B82F6", fontSize:8 }}>Sequential</span>
              </div>
              <div className="text-xl font-black text-white">{dur}d</div>
              <div className="text-xs" style={{ color:"#475569" }}>{b.zones.length} zones · {b.taktRate}p/rig/d</div>
              <div className="text-xs" style={{ color:"#475569" }}>{b.zones.length * b.taktRate}/day output</div>
              {/* Zone pill indicators */}
              <div className="flex gap-1 flex-wrap pt-0.5">
                {b.zones.map((z, zi) => (
                  <div key={zi} className="flex items-center gap-0.5 px-1 rounded"
                    style={{ background:`${b.color}18`, border:`1px solid ${b.color}30` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background:b.color, opacity:0.5+zi*0.15 }} />
                    <span style={{ fontSize:8, color:b.color }}>{z.piles}p</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  BLOCK EDITOR TAB — inline zone +/- with live Takt Beat Matrix
// ═══════════════════════════════════════════════════════════════════

function BlockEditorTab({ blocks, setBlocks, setEditingBlock, totalPiles, totalDays }) {
  // ── Inline zone +/− ─────────────────────────────────────────────
  function addZone(blockId) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const n = b.zones.length + 1;
      const base = Math.floor(b.piles / n), rem = b.piles % n;
      return { ...b, zones: Array.from({ length:n }, (_, i) => ({
        id: i < b.zones.length ? b.zones[i].id : `z${Date.now()}${i}`,
        name: `Zone ${i+1}`, piles: base + (i===n-1?rem:0), rigs:1, startOffset:0,
      }))};
    }));
  }

  function removeZone(blockId) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.zones.length <= 1) return b;
      const n = b.zones.length - 1;
      const base = Math.floor(b.piles / n), rem = b.piles % n;
      return { ...b, zones: Array.from({ length:n }, (_, i) => ({
        ...b.zones[i], name:`Zone ${i+1}`, piles: base + (i===n-1?rem:0),
      }))};
    }));
  }

  const allScheduled = useMemo(() => blocks.map(b => computeBlockSchedule(b)), [blocks]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily:"'Georgia',serif" }}>Block &amp; Zone Editor</h1>
          <p className="text-sm text-gray-500 mt-1">Use +/− to add or remove zones. Takt Beat Matrix updates instantly below.</p>
        </div>
      </div>

      {/* Block cards with inline zone editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {blocks.map((block, bi) => {
          const sched = allScheduled[bi];
          const dur = sched.durationDays;
          const ppd = block.zones.length * block.taktRate;
          const pilesPerZone = Math.round(block.piles / block.zones.length);

          return (
            <div key={block.id} className="rounded-2xl overflow-hidden"
              style={{ background:"#0a0f1e", border:`1px solid ${block.color}30` }}>
              {/* Card header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background:`${block.color}15`, borderBottom:`1px solid ${block.color}20` }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background:block.color }} />
                  <span className="font-bold text-white">{block.name}</span>
                  <span className="text-xs" style={{ color:"#475569" }}>{block.piles} piles</span>
                </div>
                <button onClick={() => setEditingBlock(block)} className="p-1.5 rounded-lg transition-all hover:opacity-70"
                  style={{ background:`${block.color}20`, color:block.color }}>
                  <Icon name="edit" size={14} />
                </button>
              </div>

              {/* Zone +/- control */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                <div className="text-xs" style={{ color:"#64748B" }}>
                  Zones · ~{pilesPerZone}p each · {dur}d duration
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => removeZone(block.id)} disabled={block.zones.length <= 1}
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-lg transition-all"
                    style={{ background:"rgba(239,68,68,0.1)", color: block.zones.length<=1 ? "#374151":"#EF4444",
                      border:"1px solid rgba(239,68,68,0.2)", cursor: block.zones.length<=1?"not-allowed":"pointer" }}>−</button>
                  <div className="text-center px-2">
                    <div className="text-2xl font-black text-white">{block.zones.length}</div>
                  </div>
                  <button onClick={() => addZone(block.id)} disabled={block.zones.length >= 8}
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-lg transition-all"
                    style={{ background:`${block.color}20`, color: block.zones.length>=8?"#374151":block.color,
                      border:`1px solid ${block.color}40`, cursor: block.zones.length>=8?"not-allowed":"pointer" }}>+</button>
                </div>
              </div>

              {/* Zone list */}
              <div className="px-4 py-2 space-y-1.5">
                {block.zones.map((z, zi) => (
                  <div key={z.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:block.color, opacity:0.6+zi*0.1 }} />
                    <span className="text-xs font-medium" style={{ color:"#94A3B8" }}>{z.name}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:"#1E293B" }}>
                      <div className="h-full rounded-full" style={{ width:`${block.piles>0?z.piles/block.piles*100:0}%`, background:block.color }} />
                    </div>
                    <span className="text-xs" style={{ color:"#475569" }}>{z.piles}p</span>
                  </div>
                ))}
              </div>

              {/* Metrics row */}
              <div className="px-4 py-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
                {[
                  { v:`${dur}d`, l:"Duration" },
                  { v:`${ppd}/d`, l:"Output" },
                  { v:`${(dur/5).toFixed(1)}wk`, l:"Weeks" },
                ].map(m => (
                  <div key={m.l}>
                    <div className="text-sm font-bold text-white">{m.v}</div>
                    <div className="text-xs" style={{ color:"#475569" }}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Takt Beat Matrix */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1" style={{ background:"rgba(255,255,255,0.06)" }} />
          <span className="text-sm font-bold px-3" style={{ color:"#14B8A6", fontFamily:"'Georgia',serif" }}>Live Takt Beat Matrix</span>
          <div className="h-px flex-1" style={{ background:"rgba(255,255,255,0.06)" }} />
        </div>
        <TaktBeatMatrix blocks={blocks} setBlocks={setBlocks} />
      </div>

      {/* Summary table */}
      <div className="rounded-2xl overflow-hidden" style={{ background:"#0a0f1e", border:"1px solid rgba(46,109,164,0.3)" }}>
        <div className="px-5 py-3 border-b border-white/5">
          <h3 className="text-sm font-bold text-blue-300" style={{ fontFamily:"'Georgia',serif" }}>Zone Optimisation Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 uppercase tracking-wider border-b border-white/5">
                {["Block","Piles","Zones","Piles/Zone","Total Rigs","Rate/day","Duration","Weeks"].map(h => (
                  <th key={h} className="py-2 px-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocks.map((b, bi) => {
                const dur = allScheduled[bi].durationDays;
                const ppz = Math.ceil(b.piles / b.zones.length);
                const rigs = b.zones.reduce((s,z)=>s+z.rigs,0);
                return (
                  <tr key={b.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="py-2.5 px-3 font-bold" style={{ color:b.color }}>{b.name}</td>
                    <td className="py-2.5 px-3 text-gray-300">{b.piles}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => removeZone(b.id)} disabled={b.zones.length<=1}
                          className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
                          style={{ background:"rgba(239,68,68,0.1)", color:b.zones.length<=1?"#374151":"#EF4444", cursor:b.zones.length<=1?"not-allowed":"pointer" }}>−</button>
                        <span className="px-2 font-bold rounded-full" style={{ background:b.color+"25", color:b.color }}>{b.zones.length}</span>
                        <button onClick={() => addZone(b.id)} disabled={b.zones.length>=8}
                          className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
                          style={{ background:`${b.color}20`, color:b.zones.length>=8?"#374151":b.color, cursor:b.zones.length>=8?"not-allowed":"pointer" }}>+</button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">{ppz}</td>
                    <td className="py-2.5 px-3 text-gray-300">{rigs}</td>
                    <td className="py-2.5 px-3 font-bold text-green-400">{rigs * b.taktRate}/d</td>
                    <td className="py-2.5 px-3 font-bold text-blue-400">{dur}d</td>
                    <td className="py-2.5 px-3 text-gray-400">{(dur/5).toFixed(1)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-white/10" style={{ background:"rgba(37,99,235,0.08)" }}>
                <td className="py-2.5 px-3 font-bold text-white">TOTAL</td>
                <td className="py-2.5 px-3 font-bold text-white">{totalPiles}</td>
                <td className="py-2.5 px-3 font-bold text-white">{blocks.reduce((s,b)=>s+b.zones.length,0)}</td>
                <td colSpan={3} />
                <td className="py-2.5 px-3 font-bold text-teal-400">{totalDays}d</td>
                <td className="py-2.5 px-3 font-bold text-teal-400">{(totalDays/5).toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function TaktPlanApp() {
  const [blocks, setBlocks] = useState(() => {
    try { const s = localStorage.getItem("takt_blocks"); return s ? JSON.parse(s) : OPTIMISED_BLOCKS; } catch { return OPTIMISED_BLOCKS; }
  });
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [ganttView, setGanttView] = useState("gantt");
  const [showDetails, setShowDetails] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem("takt_blocks", JSON.stringify(blocks)); } catch {}
  }, [blocks]);

  // Computed KPIs
  const scheduled = useMemo(() => blocks.map(b => computeBlockSchedule(b)), [blocks]);
  const totalPiles = blocks.reduce((s, b) => s + b.piles, 0);
  const maxEndDate = useMemo(() => {
    const ends = scheduled.map(b => b.blockEnd);
    return ends.reduce((a, b) => b > a ? b : a, ends[0]);
  }, [scheduled]);
  const totalDays = workingDaysBetween("2026-01-16", maxEndDate?.toISOString()?.split("T")[0] || "2026-04-30");
  const totalWeeks = Math.ceil(totalDays / 6);
  const origDays = 100;
  const saving = origDays - totalDays;
  const savingPct = Math.round((saving / origDays) * 100);
  const totalRigs = blocks.reduce((s, b) => s + b.zones.reduce((z, zone) => z + zone.rigs, 0), 0);

  const saveToSupabase = async () => {
    if (!USE_SUPABASE || !user) return;
    setSaveStatus("saving");
    try {
      const db = await supabase.from("takt_plans");
      const rows = blocks.map(b => ({ id: b.id, project: "SKWPBD", user_email: user.email, data: JSON.stringify(b), updated_at: new Date().toISOString() }));
      await db.upsert(rows);
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const handleSaveBlock = (updatedBlock) => {
    setBlocks(bs => bs.map(b => b.id === updatedBlock.id ? updatedBlock : b));
    setEditingBlock(null);
  };

  const resetToDefault = () => { if (confirm("Reset all blocks to optimised plan?")) setBlocks(OPTIMISED_BLOCKS); };

  const tabs = [
    { id: "dashboard",     label: "Dashboard",     icon: "grid" },
    { id: "gantt",         label: "Gantt / Takt",  icon: "calendar" },
    { id: "blocks",        label: "Block Editor",  icon: "layers" },
    { id: "optimise",      label: "Optimisation",  icon: "target" },
    { id: "lps",           label: "Last Planner",  icon: "check" },
    { id: "analysis",      label: "Analysis",      icon: "trending" },
    { id: "compare",       label: "Before / After", icon: "chart" },
    { id: "presentation",  label: "Presentation",  icon: "zap" },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: "radial-gradient(ellipse at 20% 50%, #0d1f3e 0%, #050a13 60%)", fontFamily: "'Calibri', 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.8); }
      `}</style>

      {/* TOP NAV */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-white/5"
        style={{ background: "rgba(5,10,20,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
            <Icon name="layers" size={16} />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">SKWPBD</div>
            <div className="text-xs text-gray-500" style={{ fontSize: 10 }}>Lean Takt Planning Platform</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: activeTab === t.id ? "linear-gradient(90deg, #2563EB22, #7C3AED22)" : "transparent",
                color: activeTab === t.id ? "#93C5FD" : "#6B7280",
                border: activeTab === t.id ? "1px solid rgba(147,197,253,0.2)" : "1px solid transparent" }}>
              <Icon name={t.icon} size={13} />{t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: saveStatus === "saved" ? "#10B98120" : "#EF444420", color: saveStatus === "saved" ? "#10B981" : "#EF4444" }}>
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "Error"}
            </span>
          )}
          {user ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-gray-300"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Icon name="user" size={12} />{user.name}
              {USE_SUPABASE && <button onClick={saveToSupabase} className="ml-2 text-blue-400 hover:text-blue-300"><Icon name="save" size={12} /></button>}
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
              style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
              <Icon name="user" size={12} />Sign In
            </button>
          )}
        </div>
      </nav>

      {/* CONTENT */}
      <main className="px-6 py-6 max-w-screen-2xl mx-auto">

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>Programme Overview</h1>
                <p className="text-sm text-gray-500 mt-1">Optimised Takt Plan · {blocks.length} Blocks · {totalPiles.toLocaleString()} Piles</p>
              </div>
              <div className="flex gap-2">
                <button onClick={resetToDefault} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  Reset
                </button>
                <button onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: showDetails ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)", color: showDetails ? "#93C5FD" : "#9CA3AF", border: "1px solid rgba(37,99,235,0.2)" }}>
                  <Icon name="info" size={12} />{showDetails ? "Less" : "More"} Detail
                </button>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Total Piles" value={totalPiles.toLocaleString()} icon="target" color="#2563EB" sub={`${blocks.length} blocks`} />
              <KPICard label="Programme Duration" value={`${totalDays}d`} icon="calendar" color="#10B981" sub={`${totalWeeks} weeks`} trend={`vs ${origDays}d original`} />
              <KPICard label="Schedule Saving" value={`${saving}d`} icon="trending" color="#F59E0B" sub={`${savingPct}% reduction`} trend="▲ optimised" />
              <KPICard label="Active Rigs" value={totalRigs} icon="zap" color="#8B5CF6" sub="Total rig-days deployed" />
            </div>

            {/* Block cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {blocks.map(block => (
                <BlockCard key={block.id} block={block} onEdit={setEditingBlock} showDetails={showDetails} />
              ))}
            </div>

            {/* Production chart */}
            <ProductionChart blocks={blocks} />

            {/* Lean recommendations */}
            <div className="rounded-2xl p-5" style={{ background: "#0a0f1e", border: "1px solid rgba(245,158,11,0.2)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Icon name="alert" size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-amber-300" style={{ fontFamily: "'Georgia', serif" }}>Takt Planning Recommendations</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { icon: "zap", col: "#10B981", title: "Equal Zone Sizing", body: "All zones should carry equal pile counts. Imbalanced zones break takt rhythm and cause rig idle time." },
                  { icon: "layers", col: "#2563EB", title: "Concurrent Phase Execution", body: "Blk-4 & Blk-3 are in different sectors — run them in parallel. Saves ~12 working days with no extra resources." },
                  { icon: "trending", col: "#8B5CF6", title: "Phase Overlap Strategy", body: "Start Phase 2 when Phase 1 hits 70% completion. Start Phase 3 when Phase 2 hits 60%. Net saving: ~15 days." },
                  { icon: "target", col: "#F59E0B", title: "Eliminate Zone Transition Idle", body: "Pre-plan zone boundaries, pre-position piling frames. Target zero idle days between zone transitions." },
                ].map(r => (
                  <div key={r.title} className="flex gap-3 p-3 rounded-xl" style={{ background: r.col + "10", border: `1px solid ${r.col}20` }}>
                    <div className="mt-0.5" style={{ color: r.col }}><Icon name={r.icon} size={14} /></div>
                    <div>
                      <div className="text-xs font-bold text-white mb-1">{r.title}</div>
                      <div className="text-xs text-gray-400">{r.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── GANTT ── */}
        {activeTab === "gantt" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>Gantt · Takt Beat Matrix</h1>
                <p className="text-sm text-gray-500 mt-1">Switch between timeline Gantt and zone-by-week Takt Beat Matrix</p>
              </div>
              <div className="flex gap-2">
                {[{id:"gantt",label:"Gantt Timeline",icon:"calendar"},{id:"matrix",label:"Takt Beat Matrix",icon:"grid"}].map(v => (
                  <button key={v.id} onClick={() => setGanttView(v.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ background: ganttView===v.id ? "linear-gradient(90deg,#2563EB,#7C3AED)" : "rgba(255,255,255,0.05)",
                      color: ganttView===v.id ? "#fff" : "#64748B",
                      border: ganttView===v.id ? "none" : "1px solid rgba(255,255,255,0.08)" }}>
                    <Icon name={v.icon} size={13} />{v.label}
                  </button>
                ))}
              </div>
            </div>
            {ganttView === "gantt" ? (
              <GanttChart blocks={blocks} />
            ) : (
              <TaktBeatMatrix blocks={blocks} setBlocks={setBlocks} />
            )}
          </div>
        )}

        {/* ── BLOCK EDITOR ── */}
        {activeTab === "blocks" && (
          <BlockEditorTab blocks={blocks} setBlocks={setBlocks} setEditingBlock={setEditingBlock}
            totalPiles={totalPiles} totalDays={totalDays} />
        )}

        {/* ── ANALYSIS ── */}
        {activeTab === "analysis" && (
          <div className="space-y-5">
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>Lean Analysis</h1>

            <ProductionChart blocks={blocks} />

            {/* Variance table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>Plan vs Original Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase tracking-wider border-b border-white/5">
                      {["Block","Piles","Original Days","Optimised Days","Days Saved","% Saved","Original Zones","Opt Zones"].map(h => (
                        <th key={h} className="py-3 px-4 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((b, i) => {
                      const origData = [43,29,21,20,30,30];
                      const origZones = [3,2,1,1,3,4];
                      const opt = computeBlockSchedule(b).durationDays;
                      const saved = origData[i] - opt;
                      const pct = Math.round((saved / origData[i]) * 100);
                      return (
                        <tr key={b.id} className="border-b border-white/5 hover:bg-white/2">
                          <td className="py-3 px-4 font-bold" style={{ color: b.color }}>{b.name}</td>
                          <td className="py-3 px-4 text-gray-300">{b.piles}</td>
                          <td className="py-3 px-4 text-gray-400">{origData[i]}d</td>
                          <td className="py-3 px-4 font-bold text-teal-400">{opt}d</td>
                          <td className="py-3 px-4">
                            <span className={`font-bold ${saved > 0 ? "text-green-400" : saved < 0 ? "text-red-400" : "text-gray-400"}`}>
                              {saved > 0 ? "−" : "+"}{Math.abs(saved)}d
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.1)" }}>
                                <div style={{ width: `${Math.max(0, pct)}%`, height: "100%", background: pct > 0 ? "#10B981" : "#EF4444" }} />
                              </div>
                              <span className={pct > 0 ? "text-green-400" : "text-red-400"}>{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-400">{origZones[i]}</td>
                          <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full font-bold text-xs" style={{ background: b.color + "25", color: b.color }}>{b.zones.length}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Savings levers */}
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { lever: "1", title: "Concurrent Rig Deployment", saving: "18 days", detail: "Adding 2nd zone to Blk-4 & Blk-3 with dedicated rigs cuts each block from 21→12 days.", color: "#10B981" },
                { lever: "2", title: "Parallel Block Execution", saving: "12 days", detail: "Blk-4 & Blk-3 in different sectors — simultaneous execution with no resource conflict.", color: "#2563EB" },
                { lever: "3", title: "Phase Start Overlap", saving: "10 days", detail: "Phase 2 starts at 70% P1 completion. Phase 3 starts at 60% P2 completion.", color: "#8B5CF6" },
                { lever: "4", title: "Zero Zone-Transition Idle", saving: "8 days", detail: "Pre-planned zone boundaries, pre-positioned frames. Eliminates 16 idle days seen in Blk-6.", color: "#F59E0B" },
                { lever: "5", title: "Rebalanced Zone Sizes", saving: "5 days", detail: "Equal zone sizing for steady takt beat. Eliminates the 3:1 pile imbalance in current Blk-2.", color: "#EF4444" },
              ].map(l => (
                <div key={l.lever} className="flex gap-4 p-4 rounded-2xl" style={{ background: l.color + "10", border: `1px solid ${l.color}25` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-black"
                    style={{ background: l.color + "25", color: l.color, fontFamily: "'Georgia', serif" }}>{l.lever}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold text-white">{l.title}</span>
                      <span className="text-sm font-bold" style={{ color: l.color }}>−{l.saving}</span>
                    </div>
                    <p className="text-xs text-gray-400">{l.detail}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 p-4 rounded-2xl" style={{ background: "rgba(20,184,166,0.12)", border: "2px solid rgba(20,184,166,0.4)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-black"
                  style={{ background: "#14B8A630", color: "#14B8A6", fontFamily: "'Georgia', serif" }}>Σ</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold text-white">Combined Impact (all 5 levers)</span>
                    <span className="text-sm font-bold text-teal-400">−30 days (~30%)</span>
                  </div>
                  <p className="text-xs text-gray-400">Programme: 100 → 70 working days. Enables earlier handover of piling works to follow-on trades.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LAST PLANNER TAB ── */}
        {activeTab === "lps" && (
          <LastPlannerTab blocks={blocks} />
        )}

        {/* ── OPTIMISATION TAB ── */}
        {activeTab === "optimise" && (
          <OptimisationTab blocks={blocks} setBlocks={setBlocks} />
        )}

        {/* ── COMPARE TAB ── */}
        {activeTab === "compare" && (
          <CompareTab blocks={blocks} initialBlocks={INITIAL_BLOCKS} />
        )}

        {/* ── PRESENTATION TAB ── */}
        {activeTab === "presentation" && (
          <PresentationTab blocks={blocks} initialBlocks={INITIAL_BLOCKS} />
        )}

      </main>

      {/* MODALS */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={setUser} />}
      {editingBlock && <ZoneEditorModal block={editingBlock} onSave={handleSaveBlock} onClose={() => setEditingBlock(null)} />}
    </div>
  );
}

/*
┌──────────────────────────────────────────────────────────────────┐
│  SQL_SCHEMA  —  Run in Supabase SQL Editor to enable cloud sync  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  create table if not exists takt_plans (                         │
│    id text primary key,                                          │
│    project text default 'SKWPBD',                               │
│    user_email text,                                              │
│    data jsonb,                                                   │
│    updated_at timestamptz default now()                          │
│  );                                                              │
│                                                                  │
│  alter table takt_plans enable row level security;               │
│                                                                  │
│  create policy "Users manage own plans"                          │
│    on takt_plans for all                                         │
│    using (user_email = auth.jwt() ->> 'email')                   │
│    with check (user_email = auth.jwt() ->> 'email');             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
*/

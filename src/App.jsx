import React, { useState, useRef, useEffect } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, googleProvider, functions } from "./lib/firebase";
import RingProgress from "./components/RingProgress";
import { init } from "@nimiq/mini-app-sdk";
import {
  IconSettings, IconWallet, IconFlame, IconDrumstick, IconWheat, IconDroplet,
  IconLock, IconCheck, IconLogout, IconGoogle, IconPlus, IconMinus, IconGift,
} from "./components/icons";

/**
 * SECURITY — IMPORTANT
 * ----------------------------------------------------------------------
 * Tickets, nimGiftBalance, proUntil, and the weekly/monthly counters are
 * NEVER written directly by this file via setDoc() anymore. All
 * money/points logic now goes through the Cloud Functions in
 * functions/index.js (logMealScanned, logWaterGlass, joinCompetition,
 * confirmNimiqPayment, redeemTicketsForFreeMonth).
 * See firestore.rules: these fields are blocked at the rules level for
 * the client, so even editing this JS file can no longer be used to cheat.
 * ----------------------------------------------------------------------
 */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

@keyframes scanLaser {
  0% { top: 0%; opacity: 0.8; }
  50% { opacity: 1; }
  100% { top: 100%; opacity: 0.8; }
}
.scanner-box { position: relative; overflow: hidden; }
.laser-line {
  position: absolute; left: 0; right: 0; height: 3px;
  background: #B5502E; box-shadow: 0 0 12px #B5502E, 0 0 20px #B5502E;
  animation: scanLaser 1.8s ease-in-out infinite alternate; z-index: 10;
}
`;

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

// Cloud Function callables (voir functions/index.js)
const callLogMealScanned = httpsCallable(functions, "logMealScanned");
const callLogWaterGlass = httpsCallable(functions, "logWaterGlass");
const callJoinCompetition = httpsCallable(functions, "joinCompetition");
const callConfirmNimiqPayment = httpsCallable(functions, "confirmNimiqPayment");
const callRedeemTicketsForFreeMonth = httpsCallable(functions, "redeemTicketsForFreeMonth");

function parseGrams(value) {
  const n = parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function computeCalorieGoal(profile) {
  const { gender, age, heightCm, weightKg, goalWeightKg, activity } = profile;
  const bmr =
    gender === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const tdee = bmr * (ACTIVITY_MULTIPLIERS[activity] || 1.55);

  let goal = tdee;
  if (goalWeightKg < weightKg) goal = tdee - 500;
  else if (goalWeightKg > weightKg) goal = tdee + 300;

  return Math.max(1200, Math.round(goal));
}

function buildWeekStrip(caloriesCurrentToday) {
  const mockPast = [2450, 2600, 2300, 2750, 2400, 2900];
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isToday = i === 0;
    out.push({
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }).toUpperCase(),
      dateNum: d.getDate(),
      kcal: isToday ? caloriesCurrentToday : mockPast[6 - i] || 0,
      isToday,
    });
  }
  return out;
}

function getWeekKey(d = new Date()) {
  // Competition week: Saturday -> Sunday (weekend). We find the most
  // recent Saturday.
  const day = d.getDay(); // 0=Sun, 6=Sat
  const daysSinceSat = (day + 1) % 7; // Sat->0, Sun->1, Mon->2, ...
  const sat = new Date(d);
  sat.setDate(d.getDate() - daysSinceSat);
  return `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;
}

function getMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Leaderboard({ entries, valueKey, valueSuffix, currentUid, dark }) {
  if (!entries || entries.length === 0) {
    return (
      <p style={{ fontSize: "10.5px", marginTop: "12px", opacity: 0.75, fontFamily: "'IBM Plex Mono', monospace" }}>
        No entries yet — be the first!
      </p>
    );
  }
  const sorted = [...entries].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0)).slice(0, 5);
  return (
    <div style={{
      marginTop: "12px", borderRadius: "8px", overflow: "hidden",
      background: dark ? "rgba(27,36,48,0.08)" : "rgba(0,0,0,0.15)",
    }}>
      {sorted.map((entry, i) => (
        <div
          key={entry.displayName + i}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "6px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
            borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
            <span style={{ opacity: 0.8 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.uid === currentUid ? "You" : (entry.displayName || "Anonymous")}
            </span>
          </span>
          <span style={{ fontWeight: 700 }}>{entry[valueKey]}{valueSuffix}</span>
          {entry.wonBonus ? (
            <span style={{ marginLeft: "6px", fontSize: "10px", opacity: 0.85 }}>+{entry.wonBonus} 🎁</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function StakeInput({ value, onChange, onEnter, maxBalance, entered, color = "#1B2430", textColor = "#1B2430", disabled }) {
  if (entered) {
    return <div style={{ marginTop: "12px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700 }}>✓ You're in — good luck!</div>;
  }
  const quickPick = (pct) => onChange(String(Math.max(1, Math.floor(maxBalance * pct))));
  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="number" min="1" step="1" max={maxBalance} value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.2)", background: "rgba(255,255,255,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: textColor, boxSizing: "border-box" }}
        />
        <button
          style={{ border: "none", borderRadius: "8px", padding: "10px 14px", background: color, color: "#F5F3EC", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, cursor: "pointer", opacity: disabled ? 0.6 : 1 }}
          disabled={disabled || !(parseFloat(value) > 0) || parseFloat(value) > maxBalance}
          onClick={onEnter}
        >
          Enter
        </button>
      </div>
      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
        {[0.25, 0.5, 1].map((pct) => (
          <button
            key={pct}
            onClick={() => quickPick(pct)}
            style={{ flex: 1, border: "1px solid rgba(0,0,0,0.15)", borderRadius: "6px", padding: "5px", background: "transparent", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", cursor: "pointer", color: textColor }}
          >
            {pct === 1 ? "MAX" : `${pct * 100}%`}
          </button>
        ))}
      </div>
    </div>
  );
}

function computeWeightProgressPct(startWeight, currentWeight, goalWeight) {
  if (startWeight == null || startWeight === goalWeight) return 0;
  const total = Math.abs(goalWeight - startWeight);
  const done = goalWeight > startWeight
    ? Math.max(0, currentWeight - startWeight)
    : Math.max(0, startWeight - currentWeight);
  // % relative to each person's own goal: someone who needs to lose 2kg
  // and has lost 1kg is at 50%, someone who only needs to lose 0.2kg and
  // has done so is at 100% — everyone is compared to THEIR OWN goal, not
  // raw kg.
  return Math.round(Math.min(100, (done / total) * 100));
}

export default function App() {

  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [nimiqWalletAddress, setNimiqWalletAddress] = useState(null);

  const [scanState, setScanState] = useState("idle");
  const [selectedImage, setSelectedImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [mealData, setMealData] = useState({ name: "", calories: 0, protein: "0g", fats: "0g", carbs: "0g" });
  const fileInputRef = useRef(null);

  const defaultProfile = { gender: "male", age: 19, heightCm: 175, weightKg: 80, goalWeightKg: 84, activity: "moderate" };
  const [profile, setProfile] = useState(defaultProfile);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState(defaultProfile);

  const [glassesDrunk, setGlassesDrunk] = useState(0);
  const [lastWaterTime, setLastWaterTime] = useState(0);
  const [todayMeals, setTodayMeals] = useState([]);
  const [aiCoachTip, setAiCoachTip] = useState("Scan your first meal to let Gemini analyze your daily nutrition targets!");
  const [isAnalyzingCoach, setIsAnalyzingCoach] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");

  const [tickets, setTickets] = useState(0);
  const [nimGiftBalance, setNimGiftBalance] = useState(0);
  const TICKETS_PER_MEAL = 10;
  const TICKETS_PER_WATER = 5;
  const TICKETS_FOR_FREE_MONTH = 3700;
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [weeklyTicketsEarned, setWeeklyTicketsEarned] = useState(0);
  const [monthlyTicketsEarned, setMonthlyTicketsEarned] = useState(0);
  const [weeklyNimEntered, setWeeklyNimEntered] = useState(false);
  const [monthlyNimEntered, setMonthlyNimEntered] = useState(false);
  const NIM_COMPETITION_ENTRY = 1;
  const WEEKLY_WINNER_BONUS_PCT = 0.10;
  const MONTHLY_WINNER_BONUS_PCT = 0.40;

  const [weeklyNimLeaderboard, setWeeklyNimLeaderboard] = useState([]);
  const [monthlyNimLeaderboard, setMonthlyNimLeaderboard] = useState([]);
  const [leaderboardsLoading, setLeaderboardsLoading] = useState(false);

  const [weeklyNimStakeInput, setWeeklyNimStakeInput] = useState(String(NIM_COMPETITION_ENTRY));
  const [monthlyNimStakeInput, setMonthlyNimStakeInput] = useState(String(NIM_COMPETITION_ENTRY));

  // Water Tracker & Weight Goal competitions — same stake mechanic as tickets/NIM
  const [weeklyWaterGlassesEarned, setWeeklyWaterGlassesEarned] = useState(0);
  const [monthlyWaterGlassesEarned, setMonthlyWaterGlassesEarned] = useState(0);
  const [weeklyWeightStart, setWeeklyWeightStart] = useState(null);
  const [monthlyWeightStart, setMonthlyWeightStart] = useState(null);

  const [weeklyTicketStakeInput, setWeeklyTicketStakeInput] = useState("10");
  const [monthlyTicketStakeInput, setMonthlyTicketStakeInput] = useState("10");
  const [weeklyWaterStakeInput, setWeeklyWaterStakeInput] = useState("10");
  const [monthlyWaterStakeInput, setMonthlyWaterStakeInput] = useState("10");
  const [weeklyWeightStakeInput, setWeeklyWeightStakeInput] = useState("10");
  const [monthlyWeightStakeInput, setMonthlyWeightStakeInput] = useState("10");

  const [weeklyTicketEntered, setWeeklyTicketEntered] = useState(false);
  const [monthlyTicketEntered, setMonthlyTicketEntered] = useState(false);
  const [weeklyWaterEntered, setWeeklyWaterEntered] = useState(false);
  const [monthlyWaterEntered, setMonthlyWaterEntered] = useState(false);
  const [weeklyWeightEntered, setWeeklyWeightEntered] = useState(false);
  const [monthlyWeightEntered, setMonthlyWeightEntered] = useState(false);
  const [joiningCompetition, setJoiningCompetition] = useState(null); // type string en cours

  const [weeklyTicketLeaderboard, setWeeklyTicketLeaderboard] = useState([]);
  const [monthlyTicketLeaderboard, setMonthlyTicketLeaderboard] = useState([]);
  const [weeklyWaterLeaderboard, setWeeklyWaterLeaderboard] = useState([]);
  const [monthlyWaterLeaderboard, setMonthlyWaterLeaderboard] = useState([]);
  const [weeklyWeightLeaderboard, setWeeklyWeightLeaderboard] = useState([]);
  const [monthlyWeightLeaderboard, setMonthlyWeightLeaderboard] = useState([]);

  const [currentPage, setCurrentPage] = useState("home");
  const [countdownTick, setCountdownTick] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCountdownTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  function getWeeklyCountdown() {
    const now = new Date(countdownTick);
    const day = now.getDay();
    const daysUntilSat = (6 - day + 7) % 7 || 7;
    const nextSaturday = new Date(now);
    nextSaturday.setDate(now.getDate() + daysUntilSat);
    nextSaturday.setHours(0, 0, 0, 0);
    const diff = Math.max(0, nextSaturday - now);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { d, h, m, s, label: `${d}d ${h}h ${m}m ${s}s` };
  }

  function getMonthlyCountdown() {
    const now = new Date(countdownTick);
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const diff = Math.max(0, firstOfNextMonth - now);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { d, h, m, label: `${d}d ${h}h ${m}m` };
  }

  const nimiqRef = useRef(null);
  const [nimiqReady, setNimiqReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    init()
      .then((nimiq) => {
        if (cancelled) return;
        nimiqRef.current = nimiq;
        setNimiqReady(true);
      })
      .catch((err) => {
        console.warn("Nimiq Mini App SDK not available in this context:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.profile) {
              setProfile(data.profile);
              setTempProfile(data.profile);
            }
            if (data.proUntil && data.proUntil > Date.now()) setIsPro(true);
            // tickets / nimGiftBalance / weekly-monthly counters are
            // READ-ONLY here: they are written only by the Cloud
            // Functions (see firestore.rules).
            setTickets(typeof data.tickets === "number" ? data.tickets : 0);
            setNimGiftBalance(typeof data.nimGiftBalance === "number" ? data.nimGiftBalance : 0);
            setLastWaterTime(typeof data.lastWaterTime === "number" ? data.lastWaterTime : 0);

            const currentWeekKey = getWeekKey();
            if (data.weeklyPeriod === currentWeekKey) {
              setWeeklyTicketsEarned(data.weeklyTicketsEarned || 0);
              setWeeklyNimEntered(!!data.weeklyNimEntered);
              setWeeklyWaterGlassesEarned(data.weeklyWaterGlassesEarned || 0);
              setWeeklyWeightStart(typeof data.weeklyWeightStart === "number" ? data.weeklyWeightStart : null);
            } else {
              // Period rotation (reset to zero) is handled by the Cloud
              // Function on the next call — here we just display 0 in
              // the meantime, without ever writing to Firestore ourselves.
              setWeeklyTicketsEarned(0);
              setWeeklyNimEntered(false);
              setWeeklyWaterGlassesEarned(0);
              setWeeklyWeightStart(null);
            }

            const currentMonthKey = getMonthKey();
            if (data.monthlyPeriod === currentMonthKey) {
              setMonthlyTicketsEarned(data.monthlyTicketsEarned || 0);
              setMonthlyNimEntered(!!data.monthlyNimEntered);
              setMonthlyWaterGlassesEarned(data.monthlyWaterGlassesEarned || 0);
              setMonthlyWeightStart(typeof data.monthlyWeightStart === "number" ? data.monthlyWeightStart : null);
            } else {
              setMonthlyTicketsEarned(0);
              setMonthlyNimEntered(false);
              setMonthlyWaterGlassesEarned(0);
              setMonthlyWeightStart(null);
            }
          } else {
            // The starting balance is set server-side (add an
            // onUserCreated trigger in functions/index.js if needed);
            // here we only write the profile, never tickets/balances.
            await setDoc(userRef, { profile: defaultProfile });
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleDisconnectWallet = async () => {
    setNimiqWalletAddress(null);
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { nimiqAddress: null }, { merge: true });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert("Error login Firebase: " + error.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error) {
      console.error(error);
      const friendly = {
        "auth/invalid-email": "Invalid email address.",
        "auth/user-not-found": "No account found with this email. Try signing up instead.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/email-already-in-use": "An account already exists with this email. Try logging in instead.",
        "auth/weak-password": "Password must be at least 6 characters.",
      };
      setAuthError(friendly[error.code] || error.message);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfile(tempProfile);
    setIsEditingProfile(false);
    if (user) {
      try {
        // "profile" remains freely editable by the client (weight,
        // age...) — it is not a server-authoritative field.
        await setDoc(doc(db, "users", user.uid), { profile: tempProfile }, { merge: true });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const NIMIQ_APP_RECEIVING_ADDRESS = "NQ78 SF1K A42M CPT7 0LDP YT52 A747 8DB6 PX7P";
  const PRO_PRICE_NIM = 100; // 100 NIM / month subscription
  const LUNAS_PER_NIM = 1e5;
  const NIM_GIFT_BACK_PCT = 0.10; // 10% of the 100 NIM subscription (10 NIM) -> NIM competition gift balance. Locked: cannot be withdrawn, only used to enter NIM competitions.

  const handleNimiqConnect = async () => {
    const nimiq = nimiqRef.current;
    if (!nimiq) {
      alert("Nimiq Pay wallet isn't available here. Open this Mini App from inside the Nimiq Pay app to connect your wallet.");
      return;
    }
    try {
      const accounts = await nimiq.listAccounts();
      const address = Array.isArray(accounts) ? accounts[0] : null;
      if (address) {
        setNimiqWalletAddress(address);
        if (user) await setDoc(doc(db, "users", user.uid), { nimiqAddress: address }, { merge: true });
      }
    } catch (err) {
      console.error(err);
      if (err?.name !== "PermissionDeniedError") {
        alert("Error connecting to Nimiq Pay wallet.");
      }
    }
  };

  const handleRedeemTicketsForMonth = async () => {
    if (tickets < TICKETS_FOR_FREE_MONTH || isRedeeming) return;
    setIsRedeeming(true);
    try {
      const result = await callRedeemTicketsForFreeMonth();
      setTickets(result.data.tickets);
      setIsPro(true);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Unable to redeem your tickets right now.");
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleNimiqCheckout = async () => {
    const nimiq = nimiqRef.current;
    if (!nimiq) {
      alert("Nimiq Pay wallet isn't available here. Open this Mini App from inside the Nimiq Pay app to pay with NIM.");
      return;
    }
    if (!nimiqWalletAddress) {
      await handleNimiqConnect();
    }
    try {
      const txHash = await nimiq.sendBasicTransaction({
        recipient: NIMIQ_APP_RECEIVING_ADDRESS,
        value: PRO_PRICE_NIM * LUNAS_PER_NIM,
      });
      // The Pro credit + the 10 NIM gift-back are granted server-side
      // ONLY after verifying the txHash (see confirmNimiqPayment in
      // functions/index.js) — never locally.
      const result = await callConfirmNimiqPayment({ txHash });
      setIsPro(true);
      setNimGiftBalance((prev) => prev + (result.data.giftBack || 0));
    } catch (err) {
      console.error(err);
      if (err?.name === "PermissionDeniedError") {
        return;
      }
      alert("Payment could not be completed: " + (err?.message || "unknown error"));
    }
  };

  // ---- Competitions: a single entry point that calls the
  // joinCompetition Cloud Function. The displayed balance is only
  // updated after the server's response (source of truth).
  const joinCompetition = async ({ type, stakeInput, setEntered, currency, metricValue, extraFields }) => {
    const stake = parseFloat(stakeInput);
    const balance = currency === "nim" ? nimGiftBalance : tickets;
    if (!Number.isFinite(stake) || stake <= 0 || stake > balance) return;
    setJoiningCompetition(type);
    try {
      const result = await callJoinCompetition({ type, stake, metric: metricValue, extraFields });
      if (currency === "nim") setNimGiftBalance(result.data.newBalance);
      else setTickets(result.data.newBalance);
      setEntered(true);
      fetchLeaderboards();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Impossible de rejoindre cette compétition.");
    } finally {
      setJoiningCompetition(null);
    }
  };

  const handleJoinWeeklyTicketCompetition = () => joinCompetition({
    type: "tickets_weekly", stakeInput: weeklyTicketStakeInput, currency: "tickets",
    setEntered: setWeeklyTicketEntered, metricValue: weeklyTicketsEarned,
  });
  const handleJoinMonthlyTicketCompetition = () => joinCompetition({
    type: "tickets_monthly", stakeInput: monthlyTicketStakeInput, currency: "tickets",
    setEntered: setMonthlyTicketEntered, metricValue: monthlyTicketsEarned,
  });
  const handleJoinWeeklyWaterCompetition = () => joinCompetition({
    type: "water_weekly", stakeInput: weeklyWaterStakeInput, currency: "tickets",
    setEntered: setWeeklyWaterEntered, metricValue: weeklyWaterGlassesEarned,
  });
  const handleJoinMonthlyWaterCompetition = () => joinCompetition({
    type: "water_monthly", stakeInput: monthlyWaterStakeInput, currency: "tickets",
    setEntered: setMonthlyWaterEntered, metricValue: monthlyWaterGlassesEarned,
  });
  const handleJoinWeeklyWeightCompetition = () => {
    const start = weeklyWeightStart ?? profile.weightKg;
    if (weeklyWeightStart == null) setWeeklyWeightStart(start);
    const pct = computeWeightProgressPct(start, profile.weightKg, profile.goalWeightKg);
    joinCompetition({
      type: "weight_weekly", stakeInput: weeklyWeightStakeInput, currency: "tickets",
      setEntered: setWeeklyWeightEntered, metricValue: pct, extraFields: { startWeight: start },
    });
  };
  const handleJoinMonthlyWeightCompetition = () => {
    const start = monthlyWeightStart ?? profile.weightKg;
    if (monthlyWeightStart == null) setMonthlyWeightStart(start);
    const pct = computeWeightProgressPct(start, profile.weightKg, profile.goalWeightKg);
    joinCompetition({
      type: "weight_monthly", stakeInput: monthlyWeightStakeInput, currency: "tickets",
      setEntered: setMonthlyWeightEntered, metricValue: pct, extraFields: { startWeight: start },
    });
  };
  const handleJoinWeeklyNimCompetition = () => joinCompetition({
    type: "nim_weekly", stakeInput: weeklyNimStakeInput, currency: "nim",
    setEntered: setWeeklyNimEntered, metricValue: parseFloat(weeklyNimStakeInput),
  });
  const handleJoinMonthlyNimCompetition = () => joinCompetition({
    type: "nim_monthly", stakeInput: monthlyNimStakeInput, currency: "nim",
    setEntered: setMonthlyNimEntered, metricValue: parseFloat(monthlyNimStakeInput),
  });

  const fetchLeaderboards = async () => {
    setLeaderboardsLoading(true);
    try {
      const weekKey = getWeekKey();
      const monthKey = getMonthKey();
      const load = (col, key) => getDocs(query(collection(db, col, key, "entries"), orderBy("metric", "desc"), limit(10))).then((s) => s.docs.map((d) => d.data()));

      const [wTix, mTix, wWater, mWater, wWeight, mWeight, wNim, mNim] = await Promise.all([
        load("competitions_weekly_tickets_stake", weekKey), load("competitions_monthly_tickets_stake", monthKey),
        load("competitions_weekly_water", weekKey), load("competitions_monthly_water", monthKey),
        load("competitions_weekly_weight", weekKey), load("competitions_monthly_weight", monthKey),
        load("competitions_weekly_nim", weekKey), load("competitions_monthly_nim", monthKey),
      ]);

      setWeeklyTicketLeaderboard(wTix); setMonthlyTicketLeaderboard(mTix);
      setWeeklyWaterLeaderboard(wWater); setMonthlyWaterLeaderboard(mWater);
      setWeeklyWeightLeaderboard(wWeight); setMonthlyWeightLeaderboard(mWeight);
      setWeeklyNimLeaderboard(wNim); setMonthlyNimLeaderboard(mNim);
    } catch (err) {
      console.error("Failed to load leaderboards:", err);
    } finally {
      setLeaderboardsLoading(false);
    }
  };

  useEffect(() => {
    if (currentPage === "competitions") fetchLeaderboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const WAKING_HOURS = 16;
  const getWaterIntervalMs = () => (WAKING_HOURS * 60 * 60 * 1000) / waterGoalGlasses;

  const handleAddWaterGlass = async () => {
    const now = Date.now();
    const intervalMs = getWaterIntervalMs();
    // Pré-check local pour l'UX (feedback instantané) — la vraie règle
    // anti-triche est appliquée côté serveur dans logWaterGlass.
    if (now - lastWaterTime < intervalMs) {
      const minutesLeft = Math.ceil((intervalMs - (now - lastWaterTime)) / 60000);
      alert(`Pace yourself! Next glass unlocks in ${minutesLeft} min. Drinking too fast doesn't count toward tickets.`);
      return;
    }
    setGlassesDrunk((g) => g + 1);
    setLastWaterTime(now);
    try {
      const result = await callLogWaterGlass();
      setTickets(result.data.tickets);
      setWeeklyWaterGlassesEarned((g) => g + 1);
      setMonthlyWaterGlassesEarned((g) => g + 1);
    } catch (err) {
      console.error(err);
      // Le serveur a refusé (pacing/anti-triche) -> on annule le glass local.
      setGlassesDrunk((g) => Math.max(0, g - 1));
      alert(err?.message || "Ce verre ne compte pas encore pour les tickets.");
    }
  };

  const handleRemoveWaterGlass = () => {
    setGlassesDrunk((g) => Math.max(0, g - 1));
  };

  const caloriesCurrent = todayMeals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
  const caloriesGoal = computeCalorieGoal(profile);
  const caloriesLeft = Math.max(0, caloriesGoal - caloriesCurrent);
  const weightGoal = profile.goalWeightKg;

  const waterGoalMl = Math.round(profile.weightKg * 35);
  const glassSizeMl = 250;
  const waterGoalGlasses = Math.max(1, Math.ceil(waterGoalMl / glassSizeMl));

  const macroTotals = todayMeals.reduce(
    (acc, m) => {
      acc.protein += parseGrams(m.protein);
      acc.fats += parseGrams(m.fats);
      acc.carbs += parseGrams(m.carbs);
      return acc;
    },
    { protein: 0, fats: 0, carbs: 0 }
  );

  const proteinGoal = Math.round(profile.weightKg * 2);
  const carbsGoal = Math.round((caloriesGoal * 0.45) / 4);
  const fatsGoal = Math.round((caloriesGoal * 0.25) / 9);

  const progressPct = Math.min(100, Math.round((caloriesCurrent / caloriesGoal) * 100));
  const weekStrip = buildWeekStrip(caloriesCurrent);

  const fetchAiCoachTip = async (mealsList) => {
    if (!API_KEY || mealsList.length === 0) return;
    setIsAnalyzingCoach(true);
    try {
      const currentProt = Math.round(mealsList.reduce((acc, m) => acc + parseGrams(m.protein), 0));
      const currentCal = mealsList.reduce((acc, m) => acc + (Number(m.calories) || 0), 0);

      const prompt = `User profile: Weight ${profile.weightKg}kg, Goal weight ${profile.goalWeightKg}kg, Calorie goal ${caloriesGoal}kcal, Protein goal ${proteinGoal}g. Today consumed: ${currentCal}kcal, Protein ${currentProt}g. Give a short, punchy, professional 2-sentence nutrition coach tip in English advising what they should eat next to hit their goal.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) setAiCoachTip(txt.trim());
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingCoach(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!API_KEY) {
      setErrorMessage("Gemini API key missing.");
      setScanState("error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setSelectedImage(base64String);
      setScanState("scanning");
      setErrorMessage("");

      try {
        const base64Data = base64String.split(",")[1];
        const promptText = `Look at this image. Is it food or a meal? Respond ONLY with a valid JSON object in this exact format: { "isFood": true/false, "name": "Name", "calories": number, "protein": "Xg", "fats": "Xg", "carbs": "Xg" }`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

        const apiPromise = fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: file.type || "image/jpeg", data: base64Data } }, { text: promptText }] }] })
        });

        const [res] = await Promise.all([apiPromise, new Promise((r) => setTimeout(r, 1400))]);

        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) throw new Error("No text in Gemini response");

        let cleanText = textResponse.trim().replace(/^```(json)?/, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanText);

        if (!parsed.isFood) {
          setErrorMessage("This is not food! Please upload a valid meal.");
          setScanState("error");
          return;
        }

        const newMeal = {
          id: `${Date.now()}`,
          name: parsed.name || "Custom Meal",
          calories: Number(parsed.calories) || 400,
          protein: parsed.protein || "25g",
          fats: parsed.fats || "15g",
          carbs: parsed.carbs || "40g",
          image: base64String,
          time: Date.now(),
        };

        const updatedMeals = [...todayMeals, newMeal];
        setMealData(newMeal);
        setTodayMeals(updatedMeals);
        setScanState("done");

        // Les tickets sont crédités par le serveur (anti-triche) : le
        // client ne peut plus juste "se donner" +10 tickets en rejouant
        // cette fonction depuis la console.
        try {
          const result = await callLogMealScanned();
          setTickets(result.data.tickets);
          setWeeklyTicketsEarned((v) => v + TICKETS_PER_MEAL);
          setMonthlyTicketsEarned((v) => v + TICKETS_PER_MEAL);
        } catch (ticketErr) {
          console.error("Ticket award failed:", ticketErr);
        }

        fetchAiCoachTip(updatedMeals);
      } catch (err) {
        setErrorMessage(err.message || "Error analyzing image.");
        setScanState("error");
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = () => fileInputRef.current && fileInputRef.current.click();
  const resetScan = () => { setSelectedImage(null); setScanState("idle"); };

  const ink = "#1B2430"; const rust = "#B5502E"; const moss = "#56705A"; const gold = "#A98A4B";
  const paper = "#F2F1EC"; const line = "#D8D3C6"; const nimiqOrange = "#E9B213";
  const blue = "#3E7CB1";

  const styles = {
    page: {
      minHeight: "100vh", width: "100%", background: paper,
      backgroundImage: "radial-gradient(circle at 1px 1px, rgba(27,36,48,0.05) 1px, transparent 0)",
      backgroundSize: "18px 18px", display: "flex", justifyContent: "center",
      fontFamily: "'Inter', sans-serif", padding: "40px 16px 60px", boxSizing: "border-box", color: ink,
    },
    container: { width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: "14px" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 6px" },
    brandMark: { fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px", color: ink },
    headerActions: { display: "flex", gap: "6px", alignItems: "center" },
    iconButton: {
      display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
      border: `1px solid ${line}`, borderRadius: "8px", background: "#FBFAF7", cursor: "pointer", color: ink,
    },
    iconButtonActive: {
      display: "flex", alignItems: "center", gap: "5px", padding: "0 10px", height: "32px",
      border: `1px solid ${nimiqOrange}`, borderRadius: "8px", background: "rgba(233,178,19,0.08)",
      color: "#8A6C0B", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10.5px", cursor: "pointer",
    },
    pillButton: {
      display: "flex", alignItems: "center", gap: "6px", padding: "0 12px", height: "32px",
      border: `1px solid ${ink}`, borderRadius: "8px", background: ink, color: "#FBFAF7",
      fontFamily: "'IBM Plex Mono', monospace", fontSize: "10.5px", letterSpacing: "0.04em", cursor: "pointer",
    },
    ticket: {
      background: "#FBFAF7", border: `1px solid ${line}`, borderRadius: "10px",
      boxShadow: "0 1px 2px rgba(27,36,48,0.04), 0 12px 24px rgba(27,36,48,0.05)",
    },
    ticketPad: { padding: "22px" },
    eyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.14em", color: "#9A9484", textTransform: "uppercase" },
    heroTitle: { fontFamily: "'Fraunces', serif", fontSize: "27px", fontWeight: 600, color: ink, margin: "0 0 8px", letterSpacing: "-0.4px", lineHeight: 1.15 },
    heroSubtitle: { fontSize: "13.5px", color: "#6B6656", margin: "0 0 22px", lineHeight: 1.55, maxWidth: "320px" },
    ctaButton: {
      width: "100%", marginTop: "16px", border: "none", cursor: "pointer", padding: "14px 18px",
      borderRadius: "8px", background: ink, color: "#F5F3EC", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "12.5px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500,
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    },
    ghostButton: {
      width: "100%", marginTop: "18px", border: `1px solid ${line}`, cursor: "pointer", padding: "11px 16px",
      borderRadius: "8px", background: "transparent", color: "#6B6656", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase",
    },
    nimiqPayButton: {
      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
      border: `1px solid ${nimiqOrange}`, cursor: "pointer", padding: "12px", borderRadius: "8px",
      background: "transparent", color: "#8A6C0B", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
      letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600,
    },
    weekRow: { display: "flex", justifyContent: "space-between" },
    weekDay: (isToday) => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }),
    weekDayLabel: (isToday) => ({
      fontFamily: "'IBM Plex Mono', monospace", fontSize: "9.5px", letterSpacing: "0.04em",
      color: isToday ? ink : "#9A9484", fontWeight: isToday ? 700 : 500,
    }),
    weekDayNum: { fontFamily: "'Fraunces', serif", fontSize: "12px", fontWeight: 600, color: ink },
    ringRow: { display: "flex", alignItems: "center", gap: "18px" },
    ringLeftLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.06em", color: "#9A9484", textTransform: "uppercase" },
    ringBigNumber: { fontFamily: "'Fraunces', serif", fontSize: "34px", fontWeight: 700, color: ink, lineHeight: 1 },
    ringGoalNote: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9A9484", marginTop: "4px" },
    macroRow: { display: "flex", justifyContent: "space-between", marginTop: "20px", paddingTop: "18px", borderTop: `1px dashed ${line}` },
    macroCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" },
    macroValue: { fontFamily: "'Fraunces', serif", fontSize: "14px", fontWeight: 600, color: ink },
    macroLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.08em", color: "#9A9484", textTransform: "uppercase" },
    mealRow: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: `1px solid ${line}` },
    mealThumb: { width: "44px", height: "44px", borderRadius: "8px", objectFit: "cover", flexShrink: 0, border: `1px solid ${line}` },
    mealThumbPlaceholder: {
      width: "44px", height: "44px", borderRadius: "8px", flexShrink: 0, background: "#EDEBE3",
      display: "flex", alignItems: "center", justifyContent: "center", color: "#9A9484",
    },
    mealName: { fontFamily: "'Fraunces', serif", fontSize: "14px", fontWeight: 600, color: ink },
    mealMacros: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "10.5px", color: "#9A9484", marginTop: "2px" },
    mealCalories: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 600, color: ink },
    waterGlassRow: { display: "flex", gap: "6px", flexWrap: "wrap", margin: "12px 0 4px" },
    waterGlass: (filled) => ({
      width: "24px", height: "32px", borderRadius: "3px 3px 8px 8px",
      border: `1.5px solid ${filled ? blue : line}`, background: filled ? "rgba(62,124,177,0.18)" : "transparent",
      cursor: "pointer", transition: "background 0.15s ease",
    }),
    waterStepButton: {
      width: "28px", height: "28px", borderRadius: "50%", border: `1px solid ${line}`, background: "#FBFAF7",
      color: ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    },
    inputStyle: { width: "100%", padding: "10px", margin: "6px 0 12px", background: "#F5F3EC", border: `1px solid ${line}`, borderRadius: "6px", fontFamily: "'Inter', sans-serif", fontSize: "13px", boxSizing: "border-box" },
    labelStyle: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "10.5px", color: "#6B6656", textTransform: "uppercase" },
    sectionHeader: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px 0", marginTop: "6px" },
    sectionHeaderText: { fontFamily: "'Fraunces', serif", fontSize: "16px", fontWeight: 700, color: ink },
    sectionHeaderLine: { flex: 1, height: "1px", background: line },
  };

  const macroRingData = [
    { label: "PROTEIN", value: macroTotals.protein, goal: proteinGoal, color: rust, Icon: IconDrumstick },
    { label: "CARBS", value: macroTotals.carbs, goal: carbsGoal, color: gold, Icon: IconWheat },
    { label: "FATS", value: macroTotals.fats, goal: fatsGoal, color: blue, Icon: IconDroplet },
  ];

  return (
    <div style={styles.page}>
      <style>{FONTS}</style>
      <div style={{ ...styles.container, paddingBottom: "70px" }}>

        {currentPage === "home" && (
        <>
        <div style={styles.header}>
          <span style={styles.brandMark}>NimiFit</span>
          <div style={styles.headerActions}>
            <button style={styles.iconButton} onClick={() => setCurrentPage("profile")} title="Profile & goals" aria-label="Profile & goals">
              <IconSettings size={15} />
            </button>
            <span style={styles.iconButtonActive} title={`${tickets} tickets`}>
              🎟️ {tickets}
            </span>
            <span style={styles.iconButtonActive} title={`${nimGiftBalance.toFixed(2)} NIM competition balance`}>
              <IconWallet size={13} color="#8A6C0B" /> {nimGiftBalance.toFixed(1)}
            </span>
            {!nimiqWalletAddress ? (
              <button style={styles.iconButton} onClick={handleNimiqConnect} title="Connect Nimiq wallet" aria-label="Connect Nimiq wallet">
                <IconWallet size={15} />
              </button>
            ) : (
              <button style={styles.iconButtonActive} title={`${nimiqWalletAddress} — click to disconnect`} onClick={handleDisconnectWallet}>
                <IconWallet size={13} color="#8A6C0B" />
                {String(nimiqWalletAddress).slice(0, 4)}…
              </button>
            )}
            {user ? (
              <button style={styles.iconButton} onClick={() => signOut(auth)} title="Log out" aria-label="Log out">
                <IconLogout size={14} />
              </button>
            ) : (
              <button style={styles.pillButton} onClick={handleGoogleLogin}>
                <IconGoogle size={13} /> Sign in
              </button>
            )}
          </div>
        </div>

        <div style={styles.ticket}>
          <div style={styles.ticketPad}>
            <div style={styles.eyebrow}>Account status</div>
            {!user ? (
              <div>
                <p style={{ ...styles.heroSubtitle, marginBottom: "12px", fontSize: "12px" }}>
                  Sign in to save your data across devices.
                </p>
                <form onSubmit={handleEmailAuth}>
                  <input
                    type="email"
                    placeholder="Email"
                    style={styles.inputStyle}
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    style={styles.inputStyle}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  {authError && (
                    <p style={{ color: rust, fontSize: "11.5px", margin: "-4px 0 10px" }}>{authError}</p>
                  )}
                  <button type="submit" style={{ ...styles.ctaButton, marginTop: 0 }}>
                    {authMode === "signup" ? "Create account" : "Log in"}
                  </button>
                </form>
                <button
                  type="button"
                  style={{ ...styles.ghostButton, marginTop: "10px" }}
                  onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}
                >
                  {authMode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
                </button>
                <button style={{ ...styles.pillButton, width: "100%", justifyContent: "center", marginTop: "10px" }} onClick={handleGoogleLogin}>
                  <IconGoogle size={13} /> Sign in with Google instead
                </button>
              </div>
            ) : isPro ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: moss, fontWeight: 600 }}>
                <IconCheck size={14} color={moss} /> Pro active — weekly analytics unlocked
              </div>
            ) : (
              <div>
                <p style={{ ...styles.heroSubtitle, marginBottom: "12px", fontSize: "12px" }}>
                  Upgrade to Pro via Nimiq Pay ({PRO_PRICE_NIM} NIM / month) for weekly analytics &amp; cloud sync.
                  {Math.round(NIM_GIFT_BACK_PCT * 100)}% of every payment ({Math.round(PRO_PRICE_NIM * NIM_GIFT_BACK_PCT)} NIM) is added to your Nimiq competition gift balance.
                </p>
                <button style={styles.nimiqPayButton} onClick={handleNimiqCheckout}>
                  <IconWallet size={14} /> Pay {PRO_PRICE_NIM} NIM with Nimiq Pay
                </button>
                {!nimiqReady && (
                  <p style={{ fontSize: "11px", color: "#9A9484", marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace" }}>
                    Nimiq wallet not detected — open this app from inside Nimiq Pay to pay.
                  </p>
                )}
                {tickets >= TICKETS_FOR_FREE_MONTH && (
                  <button
                    style={{ ...styles.ghostButton, marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    onClick={handleRedeemTicketsForMonth}
                    disabled={isRedeeming}
                  >
                    <IconGift size={13} /> {isRedeeming ? "Redeeming…" : `Redeem ${TICKETS_FOR_FREE_MONTH} tickets for a free month`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={styles.ticket}>
          <div style={styles.ticketPad}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={styles.eyebrow}>Tickets</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 700, color: gold }}>{tickets}</span>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: "#EDEBE3", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, Math.round((tickets / TICKETS_FOR_FREE_MONTH) * 100))}%`,
                background: gold,
                transition: "width 0.4s ease",
              }} />
            </div>
            <p style={{ fontSize: "11px", color: "#9A9484", marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace" }}>
              {tickets} / {TICKETS_FOR_FREE_MONTH} — {Math.min(100, Math.round((tickets / TICKETS_FOR_FREE_MONTH) * 100))}% to a free month
            </p>
            <p style={{ fontSize: "11px", color: "#6B6656", marginTop: "6px" }}>
              +{TICKETS_PER_MEAL} per meal scanned · +{TICKETS_PER_WATER} per glass of water
            </p>
            {isPro && tickets >= TICKETS_FOR_FREE_MONTH && (
              <button
                style={{ ...styles.ghostButton, marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                onClick={handleRedeemTicketsForMonth}
                disabled={isRedeeming}
              >
                <IconGift size={13} /> {isRedeeming ? "Redeeming…" : "Redeem for next month"}
              </button>
            )}
          </div>
        </div>

        <div style={styles.ticket}>
          <div style={{ ...styles.ticketPad, paddingBottom: "16px" }}>
            <div style={styles.weekRow}>
              {weekStrip.map((day) => {
                const pct = caloriesGoal ? Math.min(100, Math.round((day.kcal / caloriesGoal) * 100)) : 0;
                return (
                  <div key={day.dateNum + day.label} style={styles.weekDay(day.isToday)}>
                    <span style={styles.weekDayLabel(day.isToday)}>{day.label}</span>
                    <RingProgress size={32} stroke={2.5} pct={pct} fillColor={day.isToday ? rust : moss}>
                      <span style={styles.weekDayNum}>{day.dateNum}</span>
                    </RingProgress>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={styles.ticket}>
          <div style={styles.ticketPad}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <span style={styles.eyebrow}>Today</span>
              <span style={{ ...styles.eyebrow, color: gold }}>TARGET {weightGoal}kg</span>
            </div>

            <div style={styles.ringRow}>
              <RingProgress size={112} stroke={11} pct={progressPct} fillColor={rust}>
                <IconFlame size={18} color={rust} />
                <span style={styles.ringBigNumber}>{caloriesLeft}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9.5px", color: "#9A9484" }}>left</span>
              </RingProgress>
              <div>
                <div style={styles.ringLeftLabel}>Calories</div>
                <div style={styles.ringGoalNote}>{caloriesCurrent} eaten / {caloriesGoal} goal</div>
                <div style={styles.ringGoalNote}>{progressPct}% of today's target</div>
              </div>
            </div>

            <div style={styles.macroRow}>
              {macroRingData.map(({ label, value, goal, color, Icon }) => {
                const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
                return (
                  <div key={label} style={styles.macroCol}>
                    <RingProgress size={54} stroke={5} pct={pct} fillColor={color}>
                      <Icon size={16} color={color} />
                    </RingProgress>
                    <span style={styles.macroValue}>{Math.round(value)}g / {goal}g</span>
                    <span style={styles.macroLabel}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={styles.ticket}>
          <div style={styles.ticketPad}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={styles.eyebrow}>Gemini Nutrition Coach</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9.5px", color: moss }}>
                {isAnalyzingCoach ? "Thinking…" : "Active"}
              </span>
            </div>
            <p style={{ fontSize: "13px", color: ink, margin: "8px 0 0", lineHeight: "1.5", fontStyle: "italic" }}>
              "{aiCoachTip}"
            </p>
          </div>
        </div>

        <div style={styles.ticket}>
          <div style={styles.ticketPad}>
            <div style={styles.eyebrow}>Ticket No. 0042 — Today</div>

            {scanState === "idle" && (
              <>
                <h2 style={styles.heroTitle}>Scan your meal</h2>
                <p style={styles.heroSubtitle}>Photograph what you're eating. Gemini AI will instantly itemize it like a receipt.</p>
                <button style={styles.ctaButton} onClick={triggerUpload}>
                  <IconPlus size={12} color="#F5F3EC" /> Scan meal with AI
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              </>
            )}

            {scanState === "scanning" && (
              <div style={{ textAlign: "center" }}>
                <div className="scanner-box" style={{ width: "100%", height: "200px", borderRadius: "8px", overflow: "hidden", marginBottom: "14px", border: `1px solid ${rust}`, position: "relative" }}>
                  <div className="laser-line" />
                  <img src={selectedImage} alt="Scanning meal" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.05) brightness(0.95)" }} />
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11.5px", color: rust, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
                  Analyzing visual contours &amp; macros…
                </div>
              </div>
            )}

            {scanState === "error" && (
              <>
                <p style={{ color: rust, fontSize: "13px", marginBottom: "12px" }}>{errorMessage}</p>
                <button style={styles.ghostButton} onClick={resetScan}>Try again</button>
              </>
            )}

            {scanState === "done" && (
              <>
                {selectedImage && (
                  <div style={{ width: "100%", height: "140px", borderRadius: "8px", overflow: "hidden", marginBottom: "12px", border: `1px solid ${line}` }}>
                    <img src={selectedImage} alt="Scanned meal" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <h2 style={styles.heroTitle}>{mealData.name}</h2>
                <p style={styles.heroSubtitle}>{mealData.calories} kcal · P {mealData.protein} · F {mealData.fats} · C {mealData.carbs}</p>
                <button style={styles.ghostButton} onClick={resetScan}>Scan another meal</button>
              </>
            )}
          </div>
        </div>

        {todayMeals.length > 0 && (
          <div style={styles.ticket}>
            <div style={styles.ticketPad}>
              <div style={{ ...styles.eyebrow, marginBottom: "6px" }}>Recently logged</div>
              {[...todayMeals].reverse().map((meal) => (
                <div key={meal.id} style={styles.mealRow}>
                  {meal.image ? (
                    <img src={meal.image} alt={meal.name} style={styles.mealThumb} />
                  ) : (
                    <div style={styles.mealThumbPlaceholder}><IconFlame size={16} /></div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={styles.mealName}>{meal.name}</div>
                    <div style={styles.mealMacros}>P {meal.protein} · F {meal.fats} · C {meal.carbs}</div>
                  </div>
                  <div style={styles.mealCalories}>{meal.calories} kcal</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={styles.ticket}>
          <div style={styles.ticketPad}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={styles.eyebrow}>Water intake</span>
              <span style={{ ...styles.eyebrow, color: gold }}>{glassesDrunk} / {waterGoalGlasses} glasses</span>
            </div>
            <div style={styles.waterGlassRow}>
              {Array.from({ length: Math.max(waterGoalGlasses, glassesDrunk) }).map((_, i) => (
                <div key={i} style={styles.waterGlass(i < glassesDrunk)} />
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button style={styles.waterStepButton} onClick={handleRemoveWaterGlass} aria-label="Remove glass"><IconMinus /></button>
              <button style={styles.waterStepButton} onClick={handleAddWaterGlass} aria-label="Add glass"><IconPlus /></button>
            </div>
            <p style={{ fontSize: "10.5px", color: "#9A9484", marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace" }}>
              1 glass every ~{Math.round(getWaterIntervalMs() / 60000)} min to earn tickets
            </p>
          </div>
        </div>

        <div style={styles.ticket}>
          <div style={styles.ticketPad}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={styles.eyebrow}>Weekly calorie trends</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9.5px", color: isPro ? moss : rust }}>
                {isPro ? <><IconCheck size={11} color={moss} /> Unlocked</> : <><IconLock size={11} color={rust} /> Pro locked</>}
              </span>
            </div>

            {isPro ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "12px 4px 0", background: "#F5F3EC", borderRadius: "8px", border: `1px solid ${line}` }}>
                {weekStrip.map((item) => {
                  const fillPct = Math.min(100, Math.round((item.kcal / 3500) * 100));
                  const cupColor = item.isToday ? rust : moss;
                  return (
                    <div key={item.dateNum} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", flex: 1 }}>
                      <div style={{ fontSize: "8px", fontFamily: "'IBM Plex Mono', monospace", color: "#6B6656" }}>{item.kcal}</div>
                      <div style={{ position: "relative", width: "16px", height: "48px", borderRadius: "3px 3px 8px 8px", border: `1.5px solid ${cupColor}`, overflow: "hidden", background: "transparent" }}>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${fillPct}%`, background: item.isToday ? "rgba(181,80,46,0.30)" : "rgba(86,112,90,0.22)", borderTop: `1.5px solid ${cupColor}`, transition: "height 0.5s ease" }} />
                      </div>
                      <div style={{ fontSize: "9px", fontFamily: "'IBM Plex Mono', monospace", color: item.isToday ? ink : "#9A9484", fontWeight: item.isToday ? 700 : 500 }}>{item.label}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "16px", textAlign: "center", background: "#F5F3EC", borderRadius: "8px", border: `1px solid ${line}` }}>
                <p style={{ fontSize: "12px", color: "#6B6656", margin: "0 0 8px" }}>
                  Unlock weekly history charts &amp; decentralized cloud sync with Pro.
                </p>
                <button style={{ ...styles.ghostButton, marginTop: 0, fontSize: "10px", padding: "8px" }} onClick={handleNimiqCheckout}>
                  Pay with Nimiq
                </button>
              </div>
            )}
          </div>
        </div>
        </>
        )}

        {currentPage === "competitions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "0 4px 6px" }}>
              <span style={styles.brandMark}>🏆 Competitions</span>
            </div>

            {leaderboardsLoading && (
              <p style={{ fontSize: "10.5px", color: "#9A9484", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>Loading leaderboards…</p>
            )}

            {/* ===================== CHALLENGES (staked with tickets) ===================== */}
            <div style={styles.sectionHeader}>
              <span style={styles.sectionHeaderText}>🎯 Challenges</span>
              <span style={styles.sectionHeaderLine} />
            </div>

            {/* Weekly Tickets Stake */}
            <div style={{
              background: `linear-gradient(135deg, ${rust}, #8a3a20)`, borderRadius: "14px", padding: "20px",
              color: "#F5F3EC", boxShadow: "0 8px 20px rgba(181,80,46,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.85, textTransform: "uppercase" }}>Touch Grass · Weekly</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>Stake your tickets</div>
                </div>
                <div style={{ fontSize: "22px" }}>🎟️</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getWeeklyCountdown().label}
              </div>
              <StakeInput value={weeklyTicketStakeInput} onChange={setWeeklyTicketStakeInput} onEnter={handleJoinWeeklyTicketCompetition} maxBalance={tickets} entered={weeklyTicketEntered} color="#1B2430" textColor="#F5F3EC" disabled={joiningCompetition === "tickets_weekly"} />
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.85 }}>Your balance: {tickets} tickets — enter any amount you like · Winner earns +{WEEKLY_WINNER_BONUS_PCT * 100}% bonus</p>
              <Leaderboard entries={weeklyTicketLeaderboard} valueKey="stake" valueSuffix=" tickets" currentUid={user?.uid} dark />
            </div>

            {/* Monthly Tickets Stake */}
            <div style={{
              background: `linear-gradient(135deg, ${gold}, #7a6234)`, borderRadius: "14px", padding: "20px",
              color: "#F5F3EC", boxShadow: "0 8px 20px rgba(169,138,75,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.85, textTransform: "uppercase" }}>Monthly Challenge</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>Stake your tickets</div>
                </div>
                <div style={{ fontSize: "22px" }}>🏅</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getMonthlyCountdown().label}
              </div>
              <StakeInput value={monthlyTicketStakeInput} onChange={setMonthlyTicketStakeInput} onEnter={handleJoinMonthlyTicketCompetition} maxBalance={tickets} entered={monthlyTicketEntered} color="#1B2430" textColor="#F5F3EC" disabled={joiningCompetition === "tickets_monthly"} />
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.85 }}>Your balance: {tickets} tickets — enter any amount you like · Winner earns +{MONTHLY_WINNER_BONUS_PCT * 100}% bonus</p>
              <Leaderboard entries={monthlyTicketLeaderboard} valueKey="stake" valueSuffix=" tickets" currentUid={user?.uid} dark />
            </div>

            {/* Weekly Stay Hydrated */}
            <div style={{
              background: "linear-gradient(135deg, #3E7CB1, #234a68)", borderRadius: "14px", padding: "20px",
              color: "#F5F3EC", boxShadow: "0 8px 20px rgba(62,124,177,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.85, textTransform: "uppercase" }}>Stay Hydrated · Weekly</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>{weeklyWaterGlassesEarned} glasses</div>
                </div>
                <div style={{ fontSize: "22px" }}>💧</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getWeeklyCountdown().label}
              </div>
              <StakeInput value={weeklyWaterStakeInput} onChange={setWeeklyWaterStakeInput} onEnter={handleJoinWeeklyWaterCompetition} maxBalance={tickets} entered={weeklyWaterEntered} color="#F5F3EC" textColor="#F5F3EC" disabled={joiningCompetition === "water_weekly"} />
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.85 }}>Ranked by glasses logged this week · Winner earns +{WEEKLY_WINNER_BONUS_PCT * 100}% bonus</p>
              <Leaderboard entries={weeklyWaterLeaderboard} valueKey="metric" valueSuffix=" glasses" currentUid={user?.uid} dark />
            </div>

            {/* Monthly Stay Hydrated */}
            <div style={{
              background: "linear-gradient(135deg, #2E5F8A, #16324a)", borderRadius: "14px", padding: "20px",
              color: "#F5F3EC", boxShadow: "0 8px 20px rgba(46,95,138,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.85, textTransform: "uppercase" }}>Stay Hydrated · Monthly</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>{monthlyWaterGlassesEarned} glasses</div>
                </div>
                <div style={{ fontSize: "22px" }}>🌊</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getMonthlyCountdown().label}
              </div>
              <StakeInput value={monthlyWaterStakeInput} onChange={setMonthlyWaterStakeInput} onEnter={handleJoinMonthlyWaterCompetition} maxBalance={tickets} entered={monthlyWaterEntered} color="#F5F3EC" textColor="#F5F3EC" disabled={joiningCompetition === "water_monthly"} />
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.85 }}>Ranked by glasses logged this month · Winner earns +{MONTHLY_WINNER_BONUS_PCT * 100}% bonus</p>
              <Leaderboard entries={monthlyWaterLeaderboard} valueKey="metric" valueSuffix=" glasses" currentUid={user?.uid} dark />
            </div>

            {/* Weekly Weight Goal */}
            <div style={{
              background: "linear-gradient(135deg, #56705A, #2e3d30)", borderRadius: "14px", padding: "20px",
              color: "#F5F3EC", boxShadow: "0 8px 20px rgba(86,112,90,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.85, textTransform: "uppercase" }}>Weight Goal Sprint · Weekly</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
                    {computeWeightProgressPct(weeklyWeightStart ?? profile.weightKg, profile.weightKg, profile.goalWeightKg)}% progress
                  </div>
                </div>
                <div style={{ fontSize: "22px" }}>⚖️</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getWeeklyCountdown().label}
              </div>
              <StakeInput value={weeklyWeightStakeInput} onChange={setWeeklyWeightStakeInput} onEnter={handleJoinWeeklyWeightCompetition} maxBalance={tickets} entered={weeklyWeightEntered} color="#F5F3EC" textColor="#F5F3EC" disabled={joiningCompetition === "weight_weekly"} />
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.85 }}>Ranked by % progress toward your own goal weight (not raw kg) · Winner earns +{WEEKLY_WINNER_BONUS_PCT * 100}% bonus</p>
              <Leaderboard entries={weeklyWeightLeaderboard} valueKey="metric" valueSuffix="% progress" currentUid={user?.uid} dark />
            </div>

            {/* Monthly Weight Goal */}
            <div style={{
              background: "linear-gradient(135deg, #3a4d3d, #1c261d)", borderRadius: "14px", padding: "20px",
              color: "#F5F3EC", boxShadow: "0 8px 20px rgba(58,77,61,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.85, textTransform: "uppercase" }}>Weight Goal Sprint · Monthly</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
                    {computeWeightProgressPct(monthlyWeightStart ?? profile.weightKg, profile.weightKg, profile.goalWeightKg)}% progress
                  </div>
                </div>
                <div style={{ fontSize: "22px" }}>👑</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getMonthlyCountdown().label}
              </div>
              <StakeInput value={monthlyWeightStakeInput} onChange={setMonthlyWeightStakeInput} onEnter={handleJoinMonthlyWeightCompetition} maxBalance={tickets} entered={monthlyWeightEntered} color="#F5F3EC" textColor="#F5F3EC" disabled={joiningCompetition === "weight_monthly"} />
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.85 }}>Ranked by % progress toward your own goal weight (not raw kg) · Winner earns +{MONTHLY_WINNER_BONUS_PCT * 100}% bonus</p>
              <Leaderboard entries={monthlyWeightLeaderboard} valueKey="metric" valueSuffix="% progress" currentUid={user?.uid} dark />
            </div>

            {/* ===================== NIMIQ (staked with the NIM gift balance earned from Pro subscription) ===================== */}
            <div style={styles.sectionHeader}>
              <span style={{ ...styles.sectionHeaderText, color: "#8A6C0B" }}>🔶 Nimiq</span>
              <span style={styles.sectionHeaderLine} />
            </div>
            <p style={{ fontSize: "10.5px", color: "#9A9484", padding: "0 4px", marginTop: "-6px" }}>
              Funded by your Nimiq Pay subscription — {Math.round(PRO_PRICE_NIM * NIM_GIFT_BACK_PCT)} NIM/month, locked (competition entries only, cannot be withdrawn).
            </p>

            {/* Weekly NIM */}
            <div style={{
              background: `linear-gradient(135deg, ${nimiqOrange}, #b8860f)`, borderRadius: "14px", padding: "20px",
              color: "#1B2430", boxShadow: "0 8px 20px rgba(233,178,19,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.75, textTransform: "uppercase" }}>Touch Grass · Weekly</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>Stake what you want</div>
                </div>
                <div style={{ fontSize: "22px" }}>💰</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.12)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getWeeklyCountdown().label}
              </div>
              {weeklyNimEntered ? (
                <div style={{ marginTop: "12px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700 }}>✓ You're in — good luck!</div>
              ) : (
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={nimGiftBalance}
                    value={weeklyNimStakeInput}
                    onChange={(e) => setWeeklyNimStakeInput(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(27,36,48,0.25)", background: "rgba(255,255,255,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#1B2430", boxSizing: "border-box" }}
                  />
                  <button
                    style={{ border: "none", borderRadius: "8px", padding: "10px 14px", background: "#1B2430", color: "#F5F3EC", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", opacity: joiningCompetition === "nim_weekly" ? 0.6 : 1 }}
                    disabled={joiningCompetition === "nim_weekly" || !(parseFloat(weeklyNimStakeInput) > 0) || parseFloat(weeklyNimStakeInput) > nimGiftBalance}
                    onClick={handleJoinWeeklyNimCompetition}
                  >
                    Enter
                  </button>
                </div>
              )}
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.75 }}>Gift balance: {nimGiftBalance.toFixed(2)} NIM</p>
              <Leaderboard entries={weeklyNimLeaderboard} valueKey="stake" valueSuffix=" NIM" currentUid={user?.uid} dark />
            </div>

            {/* Monthly NIM */}
            <div style={{
              background: `linear-gradient(135deg, ${moss}, #33452f)`, borderRadius: "14px", padding: "20px",
              color: "#F5F3EC", boxShadow: "0 8px 20px rgba(86,112,90,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", opacity: 0.85, textTransform: "uppercase" }}>Monthly Challenge</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>Stake what you want</div>
                </div>
                <div style={{ fontSize: "22px" }}>👑</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
                ⏱ ends in {getMonthlyCountdown().label}
              </div>
              {monthlyNimEntered ? (
                <div style={{ marginTop: "12px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700 }}>✓ You're in — good luck!</div>
              ) : (
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={nimGiftBalance}
                    value={monthlyNimStakeInput}
                    onChange={(e) => setMonthlyNimStakeInput(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#F5F3EC", boxSizing: "border-box" }}
                  />
                  <button
                    style={{ border: "none", borderRadius: "8px", padding: "10px 14px", background: "#F5F3EC", color: moss, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", opacity: joiningCompetition === "nim_monthly" ? 0.6 : 1 }}
                    disabled={joiningCompetition === "nim_monthly" || !(parseFloat(monthlyNimStakeInput) > 0) || parseFloat(monthlyNimStakeInput) > nimGiftBalance}
                    onClick={handleJoinMonthlyNimCompetition}
                  >
                    Enter
                  </button>
                </div>
              )}
              <p style={{ fontSize: "10px", marginTop: "6px", opacity: 0.8 }}>Gift balance: {nimGiftBalance.toFixed(2)} NIM</p>
              <Leaderboard entries={monthlyNimLeaderboard} valueKey="stake" valueSuffix=" NIM" currentUid={user?.uid} />
            </div>

          </div>
        )}

        {currentPage === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "0 4px 6px" }}>
              <span style={styles.brandMark}>Profile</span>
            </div>
            <div style={styles.ticket}>
              <div style={styles.ticketPad}>
                <div style={styles.eyebrow}>Account</div>
                {user ? (
                  <>
                    <p style={{ fontSize: "13px", color: ink, margin: "8px 0 16px" }}>{user.email}</p>
                    <button style={styles.ghostButton} onClick={() => signOut(auth)}>
                      <IconLogout size={13} style={{ marginRight: "6px" }} /> Log out
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: "13px", color: "#6B6656" }}>Sign in from the Home tab to save your progress.</p>
                )}
              </div>
            </div>
            <div style={styles.ticket}>
              <div style={styles.ticketPad}>
                <div style={{ ...styles.eyebrow, color: rust, marginBottom: "12px" }}>Profile &amp; Goals</div>
                <form onSubmit={handleSaveProfile}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.labelStyle}>Weight (kg)</label>
                      <input type="number" style={styles.inputStyle} value={tempProfile.weightKg} onChange={(e) => setTempProfile({ ...tempProfile, weightKg: Number(e.target.value) })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.labelStyle}>Target weight (kg)</label>
                      <input type="number" style={styles.inputStyle} value={tempProfile.goalWeightKg} onChange={(e) => setTempProfile({ ...tempProfile, goalWeightKg: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.labelStyle}>Height (cm)</label>
                      <input type="number" style={styles.inputStyle} value={tempProfile.heightCm} onChange={(e) => setTempProfile({ ...tempProfile, heightCm: Number(e.target.value) })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.labelStyle}>Age</label>
                      <input type="number" style={styles.inputStyle} value={tempProfile.age} onChange={(e) => setTempProfile({ ...tempProfile, age: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.labelStyle}>Gender</label>
                      <select style={styles.inputStyle} value={tempProfile.gender} onChange={(e) => setTempProfile({ ...tempProfile, gender: e.target.value })}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.labelStyle}>Activity</label>
                      <select style={styles.inputStyle} value={tempProfile.activity} onChange={(e) => setTempProfile({ ...tempProfile, activity: e.target.value })}>
                        <option value="sedentary">Sedentary</option>
                        <option value="light">Light</option>
                        <option value="moderate">Moderate</option>
                        <option value="active">Active</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" style={{ ...styles.ctaButton, marginTop: "10px" }}>Save profile</button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom navigation */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", justifyContent: "center", background: "#FBFAF7",
        borderTop: `1px solid ${line}`, padding: "10px 0",
      }}>
        <div style={{ display: "flex", width: "100%", maxWidth: "440px", justifyContent: "space-around" }}>
          {[
            { key: "home", label: "Home", icon: "🏠" },
            { key: "competitions", label: "Compete", icon: "🏆" },
            { key: "profile", label: "Profile", icon: "⚙️" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCurrentPage(tab.key)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                background: "none", border: "none", cursor: "pointer",
                color: currentPage === tab.key ? rust : "#9A9484",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: currentPage === tab.key ? 700 : 500,
              }}
            >
              <span style={{ fontSize: "18px" }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
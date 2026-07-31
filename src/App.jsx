<<<<<<< HEAD
import React, { useEffect, useRef, useState } from "react";
=======
import React, { useEffect, useMemo, useRef, useState } from "react";
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
<<<<<<< HEAD
import { init as initNimiq } from "@nimiq/mini-app-sdk";
import { auth, db, googleProvider } from "./lib/firebase";
import { callApi } from "./lib/api";
import TouchGrass from "./TouchGrass";
import "./App.css";

const callAnalyzeMeal = (p) => callApi("analyzeMeal", p);
const callLogMealScanned = (p) => callApi("logMealScanned", p);
const callLogWaterGlass = (p) => callApi("logWaterGlass", p);
const callJoinCompetition = (p) => callApi("joinCompetition", p);
const callConfirmNimiqPayment = (p) => callApi("confirmNimiqPayment", p);
const callRedeemTickets = (p) => callApi("redeemTicketsForFreeMonth", p);
=======
import { httpsCallable } from "firebase/functions";
import { init as initNimiq } from "@nimiq/mini-app-sdk";
import { auth, db, functions, googleProvider } from "./lib/firebase";
import TouchGrass from "./TouchGrass";
import "./App.css";

const callAnalyzeMeal = httpsCallable(functions, "analyzeMeal");
const callLogMealScanned = httpsCallable(functions, "logMealScanned");
const callLogWaterGlass = httpsCallable(functions, "logWaterGlass");
const callJoinCompetition = httpsCallable(functions, "joinCompetition");
const callConfirmNimiqPayment = httpsCallable(functions, "confirmNimiqPayment");
const callRedeemTickets = httpsCallable(functions, "redeemTicketsForFreeMonth");
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068

const MEAL_TICKETS = 20;
const WATER_TICKETS = 5;
const POST_TICKETS = 50;
const FREE_MONTH_TICKETS = 3700;
const PRO_PRICE_NIM = 100;
const LUNAS_PER_NIM = 100000;
const RECEIVING_ADDRESS = "NQ78 SF1K A42M CPT7 0LDP YT52 A747 8DB6 PX7P";

const DEFAULT_PROFILE = {
  gender: "male",
  age: 19,
  heightCm: 175,
  weightKg: 80,
  goalWeightKg: 84,
  activity: "moderate",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 1) % 7));
  return d.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 7);
}

function parseNumber(value) {
<<<<<<< HEAD
  const numberVal = Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(numberVal) ? numberVal : 0;
=======
  const number = Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
}

function goals(profile) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const multiplier = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }[p.activity] || 1.55;
  const bmr = p.gender === "female"
    ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161
    : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5;
  const tdee = bmr * multiplier;
  const calories = p.goalWeightKg < p.weightKg ? tdee - 400 : p.goalWeightKg > p.weightKg ? tdee + 250 : tdee;
  return {
    calories: Math.max(1200, Math.round(calories)),
    protein: Math.round(p.weightKg * 1.8),
    carbs: Math.round((calories * 0.45) / 4),
    fats: Math.round((calories * 0.25) / 9),
    water: Math.max(1, Math.ceil((p.weightKg * 35) / 250)),
  };
}

function errorText(error) {
  const code = error?.code || "";
  if (code.includes("unauthenticated")) return "Sign in first.";
  if (code.includes("resource-exhausted")) return "Slow down a little, then try again.";
  if (code.includes("failed-precondition")) return error.message || "This action is not ready yet.";
  return error?.message || "Something went wrong. Try again.";
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ProgressBar({ value, color = "var(--orange)" }) {
<<<<<<< HEAD
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
=======
  return <div className="progress"><span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} /></div>;
}

function Ring({ value, label, color = "var(--orange)" }) {
  return (
    <div className="ring" style={{ "--value": `${Math.min(100, Math.max(0, value))}%`, "--ring": color }}>
      <div className="ring-inner"><strong>{label}</strong></div>
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
    </div>
  );
}

<<<<<<< HEAD
function Ring({ value, label, color = "var(--orange)" }) {
  return (
    <div className="ring" style={{ "--value": `${Math.min(100, Math.max(0, value))}%`, "--ring": color }}>
      <div className="ring-inner"><strong>{label}</strong></div>
    </div>
  );
}

function AuthPanel({ onClose }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <span>Account</span>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
=======
function AuthPanel({ onClose }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head"><span>Account</span><button className="icon-button" onClick={onClose}>×</button></div>
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
        <h2>{mode === "signup" ? "Start your streak" : "Welcome back"}</h2>
        <p className="muted">Save your meals, tickets and progress across devices.</p>
        <form onSubmit={submit} className="stack">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password, 6+ characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          {error && <p className="error">{error}</p>}
<<<<<<< HEAD
          <button className="primary-button" disabled={busy}>
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>
        <button className="secondary-button" onClick={google} disabled={busy}>Continue with Google</button>
        <button className="text-button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
          {mode === "signup" ? "Already have an account" : "Create a new account"}
        </button>
=======
          <button className="primary-button" disabled={busy}>{busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}</button>
        </form>
        <button className="secondary-button" onClick={google} disabled={busy}>Continue with Google</button>
        <button className="text-button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Already have an account" : "Create a new account"}</button>
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
      </div>
    </div>
  );
}

function Home({ user, profile, setProfile, account, setAccount, day, setDay, wallet, setWallet, openAuth }) {
  const [scanState, setScanState] = useState("idle");
  const [scanError, setScanError] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
<<<<<<< HEAD
  const [coachTip, setCoachTip] = useState("Scan a meal and I'll turn it into a clear next move.");
  const [waterBusy, setWaterBusy] = useState(false);
  const fileRef = useRef(null);

=======
  const [coachTip, setCoachTip] = useState("Scan a meal and I’ll turn it into a clear next move.");
  const [waterBusy, setWaterBusy] = useState(false);
  const fileRef = useRef(null);
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
  const target = goals(profile);
  const meals = day?.meals || [];
  const calories = meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const protein = meals.reduce((sum, meal) => sum + parseNumber(meal.protein), 0);
  const carbs = meals.reduce((sum, meal) => sum + parseNumber(meal.carbs), 0);
  const fats = meals.reduce((sum, meal) => sum + parseNumber(meal.fats), 0);
  const glasses = day?.glasses || 0;
  const waterLocked = day?.nextWaterAt && Date.now() < day.nextWaterAt;
  const minutesLeft = waterLocked ? Math.ceil((day.nextWaterAt - Date.now()) / 60000) : 0;

  async function scan(file) {
    if (!file || !user) return openAuth();
    setScanState("scanning");
    setScanError("");
    try {
      const imageData = await compressImage(file);
      setSelectedImage(imageData);
      const analysis = await callAnalyzeMeal({ imageData });
      const meal = analysis.data.meal;
      const mealId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await callLogMealScanned({ mealId, meal });
      setAccount((current) => ({ ...current, tickets: result.data.tickets }));
      setDay((current) => ({ ...current, ...result.data.day }));
      setCoachTip(result.data.tip || "Nice. Keep the next meal protein-forward and simple.");
      setScanState("done");
    } catch (err) {
      setScanError(errorText(err));
      setScanState("error");
    }
  }

  async function addWater() {
    if (!user) return openAuth();
    if (waterLocked || waterBusy) return;
    setWaterBusy(true);
    try {
      const result = await callLogWaterGlass({ eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      setAccount((current) => ({ ...current, tickets: result.data.tickets }));
      setDay((current) => ({ ...current, ...result.data.day, nextWaterAt: result.data.nextWaterAt }));
    } catch (err) {
      setScanError(errorText(err));
    } finally {
      setWaterBusy(false);
    }
  }

  return (
    <main className="page-wrap">
      <header className="topbar">
<<<<<<< HEAD
        <div>
          <span className="eyebrow">Nimiq Pay wellness</span>
          <h1>NimiFit</h1>
        </div>
        <div className="top-actions">
          <span className="ticket-chip">🎟 {account.tickets || 0}</span>
          <button className="avatar" onClick={user ? undefined : openAuth}>
            {user ? (user.displayName || user.email || "U").slice(0, 1).toUpperCase() : "↗"}
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <span className="eyebrow">Today, {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
          <h2>Small wins, <em>stacked.</em></h2>
          <p>Scan what you eat, drink water, touch grass, and let your progress earn its place.</p>
        </div>
        <div className="hero-stamp">{account.tickets >= FREE_MONTH_TICKETS ? "FREE MONTH" : `${FREE_MONTH_TICKETS - (account.tickets || 0)} TO PRO`}</div>
      </section>

      {!user && (
        <button className="notice" onClick={openAuth}>
          Sign in to save your progress <span>→</span>
        </button>
      )}

      <section className="metrics-grid">
        <div className="metric-card metric-main">
          <div>
            <span className="eyebrow">Calories left</span>
            <strong>{Math.max(0, target.calories - calories)}</strong>
            <span className="muted">of {target.calories} kcal</span>
          </div>
          <Ring value={(calories / target.calories) * 100} label={`${Math.round((calories / target.calories) * 100)}%`} />
        </div>
        <div className="metric-card">
          <span className="eyebrow">Protein</span>
          <strong>{Math.round(protein)}g</strong>
          <ProgressBar value={(protein / target.protein) * 100} color="var(--rust)" />
          <span className="muted">target {target.protein}g</span>
        </div>
        <div className="metric-card">
          <span className="eyebrow">Hydration</span>
          <strong>{glasses}<small>/{target.water}</small></strong>
          <ProgressBar value={(glasses / target.water) * 100} color="var(--blue)" />
          <span className="muted">250 ml glasses</span>
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <div>
            <span className="eyebrow">The daily loop</span>
            <h3>Log, earn, repeat</h3>
          </div>
          <span className="section-count">+{MEAL_TICKETS} meal · +{WATER_TICKETS} water</span>
        </div>
        <div className="scan-card">
          <div className="scan-art">
            {scanState === "scanning" ? (
              <div className="scan-line" />
            ) : selectedImage ? (
              <img src={selectedImage} alt="Selected meal" />
            ) : (
              <span>🥗</span>
            )}
          </div>
          <div className="scan-copy">
            <span className="eyebrow">Gemini meal scan</span>
            <h3>
              {scanState === "scanning"
                ? "Reading your plate…"
                : scanState === "done"
                ? "Meal logged"
                : "Make food logging painless"}
            </h3>
            <p>
              {scanState === "done"
                ? "Your nutrition and ticket balance are updated."
                : "One photo, estimated calories and macros, no spreadsheet energy."}
            </p>
            {scanError && <p className="error">{scanError}</p>}
            <button className="primary-button" onClick={() => fileRef.current?.click()} disabled={scanState === "scanning"}>
              {scanState === "scanning" ? "Analyzing…" : "Scan a meal"}
            </button>
            <input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => scan(e.target.files?.[0])} />
          </div>
        </div>
      </section>

      <section className="section-block water-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">Hydration</span>
            <h3>Keep the glass moving</h3>
          </div>
          <span className="water-number">{glasses}/{target.water}</span>
        </div>
        <div className="glasses">
          {Array.from({ length: Math.max(target.water, glasses) }).map((_, i) => (
            <span key={i} className={i < glasses ? "glass filled" : "glass"}>⌄</span>
          ))}
        </div>
        <button
          className="water-button"
          onClick={addWater}
          disabled={waterBusy || waterLocked || glasses >= target.water}
        >
          {waterBusy
            ? "Saving…"
            : waterLocked
            ? `Next glass in ${minutesLeft} min`
            : glasses >= target.water
            ? "Daily target reached"
            : "+ Add a glass · earn 5 tickets"}
        </button>
      </section>

      <section className="section-block">
        <div className="section-title">
          <div>
            <span className="eyebrow">Today's receipt</span>
            <h3>What you logged</h3>
          </div>
          <span className="muted">{Math.round(carbs)}g C · {Math.round(fats)}g F</span>
        </div>
        {meals.length === 0 ? (
          <div className="empty-state">Your first meal becomes the first line in the story.</div>
        ) : (
          <div className="meal-list">
            {[...meals].reverse().map((meal) => (
              <div className="meal-row" key={meal.id}>
                <span className="meal-icon">🍽</span>
                <div>
                  <strong>{meal.name}</strong>
                  <span className="muted">P {meal.protein} · C {meal.carbs} · F {meal.fats}</span>
                </div>
                <b>{meal.calories} kcal</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="coach">
        <span className="eyebrow">Gemini coach</span>
        <p>"{coachTip}"</p>
      </section>
=======
        <div><span className="eyebrow">Nimiq Pay wellness</span><h1>NimiFit</h1></div>
        <div className="top-actions"><span className="ticket-chip">🎟 {account.tickets || 0}</span><button className="avatar" onClick={user ? undefined : openAuth}>{user ? (user.displayName || user.email || "U").slice(0, 1).toUpperCase() : "↗"}</button></div>
      </header>

      <section className="hero-panel">
        <div><span className="eyebrow">Today, {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span><h2>Small wins, <em>stacked.</em></h2><p>Scan what you eat, drink water, touch grass, and let your progress earn its place.</p></div>
        <div className="hero-stamp">{account.tickets >= FREE_MONTH_TICKETS ? "FREE MONTH" : `${FREE_MONTH_TICKETS - (account.tickets || 0)} TO PRO`}</div>
      </section>

      {!user && <button className="notice" onClick={openAuth}>Sign in to save your progress <span>→</span></button>}

      <section className="metrics-grid">
        <div className="metric-card metric-main"><div><span className="eyebrow">Calories left</span><strong>{Math.max(0, target.calories - calories)}</strong><span className="muted">of {target.calories} kcal</span></div><Ring value={(calories / target.calories) * 100} label={`${Math.round((calories / target.calories) * 100)}%`} /></div>
        <div className="metric-card"><span className="eyebrow">Protein</span><strong>{Math.round(protein)}g</strong><ProgressBar value={(protein / target.protein) * 100} color="var(--rust)" /><span className="muted">target {target.protein}g</span></div>
        <div className="metric-card"><span className="eyebrow">Hydration</span><strong>{glasses}<small>/{target.water}</small></strong><ProgressBar value={(glasses / target.water) * 100} color="var(--blue)" /><span className="muted">250 ml glasses</span></div>
      </section>

      <section className="section-block"><div className="section-title"><div><span className="eyebrow">The daily loop</span><h3>Log, earn, repeat</h3></div><span className="section-count">+{MEAL_TICKETS} meal · +{WATER_TICKETS} water</span></div>
        <div className="scan-card">
          <div className="scan-art">{scanState === "scanning" ? <div className="scan-line" /> : selectedImage ? <img src={selectedImage} alt="Selected meal" /> : <span>🥗</span>}</div>
          <div className="scan-copy"><span className="eyebrow">Gemini meal scan</span><h3>{scanState === "scanning" ? "Reading your plate…" : scanState === "done" ? "Meal logged" : "Make food logging painless"}</h3><p>{scanState === "done" ? "Your nutrition and ticket balance are updated." : "One photo, estimated calories and macros, no spreadsheet energy."}</p>{scanError && <p className="error">{scanError}</p>}<button className="primary-button" onClick={() => fileRef.current?.click()} disabled={scanState === "scanning"}>{scanState === "scanning" ? "Analyzing…" : "Scan a meal"}</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => scan(e.target.files?.[0])} /></div>
        </div>
      </section>

      <section className="section-block water-section"><div className="section-title"><div><span className="eyebrow">Hydration</span><h3>Keep the glass moving</h3></div><span className="water-number">{glasses}/{target.water}</span></div><div className="glasses">{Array.from({ length: Math.max(target.water, glasses) }).map((_, i) => <span key={i} className={i < glasses ? "glass filled" : "glass"}>⌄</span>)}</div><button className="water-button" onClick={addWater} disabled={waterBusy || waterLocked || glasses >= target.water}>{waterBusy ? "Saving…" : waterLocked ? `Next glass in ${minutesLeft} min` : glasses >= target.water ? "Daily target reached" : "+ Add a glass · earn 5 tickets"}</button></section>

      <section className="section-block"><div className="section-title"><div><span className="eyebrow">Today’s receipt</span><h3>What you logged</h3></div><span className="muted">{Math.round(carbs)}g C · {Math.round(fats)}g F</span></div>{meals.length === 0 ? <div className="empty-state">Your first meal becomes the first line in the story.</div> : <div className="meal-list">{[...meals].reverse().map((meal) => <div className="meal-row" key={meal.id}><span className="meal-icon">�</span><div><strong>{meal.name}</strong><span className="muted">P {meal.protein} · C {meal.carbs} · F {meal.fats}</span></div><b>{meal.calories} kcal</b></div>)}</div>}</section>

      <section className="coach"><span className="eyebrow">Gemini coach</span><p>“{coachTip}”</p></section>
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
    </main>
  );
}

function Competitions({ user, account, setAccount, profile, day, openAuth }) {
  const [leaderboards, setLeaderboards] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const wk = weekKey();
  const mk = monthKey();
<<<<<<< HEAD

=======
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
  const cards = [
    { id: "tickets_weekly", title: "Ticket Sprint", note: "Earn the most tickets this week", collection: "competitions_weekly_tickets_stake", period: wk, metric: account.weeklyTicketsEarned || 0, color: "orange", icon: "🎟" },
    { id: "water_weekly", title: "Hydration Relay", note: "Most glasses logged this week", collection: "competitions_weekly_water", period: wk, metric: account.weeklyWaterGlassesEarned || 0, color: "blue", icon: "💧" },
    { id: "weight_weekly", title: "Goal Sprint", note: "Progress toward your own target", collection: "competitions_weekly_weight", period: wk, metric: account.weeklyWeightProgress || 0, color: "green", icon: "⚖" },
<<<<<<< HEAD
    { id: "tickets_monthly", title: "Month Maker", note: "Build the strongest monthly streak", collection: "competitions_monthly_tickets_stake", period: mk, metric: account.monthlyTicketsEarned || 0, color: "gold", icon: "🏆" },
=======
    { id: "tickets_monthly", title: "Month Maker", note: "Build the strongest monthly streak", collection: "competitions_monthly_tickets_stake", period: mk, metric: account.monthlyTicketsEarned || 0, color: "gold", icon: "�" },
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
  ];

  useEffect(() => {
    let cancelled = false;
    Promise.all(cards.map(async (card) => {
      const snap = await getDocs(query(collection(db, card.collection, card.period, "entries"), orderBy("metric", "desc"), limit(10)));
      return [card.id, snap.docs.map((entry) => entry.data())];
    })).then((rows) => { if (!cancelled) setLeaderboards(Object.fromEntries(rows)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [wk, mk]);

  async function join(card) {
    if (!user) return openAuth();
<<<<<<< HEAD
    setBusy(card.id);
    setError("");
=======
    setBusy(card.id); setError("");
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
    try {
      const result = await callJoinCompetition({ type: card.id, stake: 10, metric: card.metric });
      setAccount((current) => ({ ...current, tickets: result.data.tickets }));
      setLeaderboards((current) => ({ ...current, [card.id]: [...(current[card.id] || []), result.data.entry] }));
<<<<<<< HEAD
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="page-wrap">
      <header className="topbar">
        <div>
          <span className="eyebrow">Skill over noise</span>
          <h1>Compete</h1>
        </div>
        <span className="ticket-chip">🎟 {account.tickets || 0}</span>
      </header>
      <section className="hero-panel compete-hero">
        <div>
          <span className="eyebrow">No luck. Just consistency.</span>
          <h2>Make your habits <em>visible.</em></h2>
          <p>Enter with 10 tickets. Rankings reward the work you actually log.</p>
        </div>
        <div className="hero-stamp">10 TICKET ENTRY</div>
      </section>
      {error && <p className="error notice">{error}</p>}
      <div className="competition-list">
        {cards.map((card) => (
          <article className={`competition-card ${card.color}`} key={card.id}>
            <div className="competition-top">
              <span className="competition-icon">{card.icon}</span>
              <div>
                <span className="eyebrow">{card.period === wk ? "This week" : "This month"}</span>
                <h3>{card.title}</h3>
                <p>{card.note}</p>
              </div>
            </div>
            <div className="competition-score">
              <strong>{card.metric}</strong>
              <span>your score</span>
              <button className="small-button" onClick={() => join(card)} disabled={busy === card.id}>
                {busy === card.id ? "Joining…" : "Enter · 10 🎟"}
              </button>
            </div>
            <div className="leaderboard">
              {(leaderboards[card.id] || []).slice(0, 5).map((entry, index) => (
                <div className="leader-row" key={entry.uid || index}>
                  <span>{index + 1}. {entry.displayName || "Anonymous"}</span>
                  <b>{entry.metric}</b>
                </div>
              ))}
              {!leaderboards[card.id]?.length && <span className="muted">Be first on the board.</span>}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
=======
    } catch (err) { setError(errorText(err)); } finally { setBusy(""); }
  }

  return <main className="page-wrap"><header className="topbar"><div><span className="eyebrow">Skill over noise</span><h1>Compete</h1></div><span className="ticket-chip">🎟 {account.tickets || 0}</span></header><section className="hero-panel compete-hero"><div><span className="eyebrow">No luck. Just consistency.</span><h2>Make your habits <em>visible.</em></h2><p>Enter with 10 tickets. Rankings reward the work you actually log.</p></div><div className="hero-stamp">10 TICKET ENTRY</div></section>{error && <p className="error notice">{error}</p>}<div className="competition-list">{cards.map((card) => <article className={`competition-card ${card.color}`} key={card.id}><div className="competition-top"><span className="competition-icon">{card.icon}</span><div><span className="eyebrow">{card.period === wk ? "This week" : "This month"}</span><h3>{card.title}</h3><p>{card.note}</p></div></div><div className="competition-score"><strong>{card.metric}</strong><span>your score</span><button className="small-button" onClick={() => join(card)} disabled={busy === card.id}>{busy === card.id ? "Joining…" : "Enter · 10 🎟"}</button></div><div className="leaderboard">{(leaderboards[card.id] || []).slice(0, 5).map((entry, index) => <div className="leader-row" key={entry.uid || index}><span>{index + 1}. {entry.displayName || "Anonymous"}</span><b>{entry.metric}</b></div>)}{!leaderboards[card.id]?.length && <span className="muted">Be first on the board.</span>}</div></article>)}</div></main>;
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
}

function Profile({ user, profile, setProfile, account, setAccount, wallet, setWallet, openAuth }) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [nimiq, setNimiq] = useState(null);

<<<<<<< HEAD
  useEffect(() => {
    initNimiq().then(setNimiq).catch(() => setNimiq(null));
  }, []);
=======
  useEffect(() => { initNimiq().then(setNimiq).catch(() => setNimiq(null)); }, []);
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068

  async function save(event) {
    event.preventDefault();
    if (!user) return openAuth();
<<<<<<< HEAD
    setBusy(true);
    setMessage("");
    try {
      await setDoc(doc(db, "users", user.uid), { profile: draft }, { merge: true });
      setProfile(draft);
      setMessage("Profile saved.");
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
=======
    setBusy(true); setMessage("");
    try { await setDoc(doc(db, "users", user.uid), { profile: draft }, { merge: true }); setProfile(draft); setMessage("Profile saved."); } catch (err) { setMessage(errorText(err)); } finally { setBusy(false); }
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
  }

  async function connectWallet() {
    if (!nimiq) return setMessage("Open NimiFit inside Nimiq Pay to connect the wallet.");
<<<<<<< HEAD
    try {
      const accounts = await nimiq.listAccounts();
      const address = accounts?.[0];
      if (!address) throw new Error("No wallet account returned.");
      await setDoc(doc(db, "users", user.uid), { nimiqAddress: address }, { merge: true });
      setWallet(address);
    } catch (err) {
      setMessage(errorText(err));
    }
=======
    try { const accounts = await nimiq.listAccounts(); const address = accounts?.[0]; if (!address) throw new Error("No wallet account returned."); await setDoc(doc(db, "users", user.uid), { nimiqAddress: address }, { merge: true }); setWallet(address); } catch (err) { setMessage(errorText(err)); }
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
  }

  async function pay() {
    if (!user) return openAuth();
    if (!nimiq) return setMessage("Open NimiFit inside Nimiq Pay to pay.");
<<<<<<< HEAD
    try {
      const txHash = await nimiq.sendBasicTransaction({ recipient: RECEIVING_ADDRESS, value: PRO_PRICE_NIM * LUNAS_PER_NIM });
      const result = await callConfirmNimiqPayment({ txHash });
      setAccount((current) => ({ ...current, tickets: result.data.tickets, nimGiftBalance: result.data.nimGiftBalance, proUntil: result.data.proUntil }));
      setMessage("Payment verified. Pro is active.");
    } catch (err) {
      setMessage(errorText(err));
    }
  }

  async function redeem() {
    try {
      const result = await callRedeemTickets();
      setAccount((current) => ({ ...current, tickets: result.data.tickets, proUntil: result.data.proUntil }));
      setMessage("Free month unlocked.");
    } catch (err) {
      setMessage(errorText(err));
    }
  }

  const isPro = account.proUntil > Date.now();
  return (
    <main className="page-wrap">
      <header className="topbar">
        <div>
          <span className="eyebrow">Your settings</span>
          <h1>Profile</h1>
        </div>
        <button className="avatar" onClick={() => user && signOut(auth)}>↪</button>
      </header>
      <section className="profile-card">
        <span className="profile-mark">
          {user ? (user.displayName || user.email || "U").slice(0, 1).toUpperCase() : "?"}
        </span>
        <div>
          <h2>{user ? user.displayName || "NimiFit member" : "Guest mode"}</h2>
          <p className="muted">{user ? user.email : "Sign in to sync your progress."}</p>
        </div>
      </section>
      {!user ? (
        <button className="primary-button" onClick={openAuth}>Sign in</button>
      ) : (
        <>
          <form className="section-block profile-form" onSubmit={save}>
            <div className="section-title">
              <div>
                <span className="eyebrow">Personal targets</span>
                <h3>Make it yours</h3>
              </div>
            </div>
            <div className="form-grid">
              {[
                ["weightKg", "Weight kg"],
                ["goalWeightKg", "Goal kg"],
                ["heightCm", "Height cm"],
                ["age", "Age"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input className="input" type="number" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} />
                </label>
              ))}
            </div>
            <label>
              Activity
              <select className="input" value={draft.activity} onChange={(e) => setDraft({ ...draft, activity: e.target.value })}>
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="active">Active</option>
              </select>
            </label>
            <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
            {message && <p className={message.includes("error") || message.includes("Error") ? "error" : "success"}>{message}</p>}
          </form>
          <section className="section-block wallet-card">
            <span className="eyebrow">Nimiq Pay</span>
            <h3>{wallet ? `${wallet.slice(0, 8)}…` : "Wallet not connected"}</h3>
            <p className="muted">NIM is part of the product, not a logo in the corner.</p>
            <div className="button-row">
              <button className="secondary-button" onClick={connectWallet}>Connect wallet</button>
              {!isPro && <button className="pay-button" onClick={pay}>Unlock Pro · {PRO_PRICE_NIM} NIM</button>}
            </div>
            {account.tickets >= FREE_MONTH_TICKETS && !isPro && (
              <button className="text-button" onClick={redeem}>Redeem {FREE_MONTH_TICKETS} tickets for a free month</button>
            )}
            {isPro && <p className="success">Pro active until {new Date(account.proUntil).toLocaleDateString()}.</p>}
          </section>
        </>
      )}
    </main>
  );
=======
    try { const txHash = await nimiq.sendBasicTransaction({ recipient: RECEIVING_ADDRESS, value: PRO_PRICE_NIM * LUNAS_PER_NIM }); const result = await callConfirmNimiqPayment({ txHash }); setAccount((current) => ({ ...current, tickets: result.data.tickets, nimGiftBalance: result.data.nimGiftBalance, proUntil: result.data.proUntil })); setMessage("Payment verified. Pro is active."); } catch (err) { setMessage(errorText(err)); }
  }

  async function redeem() {
    try { const result = await callRedeemTickets(); setAccount((current) => ({ ...current, tickets: result.data.tickets, proUntil: result.data.proUntil })); setMessage("Free month unlocked."); } catch (err) { setMessage(errorText(err)); }
  }

  const isPro = account.proUntil > Date.now();
  return <main className="page-wrap"><header className="topbar"><div><span className="eyebrow">Your settings</span><h1>Profile</h1></div><button className="avatar" onClick={() => user && signOut(auth)}>↪</button></header><section className="profile-card"><span className="profile-mark">{user ? (user.displayName || user.email || "U").slice(0, 1).toUpperCase() : "?"}</span><div><h2>{user ? user.displayName || "NimiFit member" : "Guest mode"}</h2><p className="muted">{user ? user.email : "Sign in to sync your progress."}</p></div></section>{!user ? <button className="primary-button" onClick={openAuth}>Sign in</button> : <><form className="section-block profile-form" onSubmit={save}><div className="section-title"><div><span className="eyebrow">Personal targets</span><h3>Make it yours</h3></div></div><div className="form-grid">{[["weightKg", "Weight kg"], ["goalWeightKg", "Goal kg"], ["heightCm", "Height cm"], ["age", "Age"]].map(([key, label]) => <label key={key}>{label}<input className="input" type="number" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} /></label>)}</div><label>Activity<select className="input" value={draft.activity} onChange={(e) => setDraft({ ...draft, activity: e.target.value })}><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option></select></label><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>{message && <p className={message.includes("error") || message.includes("Error") ? "error" : "success"}>{message}</p>}</form><section className="section-block wallet-card"><span className="eyebrow">Nimiq Pay</span><h3>{wallet ? `${wallet.slice(0, 8)}…` : "Wallet not connected"}</h3><p className="muted">NIM is part of the product, not a logo in the corner.</p><div className="button-row"><button className="secondary-button" onClick={connectWallet}>Connect wallet</button>{!isPro && <button className="pay-button" onClick={pay}>Unlock Pro · {PRO_PRICE_NIM} NIM</button>}</div>{account.tickets >= FREE_MONTH_TICKETS && !isPro && <button className="text-button" onClick={redeem}>Redeem {FREE_MONTH_TICKETS} tickets for a free month</button>}{isPro && <p className="success">Pro active until {new Date(account.proUntil).toLocaleDateString()}.</p>}</section></>}</main>;
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [account, setAccount] = useState({ tickets: 0, nimGiftBalance: 0, proUntil: 0 });
  const [day, setDay] = useState({ meals: [], glasses: 0, nextWaterAt: 0 });
  const [wallet, setWallet] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
<<<<<<< HEAD
    if (!currentUser) {
      setProfile(DEFAULT_PROFILE);
      setAccount({ tickets: 0, nimGiftBalance: 0, proUntil: 0 });
      setDay({ meals: [], glasses: 0, nextWaterAt: 0 });
      return;
    }
=======
    if (!currentUser) { setProfile(DEFAULT_PROFILE); setAccount({ tickets: 0, nimGiftBalance: 0, proUntil: 0 }); setDay({ meals: [], glasses: 0, nextWaterAt: 0 }); return; }
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    const data = userSnap.exists() ? userSnap.data() : {};
    const daySnap = await getDoc(doc(db, "users", currentUser.uid, "days", todayKey()));
    setProfile({ ...DEFAULT_PROFILE, ...(data.profile || {}) });
<<<<<<< HEAD
    setAccount({
      tickets: data.tickets || 0,
      nimGiftBalance: data.nimGiftBalance || 0,
      proUntil: data.proUntil || 0,
      weeklyTicketsEarned: data.weeklyTicketsEarned || 0,
      monthlyTicketsEarned: data.monthlyTicketsEarned || 0,
      weeklyWaterGlassesEarned: data.weeklyWaterGlassesEarned || 0,
      monthlyWaterGlassesEarned: data.monthlyWaterGlassesEarned || 0,
      weeklyWeightProgress: data.weeklyWeightProgress || 0,
      nimiqAddress: data.nimiqAddress || "",
    });
=======
    setAccount({ tickets: data.tickets || 0, nimGiftBalance: data.nimGiftBalance || 0, proUntil: data.proUntil || 0, weeklyTicketsEarned: data.weeklyTicketsEarned || 0, monthlyTicketsEarned: data.monthlyTicketsEarned || 0, weeklyWaterGlassesEarned: data.weeklyWaterGlassesEarned || 0, monthlyWaterGlassesEarned: data.monthlyWaterGlassesEarned || 0, weeklyWeightProgress: data.weeklyWeightProgress || 0, nimiqAddress: data.nimiqAddress || "" });
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
    setWallet(data.nimiqAddress || "");
    setDay(daySnap.exists() ? daySnap.data() : { meals: [], glasses: 0, nextWaterAt: 0 });
  }), []);

<<<<<<< HEAD
  return (
    <div className="app-shell">
      <div className="app-content">
        {page === "home" && (
          <Home
            user={user}
            profile={profile}
            setProfile={setProfile}
            account={account}
            setAccount={setAccount}
            day={day}
            setDay={setDay}
            wallet={wallet}
            setWallet={setWallet}
            openAuth={() => setAuthOpen(true)}
          />
        )}
        {page === "grass" && <TouchGrass user={user} openAuth={() => setAuthOpen(true)} setAccount={setAccount} />}
        {page === "compete" && (
          <Competitions
            user={user}
            account={account}
            setAccount={setAccount}
            profile={profile}
            day={day}
            openAuth={() => setAuthOpen(true)}
          />
        )}
        {page === "profile" && (
          <Profile
            user={user}
            profile={profile}
            setProfile={setProfile}
            account={account}
            setAccount={setAccount}
            wallet={wallet}
            setWallet={setWallet}
            openAuth={() => setAuthOpen(true)}
          />
        )}
      </div>
      <nav className="bottom-nav">
        {[
          ["home", "⌂", "Home"],
          ["grass", "✦", "Grass"],
          ["compete", "♛", "Compete"],
          ["profile", "◉", "Profile"],
        ].map(([key, icon, label]) => (
          <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
=======
  return <div className="app-shell"><div className="app-content">{page === "home" && <Home user={user} profile={profile} setProfile={setProfile} account={account} setAccount={setAccount} day={day} setDay={setDay} wallet={wallet} setWallet={setWallet} openAuth={() => setAuthOpen(true)} />}{page === "grass" && <TouchGrass user={user} openAuth={() => setAuthOpen(true)} setAccount={setAccount} />}{page === "compete" && <Competitions user={user} account={account} setAccount={setAccount} profile={profile} day={day} openAuth={() => setAuthOpen(true)} />}{page === "profile" && <Profile user={user} profile={profile} setProfile={setProfile} account={account} setAccount={setAccount} wallet={wallet} setWallet={setWallet} openAuth={() => setAuthOpen(true)} />}</div><nav className="bottom-nav">{[["home", "⌂", "Home"], ["grass", "✦", "Grass"], ["compete", "♛", "Compete"], ["profile", "◉", "Profile"]].map(([key, icon, label]) => <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}><span>{icon}</span>{label}</button>)}</nav>{authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}</div>;
}
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068

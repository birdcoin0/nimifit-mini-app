import React, { useState, useRef, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./lib/firebase";
import RingProgress from "./components/RingProgress";
import { init } from "@nimiq/mini-app-sdk";
import {
  IconSettings, IconWallet, IconFlame, IconDrumstick, IconWheat, IconDroplet,
  IconLock, IconCheck, IconLogout, IconGoogle, IconPlus, IconMinus,
} from "./components/icons";

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
  const [todayMeals, setTodayMeals] = useState([]);
  const [aiCoachTip, setAiCoachTip] = useState("Scan your first meal to let Gemini analyze your daily nutrition targets!");
  const [isAnalyzingCoach, setIsAnalyzingCoach] = useState(false);

  const nimiqRef = useRef(null);
  const [nimiqReady, setNimiqReady] = useState(false);
  const [networkDebugInfo, setNetworkDebugInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    init()
      .then(async (nimiq) => {
        if (cancelled) return;
        nimiqRef.current = nimiq;
        setNimiqReady(true);

        // TEMPORARY DEBUG: reveal what the SDK exposes so we can confirm
        // testnet vs mainnet. Remove this block once confirmed.
        try {
          const info = {
            keys: Object.keys(nimiq),
          };
          if (typeof nimiq.getBlockNumber === "function") {
            info.blockNumber = await nimiq.getBlockNumber();
          }
          if (typeof nimiq.isConsensusEstablished === "function") {
            info.consensus = await nimiq.isConsensusEstablished();
          }
          setNetworkDebugInfo(info);
          console.log("NIMIQ DEBUG INFO:", info);
        } catch (e) {
          console.log("NIMIQ DEBUG ERROR:", e);
        }
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
            // nimiqAddress is intentionally NOT restored from Firestore here —
            // the wallet address is only ever set from a live listAccounts() call.
          } else {
            await setDoc(userRef, { profile: defaultProfile, proUntil: 0 });
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfile(tempProfile);
    setIsEditingProfile(false);
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { profile: tempProfile }, { merge: true });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const NIMIQ_APP_RECEIVING_ADDRESS = "NQ78 SF1K A42M CPT7 0LDP YT52 A747 8DB6 PX7P";
  const PRO_PRICE_NIM = 50;
  const LUNAS_PER_NIM = 1e5;

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
      const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      setIsPro(true);
      if (user) {
        await setDoc(doc(db, "users", user.uid), { proUntil: expiry, lastPaymentTxHash: txHash }, { merge: true });
      }
    } catch (err) {
      console.error(err);
      if (err?.name === "PermissionDeniedError") {
        return;
      }
      alert("Payment could not be completed: " + (err?.message || "unknown error"));
    }
  };

  const setWaterTo = (n) => setGlassesDrunk(Math.max(0, n));

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
  };

  const macroRingData = [
    { label: "PROTEIN", value: macroTotals.protein, goal: proteinGoal, color: rust, Icon: IconDrumstick },
    { label: "CARBS", value: macroTotals.carbs, goal: carbsGoal, color: gold, Icon: IconWheat },
    { label: "FATS", value: macroTotals.fats, goal: fatsGoal, color: blue, Icon: IconDroplet },
  ];

  return (
    <div style={styles.page}>
      <style>{FONTS}</style>

      {networkDebugInfo && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "#1B2430", color: "#F2F1EC", fontFamily: "monospace",
          fontSize: "10px", padding: "6px 10px", wordBreak: "break-all",
        }}>
          NIMIQ DEBUG: {JSON.stringify(networkDebugInfo)}
        </div>
      )}

      <div style={{ ...styles.container, marginTop: networkDebugInfo ? "40px" : "0" }}>

        <div style={styles.header}>
          <span style={styles.brandMark}>NimiFit</span>
          <div style={styles.headerActions}>
            <button style={styles.iconButton} onClick={() => setIsEditingProfile(true)} title="Profile & goals" aria-label="Profile & goals">
              <IconSettings size={15} />
            </button>
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
                  Sign in with Google to save your data across devices.
                </p>
                <button style={styles.ctaButton} onClick={handleGoogleLogin}>
                  <IconGoogle size={13} /> Sign in with Google
                </button>
              </div>
            ) : isPro ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: moss, fontWeight: 600 }}>
                <IconCheck size={14} color={moss} /> Pro active — weekly analytics unlocked
              </div>
            ) : (
              <div>
                <p style={{ ...styles.heroSubtitle, marginBottom: "12px", fontSize: "12px" }}>
                  Upgrade to Pro via Nimiq Pay (50 NIM / month) for weekly analytics &amp; cloud sync.
                </p>
                <button style={styles.nimiqPayButton} onClick={handleNimiqCheckout}>
                  <IconWallet size={14} /> Pay 50 NIM with Nimiq Pay
                </button>
                {!nimiqReady && (
                  <p style={{ fontSize: "11px", color: "#9A9484", marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace" }}>
                    Nimiq wallet not detected — open this app from inside Nimiq Pay to pay.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {isEditingProfile && (
          <div style={{ ...styles.ticket, padding: "20px" }}>
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
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button type="submit" style={{ ...styles.ctaButton, marginTop: 0, padding: "10px" }}>Save profile</button>
                <button type="button" style={{ ...styles.ghostButton, marginTop: 0, padding: "10px" }} onClick={() => setIsEditingProfile(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

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
                <div
                  key={i}
                  style={styles.waterGlass(i < glassesDrunk)}
                  onClick={() => setWaterTo(i < glassesDrunk ? i : i + 1)}
                  role="button" tabIndex={0}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button style={styles.waterStepButton} onClick={() => setWaterTo(glassesDrunk - 1)} aria-label="Remove glass"><IconMinus /></button>
              <button style={styles.waterStepButton} onClick={() => setWaterTo(glassesDrunk + 1)} aria-label="Add glass"><IconPlus /></button>
            </div>
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

      </div>
    </div>
  );
} 
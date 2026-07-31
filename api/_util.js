const admin = require("firebase-admin");

const serviceKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceKey) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY env variable");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceKey)),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const getAuth = () => admin.auth();

const MEAL_TICKETS = 20;
const WATER_TICKETS = 5;
const POST_TICKETS = 50;
const FREE_MONTH_TICKETS = 3700;
const WATER_INTERVAL_MS = 60 * 60 * 1000;
const PRO_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function cleanText(value, max = 280) {
  return String(value || "").trim().slice(0, max);
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function weekKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
  return d.toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function userRef(uid) {
  return db.collection("users").doc(uid);
}

function dayRef(uid) {
  return userRef(uid).collection("days").doc(dayKey());
}

function safeMeal(meal) {
  return {
    name: cleanText(meal?.name, 80) || "Meal",
    calories: Math.round(number(meal?.calories)),
    protein: cleanText(meal?.protein, 20) || "0g",
    carbs: cleanText(meal?.carbs, 20) || "0g",
    fats: cleanText(meal?.fats, 20) || "0g",
  };
}

function addNumbers(a, b) {
  return number(a) + number(b);
}

async function requireUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Sign in first."), { code: "unauthenticated" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded?.uid) throw new Error("unauthenticated");
    return decoded.uid;
  } catch {
    throw Object.assign(new Error("Sign in first."), { code: "unauthenticated" });
  }
}

module.exports = {
  db,
  FieldValue,
  getAuth,
  requireUser,
  MEAL_TICKETS,
  WATER_TICKETS,
  POST_TICKETS,
  FREE_MONTH_TICKETS,
  WATER_INTERVAL_MS,
  PRO_MONTH_MS,
  cleanText,
  number,
  dayKey,
  weekKey,
  monthKey,
  userRef,
  dayRef,
  safeMeal,
  addNumbers,
};
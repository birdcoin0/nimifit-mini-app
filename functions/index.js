const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = "us-central1";
const MEAL_TICKETS = 20;
const WATER_TICKETS = 5;
const POST_TICKETS = 50;
const FREE_MONTH_TICKETS = 3700;
const WATER_INTERVAL_MS = 60 * 60 * 1000;
const PRO_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  return request.auth.uid;
}
function cleanText(value, max = 280) { return String(value || "").trim().slice(0, max); }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function dayKey() { return new Date().toISOString().slice(0, 10); }
function weekKey() { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7)); return d.toISOString().slice(0, 10); }
function monthKey() { return new Date().toISOString().slice(0, 7); }
function userRef(uid) { return db.collection("users").doc(uid); }
function dayRef(uid) { return userRef(uid).collection("days").doc(dayKey()); }
function safeMeal(meal) { return { name: cleanText(meal?.name, 80) || "Meal", calories: Math.round(number(meal?.calories)), protein: cleanText(meal?.protein, 20) || "0g", carbs: cleanText(meal?.carbs, 20) || "0g", fats: cleanText(meal?.fats, 20) || "0g" }; }
function addNumbers(a, b) { return number(a) + number(b); }

exports.analyzeMeal = onCall({ region: REGION, timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  requireUser(request);
  const imageData = String(request.data?.imageData || "");
  if (!imageData.startsWith("data:image/") || imageData.length > 900000) throw new HttpsError("invalid-argument", "Invalid or oversized image.");
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpsError("failed-precondition", "Gemini is not configured on the server.");
  const comma = imageData.indexOf(",");
  const mimeType = imageData.slice(5, imageData.indexOf(";"));
  const base64 = imageData.slice(comma + 1);
  const prompt = `Analyze this meal image. Return JSON only: {"isFood":true,"name":"short meal name","calories":number,"protein":"numberg","carbs":"numberg","fats":"numberg","tip":"one short practical sentence"}. If it is not food, return {"isFood":false}. Do not invent restaurant names or brand claims.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }) });
  if (!response.ok) throw new HttpsError("internal", "Gemini analysis failed.");
  const body = await response.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new HttpsError("internal", "Gemini returned no analysis.");
  let parsed;
  try { parsed = JSON.parse(raw.replace(/^```json\s*/, "").replace(/```$/, "").trim()); } catch { throw new HttpsError("internal", "Gemini returned invalid JSON."); }
  if (!parsed.isFood) throw new HttpsError("invalid-argument", "This image does not look like food.");
  return { meal: safeMeal(parsed), tip: cleanText(parsed.tip, 180) };
});

exports.logMealScanned = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const mealId = cleanText(request.data?.mealId, 80);
  if (!mealId) throw new HttpsError("invalid-argument", "Meal id is required.");
  const meal = { ...safeMeal(request.data?.meal), id: mealId, createdAt: Date.now() };
  const rewardRef = userRef(uid).collection("rewards").doc(`meal_${mealId}`);
  const uRef = userRef(uid); const dRef = dayRef(uid);
  const result = await db.runTransaction(async (tx) => {
    const [uSnap, dSnap, rewardSnap] = await Promise.all([tx.get(uRef), tx.get(dRef), tx.get(rewardRef)]);
    const currentUser = uSnap.exists ? uSnap.data() : {};
    const currentDay = dSnap.exists ? dSnap.data() : {};
    if (rewardSnap.exists) return { tickets: currentUser.tickets || 0, day: currentDay, duplicate: true };
    const meals = Array.isArray(currentDay.meals) ? currentDay.meals : [];
    const nextDay = { meals: [...meals, meal], calories: addNumbers(currentDay.calories, meal.calories), ticketsEarned: addNumbers(currentDay.ticketsEarned, MEAL_TICKETS) };
    tx.set(rewardRef, { type: "meal", amount: MEAL_TICKETS, createdAt: FieldValue.serverTimestamp() });
    tx.set(uRef, { tickets: addNumbers(currentUser.tickets, MEAL_TICKETS), weeklyTicketsEarned: addNumbers(currentUser.weeklyTicketsEarned, MEAL_TICKETS), monthlyTicketsEarned: addNumbers(currentUser.monthlyTicketsEarned, MEAL_TICKETS), weeklyPeriod: weekKey(), monthlyPeriod: monthKey() }, { merge: true });
    tx.set(dRef, nextDay, { merge: true });
    return { tickets: addNumbers(currentUser.tickets, MEAL_TICKETS), day: nextDay, duplicate: false };
  });
  return { ...result, tip: "Good log. Make your next choice simple: add protein, plants, or water." };
});

exports.logWaterGlass = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const eventId = cleanText(request.data?.eventId, 100);
  if (!eventId) throw new HttpsError("invalid-argument", "Water event id is required.");
  const rewardRef = userRef(uid).collection("rewards").doc(`water_${eventId}`);
  const uRef = userRef(uid); const dRef = dayRef(uid);
  const result = await db.runTransaction(async (tx) => {
    const [uSnap, dSnap, rewardSnap] = await Promise.all([tx.get(uRef), tx.get(dRef), tx.get(rewardRef)]);
    const currentUser = uSnap.exists ? uSnap.data() : {};
    const currentDay = dSnap.exists ? dSnap.data() : {};
    const now = Date.now();
    const lastWaterAt = number(currentUser.lastWaterAt);
    if (now - lastWaterAt < WATER_INTERVAL_MS) throw new HttpsError("resource-exhausted", `Next glass unlocks in ${Math.ceil((WATER_INTERVAL_MS - (now - lastWaterAt)) / 60000)} minutes.`);
    if (rewardSnap.exists) return { tickets: currentUser.tickets || 0, day: currentDay, nextWaterAt: now + WATER_INTERVAL_MS };
    const nextDay = { glasses: number(currentDay.glasses) + 1, waterMl: number(currentDay.waterMl) + 250, ticketsEarned: addNumbers(currentDay.ticketsEarned, WATER_TICKETS) };
    tx.set(rewardRef, { type: "water", amount: WATER_TICKETS, createdAt: FieldValue.serverTimestamp() });
    tx.set(uRef, { tickets: addNumbers(currentUser.tickets, WATER_TICKETS), lastWaterAt: now, weeklyWaterGlassesEarned: addNumbers(currentUser.weeklyWaterGlassesEarned, 1), monthlyWaterGlassesEarned: addNumbers(currentUser.monthlyWaterGlassesEarned, 1), weeklyPeriod: weekKey(), monthlyPeriod: monthKey() }, { merge: true });
    tx.set(dRef, nextDay, { merge: true });
    return { tickets: addNumbers(currentUser.tickets, WATER_TICKETS), day: nextDay, nextWaterAt: now + WATER_INTERVAL_MS };
  });
  return result;
});

exports.createPost = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const caption = cleanText(request.data?.caption, 280);
  const imageData = String(request.data?.imageData || "");
  if (!caption && !imageData) throw new HttpsError("invalid-argument", "Add a caption or photo.");
  if (imageData && (!imageData.startsWith("data:image/") || imageData.length > 650000)) throw new HttpsError("invalid-argument", "Photo is too large.");
  const userSnap = await userRef(uid).get();
  const profile = userSnap.exists ? userSnap.data() : {};
  const postRef = db.collection("touch_grass_posts").doc();
  const post = { uid, displayName: cleanText(profile.displayName || request.auth.token.name || request.auth.token.email || "Anonymous", 70), caption, imageData: imageData || "", likes: [], comments: [], timestamp: Date.now() };
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(userRef(uid));
    const tickets = fresh.exists ? number(fresh.data().tickets) : 0;
    tx.set(postRef, post);
    tx.set(userRef(uid), { tickets: tickets + POST_TICKETS }, { merge: true });
  });
  return { post: { id: postRef.id, ...post }, tickets: number((await userRef(uid).get()).data()?.tickets) };
});

exports.toggleLike = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request); const postId = cleanText(request.data?.postId, 120);
  const postRef = db.collection("touch_grass_posts").doc(postId); const uRef = userRef(uid);
  return db.runTransaction(async (tx) => {
    const [postSnap, uSnap] = await Promise.all([tx.get(postRef), tx.get(uRef)]);
    if (!postSnap.exists) throw new HttpsError("not-found", "Post not found.");
    const post = postSnap.data(); const likes = Array.isArray(post.likes) ? post.likes : [];
    const liked = likes.includes(uid); const nextLikes = liked ? likes.filter((id) => id !== uid) : [...likes, uid];
    tx.update(postRef, { likes: nextLikes });
    return { liked: !liked, tickets: number(uSnap.data()?.tickets) };
  });
});

exports.addComment = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request); const postId = cleanText(request.data?.postId, 120); const text = cleanText(request.data?.text, 180);
  if (!text) throw new HttpsError("invalid-argument", "Comment cannot be empty.");
  const postRef = db.collection("touch_grass_posts").doc(postId); const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Post not found.");
  const user = request.auth.token.name || request.auth.token.email || "Anonymous";
  await postRef.update({ comments: [...(snap.data().comments || []), { uid, displayName: cleanText(user, 70), text, timestamp: Date.now() }] });
  return { ok: true };
});

const COMPETITIONS = {
  tickets_weekly: ["competitions_weekly_tickets_stake", "tickets", "weekly"],
  water_weekly: ["competitions_weekly_water", "tickets", "weekly"],
  weight_weekly: ["competitions_weekly_weight", "tickets", "weekly"],
  tickets_monthly: ["competitions_monthly_tickets_stake", "tickets", "monthly"],
};

exports.joinCompetition = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request); const type = cleanText(request.data?.type, 60); const config = COMPETITIONS[type];
  if (!config) throw new HttpsError("invalid-argument", "Unknown competition.");
  const [collectionName, currency, periodType] = config; const period = periodType === "weekly" ? weekKey() : monthKey(); const stake = Math.max(10, Math.min(1000, Math.floor(number(request.data?.stake, 10)))); const metric = Math.max(0, Math.min(1000000, number(request.data?.metric)));
  const entryRef = db.collection(collectionName).doc(period).collection("entries").doc(uid); const uRef = userRef(uid);
  return db.runTransaction(async (tx) => {
    const [entrySnap, userSnap] = await Promise.all([tx.get(entryRef), tx.get(uRef)]);
    if (entrySnap.exists) throw new HttpsError("already-exists", "You are already in this competition.");
    const current = userSnap.exists ? userSnap.data() : {}; const tickets = number(current.tickets);
    if (tickets < stake) throw new HttpsError("failed-precondition", "Not enough tickets.");
    const entry = { uid, displayName: cleanText(current.displayName || request.auth.token.name || request.auth.token.email || "Anonymous", 70), stake, metric, joinedAt: Date.now() };
    tx.set(entryRef, entry); tx.update(uRef, { tickets: tickets - stake });
    return { entry, tickets: tickets - stake };
  });
});

async function verifyNimiqTransaction(txHash) {
  const rpcUrl = process.env.NIMIQ_RPC_URL;
  const recipient = process.env.NIMIQ_RECEIVING_ADDRESS;
  const expectedValue = number(process.env.NIMIQ_PRO_PRICE_LUNAS, 10000000);
  const requiredConfirmations = number(process.env.NIMIQ_CONFIRMATIONS, 1);
  if (!rpcUrl || !recipient) throw new HttpsError("failed-precondition", "Nimiq verification is not configured.");
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "getTransactionByHash", params: [txHash] }) });
  if (!response.ok) throw new HttpsError("internal", "Nimiq RPC unavailable.");
  const body = await response.json(); const tx = body.result;
  if (!tx) throw new HttpsError("failed-precondition", "Transaction is not visible on-chain yet.");
  const to = tx.to || tx.recipient; const value = number(tx.value); const confirmations = number(tx.confirmations, requiredConfirmations);
  if (to !== recipient || value !== expectedValue || confirmations < requiredConfirmations || tx.execution_result === false) throw new HttpsError("permission-denied", "Transaction does not match this payment.");
  return tx;
}

exports.confirmNimiqPayment = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  const uid = requireUser(request); const txHash = cleanText(request.data?.txHash, 160);
  if (!txHash) throw new HttpsError("invalid-argument", "Transaction hash is required.");
  const paymentRef = db.collection("payments").doc(txHash); const uRef = userRef(uid);
  const already = await paymentRef.get();
  if (already.exists && already.data().uid !== uid) throw new HttpsError("already-exists", "Payment already used.");
  await verifyNimiqTransaction(txHash);
  const result = await db.runTransaction(async (tx) => {
    const [paymentSnap, userSnap] = await Promise.all([tx.get(paymentRef), tx.get(uRef)]);
    const current = userSnap.exists ? userSnap.data() : {};
    if (paymentSnap.exists && paymentSnap.data().uid === uid) return current;
    const proUntil = Math.max(Date.now(), number(current.proUntil)) + PRO_MONTH_MS;
    const gift = number(current.nimGiftBalance) + 10;
    tx.set(paymentRef, { uid, txHash, createdAt: FieldValue.serverTimestamp(), value: number(process.env.NIMIQ_PRO_PRICE_LUNAS, 10000000) });
    tx.set(uRef, { proUntil, nimGiftBalance: gift }, { merge: true });
    return { ...current, proUntil, nimGiftBalance: gift };
  });
  return { proUntil: result.proUntil, nimGiftBalance: result.nimGiftBalance, tickets: result.tickets || 0 };
});

exports.redeemTicketsForFreeMonth = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request); const ref = userRef(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); const current = snap.exists ? snap.data() : {}; const tickets = number(current.tickets);
    if (tickets < FREE_MONTH_TICKETS) throw new HttpsError("failed-precondition", `You need ${FREE_MONTH_TICKETS} tickets.`);
    const proUntil = Math.max(Date.now(), number(current.proUntil)) + PRO_MONTH_MS; const nextTickets = tickets - FREE_MONTH_TICKETS;
    tx.update(ref, { tickets: nextTickets, proUntil }); return { tickets: nextTickets, proUntil };
  });
});

exports.settlePastCompetitions = onSchedule({ region: REGION, schedule: "every 60 minutes" }, async () => {
  // Leaderboards are skill-based. Add a trusted payout policy here only after testing the scoring and period boundaries.
  console.log("Competition settlement check completed");
});
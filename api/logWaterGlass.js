const { requireUser, cleanText, addNumbers, number, userRef, dayRef, WATER_TICKETS, WATER_INTERVAL_MS, FieldValue, weekKey, monthKey, db } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const eventId = cleanText(req.body?.eventId, 100);
    if (!eventId) return res.status(400).json({ error: "Water event id is required." });

    const rewardRef = userRef(uid).collection("rewards").doc(`water_${eventId}`);
    const uRef = userRef(uid);
    const dRef = dayRef(uid);

    const result = await db.runTransaction(async (tx) => {
      const [uSnap, dSnap, rewardSnap] = await Promise.all([tx.get(uRef), tx.get(dRef), tx.get(rewardRef)]);
      const currentUser = uSnap.exists ? uSnap.data() : {};
      const currentDay = dSnap.exists ? dSnap.data() : {};
      const now = Date.now();
      const lastWaterAt = number(currentUser.lastWaterAt);
      if (now - lastWaterAt < WATER_INTERVAL_MS) {
        const remaining = Math.ceil((WATER_INTERVAL_MS - (now - lastWaterAt)) / 60000);
        throw Object.assign(new Error(`Next glass unlocks in ${remaining} minutes.`), { code: "resource-exhausted" });
      }
      if (rewardSnap.exists) return { tickets: currentUser.tickets || 0, day: currentDay, nextWaterAt: now + WATER_INTERVAL_MS };

      const nextDay = {
        glasses: number(currentDay.glasses) + 1,
        waterMl: number(currentDay.waterMl) + 250,
        ticketsEarned: addNumbers(currentDay.ticketsEarned, WATER_TICKETS),
      };
      tx.set(rewardRef, { type: "water", amount: WATER_TICKETS, createdAt: FieldValue.serverTimestamp() });
      tx.set(uRef, {
        tickets: addNumbers(currentUser.tickets, WATER_TICKETS),
        lastWaterAt: now,
        weeklyWaterGlassesEarned: addNumbers(currentUser.weeklyWaterGlassesEarned, 1),
        monthlyWaterGlassesEarned: addNumbers(currentUser.monthlyWaterGlassesEarned, 1),
        weeklyPeriod: weekKey(),
        monthlyPeriod: monthKey(),
      }, { merge: true });
      tx.set(dRef, nextDay, { merge: true });
      return { tickets: addNumbers(currentUser.tickets, WATER_TICKETS), day: nextDay, nextWaterAt: now + WATER_INTERVAL_MS };
    });

    return res.status(200).json(result);
  } catch (err) {
    const code = err.code || "internal";
    const status = code === "resource-exhausted" ? 429 : 400;
    return res.status(status).json({ error: err.message, code });
  }
};
const { requireUser, cleanText, number, db, weekKey, monthKey, getAuth } = require("./_util");

const COMPETITIONS = {
  tickets_weekly: ["competitions_weekly_tickets_stake", "tickets", "weekly"],
  water_weekly: ["competitions_weekly_water", "tickets", "weekly"],
  weight_weekly: ["competitions_weekly_weight", "tickets", "weekly"],
  tickets_monthly: ["competitions_monthly_tickets_stake", "tickets", "monthly"],
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const type = cleanText(req.body?.type, 60);
    const config = COMPETITIONS[type];
    if (!config) return res.status(400).json({ error: "Unknown competition." });

    const [collectionName, , periodType] = config;
    const period = periodType === "weekly" ? weekKey() : monthKey();
    const stake = Math.max(10, Math.min(1000, Math.floor(number(req.body?.stake, 10))));
    const metric = Math.max(0, Math.min(1000000, number(req.body?.metric)));
    const entryRef = db.collection(collectionName).doc(period).collection("entries").doc(uid);
    const uRef = db.collection("users").doc(uid);
    const userRecord = await getAuth().getUser(uid);

    const result = await db.runTransaction(async (tx) => {
      const [entrySnap, userSnap] = await Promise.all([tx.get(entryRef), tx.get(uRef)]);
      if (entrySnap.exists) throw Object.assign(new Error("You are already in this competition."), { code: "already-exists" });

      const current = userSnap.exists ? userSnap.data() : {};
      const tickets = number(current.tickets);
      if (tickets < stake) throw Object.assign(new Error("Not enough tickets."), { code: "failed-precondition" });

      const entry = {
        uid,
        displayName: cleanText(current.displayName || userRecord.displayName || userRecord.email || "Anonymous", 70),
        stake,
        metric,
        joinedAt: Date.now(),
      };
      tx.set(entryRef, entry);
      tx.update(uRef, { tickets: tickets - stake });
      return { entry, tickets: tickets - stake };
    });

    return res.status(200).json(result);
  } catch (err) {
    const code = err.code || "internal";
    const status = code === "already-exists" ? 409 : code === "failed-precondition" ? 412 : 400;
    return res.status(status).json({ error: err.message, code });
  }
};
const { requireUser, userRef, number, FREE_MONTH_TICKETS, PRO_MONTH_MS, db } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const ref = userRef(uid);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? snap.data() : {};
      const tickets = number(current.tickets);
      if (tickets < FREE_MONTH_TICKETS) {
        throw Object.assign(new Error(`You need ${FREE_MONTH_TICKETS} tickets.`), { code: "failed-precondition" });
      }
      const proUntil = Math.max(Date.now(), number(current.proUntil)) + PRO_MONTH_MS;
      const nextTickets = tickets - FREE_MONTH_TICKETS;
      tx.update(ref, { tickets: nextTickets, proUntil });
      return { tickets: nextTickets, proUntil };
    });
    return res.status(200).json(result);
  } catch (err) {
    const code = err.code || "internal";
    const status = code === "failed-precondition" ? 412 : 400;
    return res.status(status).json({ error: err.message, code });
  }
};
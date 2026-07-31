const { requireUser, cleanText, safeMeal, addNumbers, userRef, dayRef, MEAL_TICKETS, FieldValue, weekKey, monthKey, db } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const mealId = cleanText(req.body?.mealId, 80);
    if (!mealId) return res.status(400).json({ error: "Meal id is required." });

    const meal = { ...safeMeal(req.body?.meal), id: mealId, createdAt: Date.now() };
    const rewardRef = userRef(uid).collection("rewards").doc(`meal_${mealId}`);
    const uRef = userRef(uid);
    const dRef = dayRef(uid);

    const result = await db.runTransaction(async (tx) => {
      const [uSnap, dSnap, rewardSnap] = await Promise.all([tx.get(uRef), tx.get(dRef), tx.get(rewardRef)]);
      const currentUser = uSnap.exists ? uSnap.data() : {};
      const currentDay = dSnap.exists ? dSnap.data() : {};
      if (rewardSnap.exists) return { tickets: currentUser.tickets || 0, day: currentDay, duplicate: true };

      const meals = Array.isArray(currentDay.meals) ? currentDay.meals : [];
      const nextDay = {
        meals: [...meals, meal],
        calories: addNumbers(currentDay.calories, meal.calories),
        ticketsEarned: addNumbers(currentDay.ticketsEarned, MEAL_TICKETS),
      };
      tx.set(rewardRef, { type: "meal", amount: MEAL_TICKETS, createdAt: FieldValue.serverTimestamp() });
      tx.set(uRef, {
        tickets: addNumbers(currentUser.tickets, MEAL_TICKETS),
        weeklyTicketsEarned: addNumbers(currentUser.weeklyTicketsEarned, MEAL_TICKETS),
        monthlyTicketsEarned: addNumbers(currentUser.monthlyTicketsEarned, MEAL_TICKETS),
        weeklyPeriod: weekKey(),
        monthlyPeriod: monthKey(),
      }, { merge: true });
      tx.set(dRef, nextDay, { merge: true });
      return { tickets: addNumbers(currentUser.tickets, MEAL_TICKETS), day: nextDay, duplicate: false };
    });

    return res.status(200).json({ ...result, tip: "Good log. Make your next choice simple: add protein, plants, or water." });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: err.code || "internal" });
  }
};
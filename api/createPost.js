const { requireUser, cleanText, number, POST_TICKETS, db, getAuth } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const caption = cleanText(req.body?.caption, 280);
    const imageData = String(req.body?.imageData || "");
    if (!caption && !imageData) return res.status(400).json({ error: "Add a caption or photo." });
    if (imageData && (!imageData.startsWith("data:image/") || imageData.length > 650000)) {
      return res.status(400).json({ error: "Photo is too large." });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const profile = userSnap.exists ? userSnap.data() : {};
    const userRecord = await getAuth().getUser(uid);
    const displayName = cleanText(profile.displayName || userRecord.displayName || userRecord.email || "Anonymous", 70);

    const postRef = db.collection("touch_grass_posts").doc();
    const post = { uid, displayName, caption, imageData: imageData || "", likes: [], comments: [], timestamp: Date.now() };

    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(db.collection("users").doc(uid));
      const tickets = fresh.exists ? number(fresh.data().tickets) : 0;
      tx.set(postRef, post);
      tx.set(db.collection("users").doc(uid), { tickets: tickets + POST_TICKETS }, { merge: true });
    });

    const after = await db.collection("users").doc(uid).get();
    return res.status(200).json({ post: { id: postRef.id, ...post }, tickets: number(after.data()?.tickets) });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: err.code || "internal" });
  }
};
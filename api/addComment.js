const { requireUser, cleanText, db, getAuth } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const postId = cleanText(req.body?.postId, 120);
    const text = cleanText(req.body?.text, 180);
    if (!text) return res.status(400).json({ error: "Comment cannot be empty." });

    const postRef = db.collection("touch_grass_posts").doc(postId);
    const snap = await postRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Post not found." });

    const userRecord = await getAuth().getUser(uid);
    const displayName = cleanText(userRecord.displayName || userRecord.email || "Anonymous", 70);
    await postRef.update({
      comments: [...(snap.data().comments || []), { uid, displayName, text, timestamp: Date.now() }],
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
const { requireUser, cleanText, number, db } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const postId = cleanText(req.body?.postId, 120);
    const postRef = db.collection("touch_grass_posts").doc(postId);
    const uRef = db.collection("users").doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const [postSnap, uSnap] = await Promise.all([tx.get(postRef), tx.get(uRef)]);
      if (!postSnap.exists) throw new Error("Post not found.");
      const post = postSnap.data();
      const likes = Array.isArray(post.likes) ? post.likes : [];
      const liked = likes.includes(uid);
      const nextLikes = liked ? likes.filter((id) => id !== uid) : [...likes, uid];
      tx.update(postRef, { likes: nextLikes });
      return { liked: !liked, tickets: number(uSnap.data()?.tickets) };
    });

    return res.status(200).json(result);
  } catch (err) {
    const status = err.message === "Post not found." ? 404 : 400;
    return res.status(status).json({ error: err.message });
  }
};
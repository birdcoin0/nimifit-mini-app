import React, { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./lib/firebase";

const callCreatePost = httpsCallable(functions, "createPost");
const callToggleLike = httpsCallable(functions, "toggleLike");
const callAddComment = httpsCallable(functions, "addComment");

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = reject; reader.onload = () => { const image = new Image(); image.onerror = reject; image.onload = () => { const scale = Math.min(1, 900 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.68)); }; image.src = reader.result; }; reader.readAsDataURL(file);
  });
}

export default function TouchGrass({ user, openAuth, setAccount }) {
  const [posts, setPosts] = useState([]);
  const [caption, setCaption] = useState("");
  const [imageData, setImageData] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  async function refresh() {
    const snap = await getDocs(query(collection(db, "touch_grass_posts"), orderBy("timestamp", "desc"), limit(50)));
    setPosts(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
  }
  useEffect(() => { refresh().catch(() => {}); }, []);

  async function publish(event) {
    event.preventDefault();
    if (!user) return openAuth();
    if (!caption.trim() && !imageData) return setError("Add a caption or a photo.");
    setBusy(true); setError("");
    try { const result = await callCreatePost({ caption: caption.trim(), imageData }); setAccount((current) => ({ ...current, tickets: result.data.tickets })); setCaption(""); setImageData(""); await refresh(); } catch (err) { setError(err.message || "Could not publish."); } finally { setBusy(false); }
  }

  async function like(post) {
    if (!user) return openAuth();
    try { const result = await callToggleLike({ postId: post.id }); setAccount((current) => ({ ...current, tickets: result.data.tickets })); await refresh(); } catch (err) { setError(err.message || "Could not like this moment."); }
  }

  async function comment(post) {
    if (!user) return openAuth();
    const text = window.prompt("Write a short comment");
    if (!text?.trim()) return;
    try { await callAddComment({ postId: post.id, text: text.trim() }); await refresh(); } catch (err) { setError(err.message || "Could not comment."); }
  }

  return <main className="page-wrap"><header className="topbar"><div><span className="eyebrow">Outside counts too</span><h1>Touch Grass</h1></div><span className="leaf-mark">âœ¦</span></header><section className="hero-panel grass-hero"><div><span className="eyebrow">Real moments, not perfect ones</span><h2>Proof you <em>showed up.</em></h2><p>Share a walk, a workout, a meal outside, or anything that got you away from the screen.</p></div></section><form className="post-composer" onSubmit={publish}><span className="eyebrow">Share a moment</span><textarea className="input textarea" placeholder="Where did you touch grass today?" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={280} />{imageData && <img className="composer-image" src={imageData} alt="Preview" />}<div className="button-row"><button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>Add photo</button><input hidden ref={fileRef} type="file" accept="image/*" onChange={async (e) => { if (e.target.files?.[0]) setImageData(await compressImage(e.target.files[0])); }} /><button className="primary-button" disabled={busy}>{busy ? "Postingâ€¦" : "Post Â· +50 ðŸŽŸ"}</button></div>{error && <p className="error">{error}</p>}</form><div className="feed-head"><span className="eyebrow">Community moments</span><span className="muted">{posts.length} recent</span></div><div className="feed">{posts.length === 0 ? <div className="empty-state">No moments yet. Be the first one outside.</div> : posts.map((post) => <article className="post-card" key={post.id}>{post.imageData && <img src={post.imageData} alt="Community moment" />}<div className="post-body"><div className="post-meta"><strong>{post.displayName || "Anonymous"}</strong><span>{post.location || "Somewhere outside"}</span></div>{post.caption && <p>{post.caption}</p>}<div className="post-actions"><button onClick={() => like(post)}>â™¡ {post.likes?.length || 0}</button><button onClick={() => comment(post)}>Comment {post.comments?.length || 0}</button><span>+50 for posting</span></div></div></article>)}</div></main>;
}
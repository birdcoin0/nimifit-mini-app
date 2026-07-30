import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, updateDoc, doc, getDocs, query, orderBy, limit, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "./lib/firebase";
import { IconPlus, IconCheck, IconX, IconHeart } from "./components/icons";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";
const TICKETS_PER_LIKE = 10;

// Content moderation using Gemini
async function moderateContent(caption) {
  if (!API_KEY) return { safe: true, reason: null };
  
  try {
    const prompt = `Analyze this social media post caption for harmful content. Respond ONLY with valid JSON: { "safe": true/false, "reason": "string or null" }. Block if it contains: graphic violence, gore, sexualized content, hate speech. Caption: "${caption}"`;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await res.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) return { safe: true, reason: null };
    
    let cleanText = textResponse.trim().replace(/^```(json)?/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanText);
    return parsed;
  } catch (err) {
    console.error("Moderation error:", err);
    return { safe: true, reason: null };
  }
}

async function moderateImage(base64Data) {
  if (!API_KEY) return { safe: true, reason: null };
  
  try {
    const prompt = `Look at this image. Is it appropriate for a social fitness app? Block if: graphic violence, gore, sexual content, hate symbols. Respond ONLY with JSON: { "safe": true/false, "reason": "string or null" }`;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: prompt }
          ]
        }]
      })
    });
    
    const data = await res.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) return { safe: true, reason: null };
    
    let cleanText = textResponse.trim().replace(/^```(json)?/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanText);
    return parsed;
  } catch (err) {
    console.error("Image moderation error:", err);
    return { safe: true, reason: null };
  }
}

function PostCard({ post, currentUid, onLike, onDeleteComment, styles, ink, rust, line }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommentingLoading, setIsCommentingLoading] = useState(false);

  const hasLiked = post.likes && post.likes.includes(currentUid);
  const likeCount = post.likes ? post.likes.length : 0;

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUid) return;

    setIsCommentingLoading(true);
    try {
      const moderation = await moderateContent(commentText);
      if (!moderation.safe) {
        alert(`Comment blocked: ${moderation.reason || "Contains harmful content"}`);
        setIsCommentingLoading(false);
        return;
      }

      const comments = post.comments || [];
      const newComment = {
        uid: currentUid,
        displayName: auth.currentUser?.displayName || auth.currentUser?.email || "Anonymous",
        text: commentText,
        timestamp: Date.now(),
      };

      await updateDoc(doc(db, "touch_grass_posts", post.id), {
        comments: [...comments, newComment],
      });

      setCommentText("");
      // Refresh posts ideally - emit event or callback
    } catch (err) {
      console.error("Error adding comment:", err);
      alert("Failed to add comment");
    } finally {
      setIsCommentingLoading(false);
    }
  };

  return (
    <div style={{
      background: "#FBFAF7", border: `1px solid ${line}`, borderRadius: "10px",
      boxShadow: "0 1px 2px rgba(27,36,48,0.04)", padding: "16px", marginBottom: "12px"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "14px", fontWeight: 700, color: ink }}>
            {post.displayName || "Anonymous"}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#9A9484", marginTop: "2px" }}>
            {new Date(post.timestamp).toLocaleDateString()} at {new Date(post.timestamp).toLocaleTimeString()}
          </div>
        </div>
        {post.isFeatured && (
          <div style={{ fontSize: "16px" }}>⭐</div>
        )}
      </div>

      {/* Image */}
      {post.image && (
        <div style={{
          width: "100%", height: "200px", borderRadius: "8px", overflow: "hidden",
          marginBottom: "10px", border: `1px solid ${line}`
        }}>
          <img src={post.image} alt={post.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <p style={{ fontSize: "13px", color: ink, margin: "0 0 10px", lineHeight: 1.4 }}>
          {post.caption}
        </p>
      )}

      {/* Location */}
      {post.location && (
        <div style={{ fontSize: "11px", color: "#9A9484", marginBottom: "8px", fontFamily: "'IBM Plex Mono', monospace" }}>
          📍 {post.location}
        </div>
      )}

      {/* Engagement */}
      <div style={{
        display: "flex", gap: "12px", alignItems: "center", paddingTop: "10px",
        borderTop: `1px solid ${line}`, marginBottom: "10px"
      }}>
        <button
          onClick={() => onLike(post.id, currentUid)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: hasLiked ? "rgba(181,80,46,0.12)" : "transparent",
            border: `1px solid ${hasLiked ? rust : line}`, borderRadius: "6px",
            padding: "6px 10px", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
            color: hasLiked ? rust : "#9A9484", fontWeight: hasLiked ? 600 : 500
          }}
        >
          <span>{hasLiked ? "❤️" : "🤍"}</span> {likeCount}
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "transparent", border: `1px solid ${line}`, borderRadius: "6px",
            padding: "6px 10px", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#9A9484"
          }}
        >
          💬 {post.comments ? post.comments.length : 0}
        </button>

        <div style={{ fontSize: "10px", color: "#9A9484", fontFamily: "'IBM Plex Mono', monospace" }}>
          +{post.likes ? post.likes.length * TICKETS_PER_LIKE : 0} tickets
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div style={{ borderTop: `1px solid ${line}`, paddingTop: "10px" }}>
          {/* Existing Comments */}
          {post.comments && post.comments.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              {post.comments.map((comment, idx) => (
                <div key={idx} style={{ marginBottom: "8px", paddingBottom: "8px", borderBottom: `1px solid ${line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 600, color: ink }}>
                        {comment.displayName}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B6656", marginTop: "3px", lineHeight: 1.4 }}>
                        {comment.text}
                      </div>
                    </div>
                    {comment.uid === currentUid && (
                      <button
                        onClick={() => onDeleteComment(post.id, idx)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#9A9484", fontSize: "12px", padding: "0"
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment */}
          {currentUid ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddComment()}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: "6px",
                  border: `1px solid ${line}`, background: "#F5F3EC",
                  fontFamily: "'Inter', sans-serif", fontSize: "12px", boxSizing: "border-box"
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={isCommentingLoading || !commentText.trim()}
                style={{
                  padding: "8px 12px", borderRadius: "6px", border: "none",
                  background: "#1B2430", color: "#F5F3EC", fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px", cursor: "pointer", fontWeight: 600,
                  opacity: isCommentingLoading || !commentText.trim() ? 0.6 : 1
                }}
              >
                {isCommentingLoading ? "…" : "Post"}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: "11px", color: "#9A9484" }}>Sign in to comment</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TouchGrass({ user, styles, ink, rust, line, gold, paper, moss }) {
  const [posts, setPosts] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [postsLoading, setPostsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch posts
  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const q = query(collection(db, "touch_grass_posts"), orderBy("timestamp", "desc"), limit(50));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(data);
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setUploadProgress(50);

      // Moderate image
      const base64Data = base64String.split(",")[1];
      const moderation = await moderateImage(base64Data);
      
      if (!moderation.safe) {
        setErrorMessage(`Image blocked: ${moderation.reason || "Contains inappropriate content"}`);
        setSelectedImage(null);
        setUploadProgress(0);
        return;
      }

      setSelectedImage(base64String);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 500);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Sign in first to post");
      return;
    }

    if (!postCaption.trim() && !selectedImage) {
      setErrorMessage("Add a caption or image");
      return;
    }

    setIsPosting(true);
    setErrorMessage("");

    try {
      // Moderate caption
      if (postCaption.trim()) {
        const moderation = await moderateContent(postCaption);
        if (!moderation.safe) {
          setErrorMessage(`Post blocked: ${moderation.reason || "Contains inappropriate content"}`);
          setIsPosting(false);
          return;
        }
      }

      const newPost = {
        uid: user.uid,
        displayName: user.displayName || user.email || "Anonymous",
        caption: postCaption,
        location: postLocation,
        image: selectedImage,
        timestamp: Date.now(),
        likes: [],
        comments: [],
        isFeatured: false,
      };

      await addDoc(collection(db, "touch_grass_posts"), newPost);

      // Award tickets to poster
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentTickets = userSnap.data().tickets || 0;
          await updateDoc(userRef, { tickets: currentTickets + 50 }); // 50 tickets for posting
        }
      } catch (ticketErr) {
        console.error("Ticket award failed:", ticketErr);
      }

      setPostCaption("");
      setPostLocation("");
      setSelectedImage(null);
      await fetchPosts();
    } catch (err) {
      console.error("Error posting:", err);
      setErrorMessage("Failed to post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId, uid) => {
    if (!uid) {
      alert("Sign in to like posts");
      return;
    }

    try {
      const postRef = doc(db, "touch_grass_posts", postId);
      const postSnap = await getDoc(postRef);
      const currentLikes = postSnap.data().likes || [];
      const hasLiked = currentLikes.includes(uid);

      const newLikes = hasLiked
        ? currentLikes.filter(id => id !== uid)
        : [...currentLikes, uid];

      await updateDoc(postRef, { likes: newLikes });

      // Award/remove tickets
      if (!hasLiked) {
        const userRef = doc(db, "users", postSnap.data().uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentTickets = userSnap.data().tickets || 0;
          await updateDoc(userRef, { tickets: currentTickets + TICKETS_PER_LIKE });
        }
      }

      await fetchPosts();
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleDeleteComment = async (postId, commentIdx) => {
    try {
      const postRef = doc(db, "touch_grass_posts", postId);
      const postSnap = await getDoc(postRef);
      const comments = postSnap.data().comments || [];
      comments.splice(commentIdx, 1);

      await updateDoc(postRef, { comments });
      await fetchPosts();
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  const triggerUpload = () => fileInputRef.current && fileInputRef.current.click();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ padding: "0 4px 6px" }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: 700, color: ink }}>🌿 Touch Grass</span>
      </div>

      {/* Post Creation */}
      {user ? (
        <div style={{
          background: "#FBFAF7", border: `1px solid ${line}`, borderRadius: "10px",
          boxShadow: "0 1px 2px rgba(27,36,48,0.04)", padding: "18px"
        }}>
          <form onSubmit={handleSubmitPost}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#9A9484", textTransform: "uppercase", marginBottom: "10px" }}>
              Share your moment
            </div>

            <textarea
              placeholder="What are you up to? (food, workout, nature, etc.)"
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              style={{
                width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${line}`,
                background: "#F5F3EC", fontFamily: "'Inter', sans-serif", fontSize: "13px",
                resize: "vertical", minHeight: "80px", boxSizing: "border-box", color: ink
              }}
            />

            <input
              type="text"
              placeholder="Location (optional)"
              value={postLocation}
              onChange={(e) => setPostLocation(e.target.value)}
              style={{
                width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${line}`,
                background: "#F5F3EC", fontFamily: "'Inter', sans-serif", fontSize: "12px",
                marginTop: "10px", boxSizing: "border-box", color: ink
              }}
            />

            {/* Image Preview */}
            {selectedImage && (
              <div style={{
                width: "100%", height: "160px", borderRadius: "8px", overflow: "hidden",
                marginTop: "10px", border: `1px solid ${line}`
              }}>
                <img src={selectedImage} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div style={{ height: "4px", borderRadius: "2px", background: "#EDEBE3", marginTop: "8px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: rust, width: `${uploadProgress}%`, transition: "width 0.3s" }} />
              </div>
            )}

            {errorMessage && (
              <p style={{ color: rust, fontSize: "12px", margin: "8px 0", fontFamily: "'IBM Plex Mono', monospace" }}>
                ⚠️ {errorMessage}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={triggerUpload}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  border: `1px solid ${line}`, borderRadius: "8px", padding: "10px",
                  background: "#F5F3EC", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px", color: ink, fontWeight: 600, transition: "background 0.2s"
                }}
              >
                📸 Add photo
              </button>
              <button
                type="submit"
                disabled={isPosting || (!postCaption.trim() && !selectedImage)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  background: ink, border: "none", borderRadius: "8px", padding: "10px",
                  color: "#F5F3EC", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px", fontWeight: 600, opacity: isPosting || (!postCaption.trim() && !selectedImage) ? 0.6 : 1
                }}
              >
                <IconPlus size={12} color="#F5F3EC" /> {isPosting ? "Posting…" : "Post"}
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
          </form>
        </div>
      ) : (
        <div style={{
          background: "#FBFAF7", border: `1px solid ${line}`, borderRadius: "10px",
          padding: "18px", textAlign: "center"
        }}>
          <p style={{ fontSize: "13px", color: "#6B6656", margin: "0 0 12px" }}>Sign in to share your Touch Grass moment</p>
          <button style={{
            background: ink, color: "#F5F3EC", border: "none", borderRadius: "6px",
            padding: "10px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
            fontWeight: 600, cursor: "pointer"
          }}>
            Go to Sign In
          </button>
        </div>
      )}

      {/* Posts Feed */}
      <div style={{ borderTop: `1px solid ${line}`, paddingTop: "14px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#9A9484", textTransform: "uppercase", marginBottom: "12px" }}>
          {postsLoading ? "Loading…" : `${posts.length} Moments`}
        </div>

        {posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#9A9484" }}>
            <p style={{ fontSize: "12px" }}>No moments yet — be the first to touch grass! 🌿</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUid={user?.uid}
              onLike={handleLike}
              onDeleteComment={handleDeleteComment}
              styles={styles}
              ink={ink}
              rust={rust}
              line={line}
            />
          ))
        )}
      </div>
    </div>
  );
}
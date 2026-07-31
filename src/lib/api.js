// src/lib/api.js
import { auth } from "./firebase";

export async function callApi(name, payload = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("auth-required");
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "API error");
  return json;
}
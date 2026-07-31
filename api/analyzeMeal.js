const { requireUser, cleanText, safeMeal } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await requireUser(req);
    const imageData = String(req.body?.imageData || "");
    if (!imageData.startsWith("data:image/") || imageData.length > 900000) {
      return res.status(400).json({ error: "Invalid or oversized image." });
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: "Gemini is not configured on the server." });

    const comma = imageData.indexOf(",");
    const mimeType = imageData.slice(5, imageData.indexOf(";"));
    const base64 = imageData.slice(comma + 1);
    const prompt = `Analyze this meal image. Return JSON only: {"isFood":true,"name":"short meal name","calories":number,"protein":"numberg","carbs":"numberg","fats":"numberg","tip":"one short practical sentence"}. If it is not food, return {"isFood":false}. Do not invent restaurant names or brand claims.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });

    if (!response.ok) return res.status(500).json({ error: "Gemini analysis failed." });
    const body = await response.json();
    const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return res.status(500).json({ error: "Gemini returned no analysis." });

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*/, "").replace(/```$/, "").trim());
    } catch {
      return res.status(500).json({ error: "Gemini returned invalid JSON." });
    }
    if (!parsed.isFood) return res.status(400).json({ error: "This image does not look like food." });

    return res.status(200).json({ meal: safeMeal(parsed), tip: cleanText(parsed.tip, 180) });
  } catch (err) {
    return res.status(400).json({ error: err.message, code: err.code || "invalid-argument" });
  }
};
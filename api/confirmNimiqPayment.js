const { requireUser, cleanText, number, userRef, PRO_MONTH_MS, FieldValue, db } = require("./_util");

async function verifyNimiqTransaction(txHash) {
  const rpcUrl = process.env.NIMIQ_RPC_URL;
  const recipient = process.env.NIMIQ_RECEIVING_ADDRESS;
  const expectedValue = number(process.env.NIMIQ_PRO_PRICE_LUNAS, 10000000);
  const requiredConfirmations = number(process.env.NIMIQ_CONFIRMATIONS, 1);
  if (!rpcUrl || !recipient) throw new Error("Nimiq verification is not configured.");

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "getTransactionByHash", params: [txHash] }),
  });
  if (!response.ok) throw new Error("Nimiq RPC unavailable.");

  const body = await response.json();
  const tx = body.result;
  if (!tx) throw new Error("Transaction is not visible on-chain yet.");

  const to = tx.to || tx.recipient;
  const value = number(tx.value);
  const confirmations = number(tx.confirmations, requiredConfirmations);
  if (to !== recipient || value !== expectedValue || confirmations < requiredConfirmations || tx.execution_result === false) {
    throw new Error("Transaction does not match this payment.");
  }
  return tx;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const uid = await requireUser(req);
    const txHash = cleanText(req.body?.txHash, 160);
    if (!txHash) return res.status(400).json({ error: "Transaction hash is required." });

    const paymentRef = db.collection("payments").doc(txHash);
    const uRef = userRef(uid);
    const already = await paymentRef.get();
    if (already.exists && already.data().uid !== uid) return res.status(409).json({ error: "Payment already used." });

    await verifyNimiqTransaction(txHash);

    const result = await db.runTransaction(async (tx) => {
      const [paymentSnap, userSnap] = await Promise.all([tx.get(paymentRef), tx.get(uRef)]);
      const current = userSnap.exists ? userSnap.data() : {};
      if (paymentSnap.exists && paymentSnap.data().uid === uid) return current;

      const proUntil = Math.max(Date.now(), number(current.proUntil)) + PRO_MONTH_MS;
      const gift = number(current.nimGiftBalance) + 10;
      tx.set(paymentRef, { uid, txHash, createdAt: FieldValue.serverTimestamp(), value: number(process.env.NIMIQ_PRO_PRICE_LUNAS, 10000000) });
      tx.set(uRef, { proUntil, nimGiftBalance: gift }, { merge: true });
      return { ...current, proUntil, nimGiftBalance: gift };
    });

    return res.status(200).json({ proUntil: result.proUntil, nimGiftBalance: result.nimGiftBalance, tickets: result.tickets || 0 });
  } catch (err) {
    const code = err.message?.includes("already used") ? "already-exists" : err.code || "internal";
    return res.status(400).json({ error: err.message, code });
  }
};
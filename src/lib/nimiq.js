import { init } from "@nimiq/mini-app-sdk";

let nimiqPromise = null;

// init() connects to the Nimiq Pay app that's hosting this mini app.
// It only needs to run once, so we cache the promise.
export function getNimiq() {
  if (!nimiqPromise) nimiqPromise = init();
  return nimiqPromise;
}

// Returns the user's active Nimiq address inside Nimiq Pay, or null if
// this isn't running inside Nimiq Pay (e.g. testing in a normal browser).
export async function getNimiqAddress() {
  try {
    const nimiq = await getNimiq();
    const accounts = await nimiq.listAccounts();
    const first = accounts?.[0];
    return (first && (first.address || first)) || null;
  } catch (err) {
    console.warn("Nimiq not available (not running inside Nimiq Pay?)", err);
    return null;
  }
}

// ⚠️ IMPORTANT: the exact parameter names for sendPayment() below are our
// best guess from the public Nimiq Mini Apps docs, not a confirmed API
// reference. Before relying on this in production, run this in your
// project so your AI coding tool (Claude Code / Cursor) gets the exact,
// current signature and can fix this function if needed:
//
//   npx skills add nimiq/developer-center --skill mini-apps
//
// Then ask it to verify/fix payNimSubscription() against the real SDK types.
export async function payNimSubscription({ recipient, amountNim, message }) {
  const nimiq = await getNimiq();
  const result = await nimiq.sendPayment({
    recipient,
    amount: amountNim,
    message,
  });
  return result; // expected to include a tx hash on success
}
import React from "react";

// Small, consistent-stroke icon set used across the app. All take
// `size` and `color` so they inherit the app's palette instead of
// relying on emoji, which render inconsistently across platforms.

export function IconSettings({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
      <path
        d="M19.4 13a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V4a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10a1.65 1.65 0 001.51 1H20a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color} strokeWidth="1.4"
      />
    </svg>
  );
}

export function IconWallet({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke={color} strokeWidth="1.6" />
      <path d="M3 9h18" stroke={color} strokeWidth="1.6" />
      <circle cx="16.5" cy="14" r="1.3" fill={color} />
    </svg>
  );
}

export function IconFlame({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2c1 3-3 4.5-3 8a4.5 4.5 0 009 0c0-1.2-.4-2-1-2.7.1 1-.5 1.7-1 1.7-.9 0-1-1-.7-1.8C16 5.8 13 4 12 2z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M9.5 13a2.5 2.5 0 005 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconDrumstick({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M14.5 4.5c2.5-1 5 1.5 4 4-.6 1.6-2.2 3.7-4.7 6.2-2.7 2.7-6.7 5.4-8.6 3.5-1.9-1.9.8-5.9 3.5-8.6 2.5-2.5 4.6-4.1 5.8-5.1z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      <circle cx="6.3" cy="17.7" r="2" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

export function IconWheat({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 21V7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 8c-2-.3-3-2-3-3.5S10 2 12 2s3 1 3 2.5S14 7.7 12 8z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 12c-2-.3-3-2-3-3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 12c2-.3 3-2 3-3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 16c-2-.3-3-2-3-3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 16c2-.3 3-2 3-3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconDroplet({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2s6 7 6 11.5A6 6 0 016 13.5C6 9 12 2 12 2z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLock({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke={color} strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 118 0v3" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function IconCheck({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLogout({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGoogle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.85A11 11 0 0012 23z" />
      <path fill="#FBBC05" d="M5.86 14.1a6.6 6.6 0 010-4.2V7.05H2.18a11 11 0 000 9.9l3.68-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.68 2.85C6.72 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function IconPlus({ size = 12, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconMinus({ size = 12, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconGift({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
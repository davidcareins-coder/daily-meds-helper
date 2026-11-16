// Daily Meds Helper — Firebase configuration.
// ---------------------------------------------------------------------------
// PLACEHOLDER — this committed file holds NO real credentials.
// The real config (apiKey + reCAPTCHA site key) is injected at deploy time
// from the FIREBASE_CONFIG_JSON repository secret by the GitHub Actions
// workflow (scripts/generate-config.mjs). It never lives in this repo.
//
// Why: on Nov 16, 2026 the first live API key was committed here by mistake
// and GitHub flagged it. The key was revoked and rotated the same day, and
// the file was purged from git history. Never put a real key in this file
// again — if you need a real config locally, set window.__FIREBASE_CONFIG__
// in the browser console (that object wins if present) or use a local-only
// file that is never committed.
// ---------------------------------------------------------------------------

const PLACEHOLDER_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  // reCAPTCHA Enterprise site key for App Check (from the Firebase console,
  // App Check section). Needed for cloud calls once App Check is enforced.
  // Leave empty while using the debug provider on localhost.
  recaptchaSiteKey: "YOUR_RECAPTCHA_SITE_KEY",
};

function isPlaceholder(config) {
  return (
    !config ||
    !config.apiKey ||
    config.apiKey === "YOUR_API_KEY_HERE" ||
    !config.projectId ||
    config.projectId === "YOUR_PROJECT_ID"
  );
}

// window.__FIREBASE_CONFIG__ (set by the user in the browser console or a
// local-only file) overrides the placeholders, so the committed file can
// stay clean.
export const firebaseConfig =
  typeof window !== "undefined" && window.__FIREBASE_CONFIG__
    ? { ...PLACEHOLDER_CONFIG, ...window.__FIREBASE_CONFIG__ }
    : PLACEHOLDER_CONFIG;

export const isConfigured = !isPlaceholder(firebaseConfig);
export const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

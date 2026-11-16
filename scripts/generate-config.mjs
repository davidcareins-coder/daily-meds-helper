// Generates src/config.js from the FIREBASE_CONFIG_JSON environment variable
// (a GitHub Actions repository secret). Runs ONLY at deploy time; the real
// key never lives in the repo. The committed src/config.js is a placeholder
// with the same shape and exports — this script writes a file with the same
// exports (firebaseConfig, isConfigured, isLocalhost) but real values.
//
// Usage (GitHub Actions): FIREBASE_CONFIG_JSON='{"apiKey":"...","authDomain":"...",...}' node scripts/generate-config.mjs
// The secret JSON must have: apiKey, authDomain, projectId, storageBucket,
// messagingSenderId, appId, recaptchaSiteKey.
//
// Never run this with a real config on a machine whose src/config.js could
// then be committed — the workflow overwrites the file in the runner only,
// and src/config.js is never committed with real values.

import { writeFileSync } from "node:fs";

const raw = process.env.FIREBASE_CONFIG_JSON;
if (!raw) {
  throw new Error(
    "FIREBASE_CONFIG_JSON is not set. Set the FIREBASE_CONFIG_JSON repository secret (Settings → Secrets and variables → Actions)."
  );
}

let cfg;
try {
  cfg = JSON.parse(raw);
} catch {
  throw new Error("FIREBASE_CONFIG_JSON is not valid JSON.");
}

const required = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
  "recaptchaSiteKey",
];
const missing = required.filter(
  (k) => !cfg[k] || typeof cfg[k] !== "string" || cfg[k].length === 0
);
if (missing.length > 0) {
  throw new Error(`FIREBASE_CONFIG_JSON is missing: ${missing.join(", ")}`);
}
if (cfg.apiKey.startsWith("YOUR_") || cfg.projectId.startsWith("YOUR_")) {
  throw new Error(
    "FIREBASE_CONFIG_JSON still holds placeholder values — it must hold the real config."
  );
}

// JSON.stringify escapes the values, so no value can break out of its string.
const q = (v) => JSON.stringify(v);

const out = `// Daily Meds Helper — Firebase configuration.
// ---------------------------------------------------------------------------
// GENERATED at deploy time by scripts/generate-config.mjs from the
// FIREBASE_CONFIG_JSON repository secret (GitHub Actions). Do NOT commit
// this file with real values — the committed src/config.js is a placeholder
// with the same shape. The real key is injected here by the deploy workflow
// and never lives in the repo. See README.md "Deployment".
// ---------------------------------------------------------------------------

const REAL_CONFIG = {
  apiKey: ${q(cfg.apiKey)},
  authDomain: ${q(cfg.authDomain)},
  projectId: ${q(cfg.projectId)},
  storageBucket: ${q(cfg.storageBucket)},
  messagingSenderId: ${q(cfg.messagingSenderId)},
  appId: ${q(cfg.appId)},
  // reCAPTCHA Enterprise site key for App Check (from the Firebase console,
  // App Check section). Needed for cloud calls once App Check is enforced.
  recaptchaSiteKey: ${q(cfg.recaptchaSiteKey)},
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
// local-only file) overrides the deployed values, so the deployed file can
// stay clean.
export const firebaseConfig =
  typeof window !== "undefined" && window.__FIREBASE_CONFIG__
    ? { ...REAL_CONFIG, ...window.__FIREBASE_CONFIG__ }
    : REAL_CONFIG;

export const isConfigured = !isPlaceholder(firebaseConfig);
export const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
`;

writeFileSync("src/config.js", out);
console.log("src/config.js generated from FIREBASE_CONFIG_JSON (values not printed).");

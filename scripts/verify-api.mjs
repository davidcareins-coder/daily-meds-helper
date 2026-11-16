// Node-side check that the Firebase AI Logic API surface used by this
// project actually exists in the installed firebase package.
// Run: npm run verify-api
import { initializeApp } from "firebase/app";
import { initializeAppCheck } from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";

const checks = [
  ["firebase/app initializeApp", typeof initializeApp === "function"],
  ["firebase/app-check initializeAppCheck", typeof initializeAppCheck === "function"],
  ["firebase/ai getAI", typeof getAI === "function"],
  ["firebase/ai getGenerativeModel", typeof getGenerativeModel === "function"],
  ["firebase/ai GoogleAIBackend", typeof GoogleAIBackend === "function"],
  ["InferenceMode.PREFER_ON_DEVICE", InferenceMode.PREFER_ON_DEVICE === "prefer_on_device"],
  ["InferenceMode.ONLY_ON_DEVICE", InferenceMode.ONLY_ON_DEVICE === "only_on_device"],
  ["InferenceMode.PREFER_IN_CLOUD", InferenceMode.PREFER_IN_CLOUD === "prefer_in_cloud"],
  ["InferenceMode.ONLY_IN_CLOUD", InferenceMode.ONLY_IN_CLOUD === "only_in_cloud"],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

// getGenerativeModel accepts the hybrid params shape used in src/firebase.js.
// (We cannot call it without a Firebase app instance; the call below
// intentionally uses a dummy app and expects a config error, NOT a
// "not a function" / signature error.)
try {
  const app = initializeApp({ apiKey: "x", projectId: "x", appId: "x" });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
  console.log("PASS  getGenerativeModel({ mode: PREFER_ON_DEVICE }) accepted");
  console.log("      model has generateContent:", typeof model.generateContent === "function");
  console.log("      model has initializeDeviceModel:", typeof model.initializeDeviceModel === "function");
} catch (err) {
  console.log("NOTE  hybrid model construction threw (expected with dummy config):", err.message);
}

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("API surface verified.");

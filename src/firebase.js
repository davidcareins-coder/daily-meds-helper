// Daily Meds Helper — Firebase AI Logic setup.
// ---------------------------------------------------------------------------
// This is the file that proves the contest requirement: Firebase AI Logic
// is imported from "firebase/ai" and ACTUALLY CALLED at runtime
// (getAI + getGenerativeModel below), not just named in the README.
// ---------------------------------------------------------------------------

import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";
import { firebaseConfig, isConfigured, isLocalhost } from "./config.js";

export const ROUTINE_SYSTEM_PROMPT = `You are a kind, patient medication helper for an older adult with poor eyesight.
Answer ONLY from the schedule given in the user's message. Never invent medicines, times, or doses.
Keep every answer to one or two short, plain sentences. Use large, simple words.
If the schedule does not contain the answer, say "I don't know from your schedule. Please check with your pharmacist."
Never give medical advice, never suggest changing a dose, and never diagnose anything.`;

// On-device create options for the routine model. Shared with the
// availability check in enableOnDevice() so both use identical options.
export const ROUTINE_CREATE_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
  initialPrompts: [
    { role: "system", content: [{ type: "text", value: ROUTINE_SYSTEM_PROMPT }] },
  ],
};

export const CLOUD_SYSTEM_PROMPT = `You are a careful medication information helper. Give general information only, in short plain sentences.
Always end with: "This is general information, not medical advice. Follow your doctor's and pharmacist's instructions."
Never suggest changing a dose, never diagnose, and never guess. If you are unsure, say so.`;

let state = {
  status: "not-configured", // not-configured | ready | on-device-ready | error
  detail: "",
  app: null,
  ai: null,
  routineModel: null,
  cloudModel: null,
  deviceModelReady: false,
};

/**
 * Initialise Firebase + both GenerativeModel instances.
 * Safe to call with placeholder config: it simply reports "not-configured"
 * and the app keeps working with deterministic (non-AI) answers.
 */
export function initFirebase() {
  if (!isConfigured) {
    state.status = "not-configured";
    state.detail = "Add your Firebase config in src/config.js (see README.md).";
    return state;
  }

  try {
    const app = initializeApp(firebaseConfig);

    // App Check: on localhost use the debug provider so cloud calls work
    // while developing. The debug flag MUST be set before initializeAppCheck.
    // See RESEARCH.md §3 — debug tokens are accepted by the contest.
    if (isLocalhost) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    if (firebaseConfig.recaptchaSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(firebaseConfig.recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }

    // Gemini Developer API backend (free tier, no billing needed to start).
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    // ROUTINE model: on-device first (Gemini Nano via Chrome's Prompt API),
    // automatic fallback to the cloud model (default: gemini-3.5-flash-lite).
    const routineModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      onDeviceParams: {
        createOptions: ROUTINE_CREATE_OPTIONS,
      },
    });

    // CLOUD model: cloud only, for the harder jobs (label reading,
    // "what is this pill for", weekly summary).
    const cloudModel = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: "gemini-3.5-flash",
        generationConfig: { maxOutputTokens: 400 },
      },
    });

    state = { ...state, status: "ready", detail: "", app, ai, routineModel, cloudModel };
  } catch (err) {
    state.status = "error";
    state.detail = err && err.message ? err.message : String(err);
  }
  return state;
}

/**
 * Start the on-device model download. MUST be called after/on a user
 * interaction (button click) and BEFORE any routine generateContent call.
 * onProgress receives a 0..1 fraction.
 *
 * IMPORTANT: initializeDeviceModel() resolves even when the on-device model
 * is NOT available in PREFER_ON_DEVICE mode — the SDK only logs a debug
 * message when the Prompt API is missing, it does not throw. A bare resolve
 * therefore proves nothing. This function verifies with the Prompt API
 * directly (LanguageModel must exist, and availability() must report
 * "available" after the download promise resolves) and throws a clear error
 * otherwise, so the UI never claims "ready" for a model that isn't there.
 */
export async function enableOnDevice(onProgress) {
  if (!state.routineModel) throw new Error("Firebase is not configured yet.");
  const LanguageModel = globalThis.LanguageModel;
  if (typeof LanguageModel === "undefined") {
    throw new Error(
      "On-device AI (Gemini Nano / Prompt API) is not available in this browser. " +
        "Use desktop Chrome 139+ with chrome://flags/#prompt-api-for-gemini-nano-multimodal-input enabled."
    );
  }
  await state.routineModel.initializeDeviceModel((val) => {
    if (typeof onProgress === "function") onProgress(val);
  });
  // After the download promise resolves, the model must report "available".
  // Anything else (unavailable / downloadable / downloading) means there is
  // no usable on-device model — do NOT report ready.
  const availability = await LanguageModel.availability(ROUTINE_CREATE_OPTIONS);
  if (availability !== "available") {
    throw new Error(
      `On-device model is not ready (Prompt API availability: ${availability}). ` +
        "Cloud answers will be used instead."
    );
  }
  state.deviceModelReady = true;
  state.status = "on-device-ready";
  return state;
}

export function getState() {
  return state;
}

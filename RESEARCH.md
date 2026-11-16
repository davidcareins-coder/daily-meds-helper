# Daily Meds Helper — Research Notes

**Contest:** #BuildHybridAI 2026 (Devpost, Google sponsor)
**App:** voice-first daily medication helper for an older person with impaired vision
**Researched:** Mon Nov 16, 2026, from live docs (Firebase, Chrome, Devpost rules)
**Tags:** V = verified by reading the live doc myself · C = a doc/secondary source claims it · U = unverified

---

## 1. Firebase AI Logic — Web JS SDK (V)

Source: https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference
(crawled Nov 16, 2026) and https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options

### Install
```bash
npm install firebase
```
Latest version on npm, checked Nov 16, 2026: **13.3.0** (V, `npm view firebase version`).
Hybrid on-device inference requires **Firebase AI Logic SDK v12.5.0+** (V, docs).

### Exact imports (V, docs)
```js
import { initializeApp } from "firebase/app";
import { initializeAppCheck } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
```

### Setup (V, docs)
```js
const firebaseApp = initializeApp(firebaseConfig);

// Gemini Developer API backend (recommended: free, no billing needed to start)
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// One model, hybrid routing built in
const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
```

### Inference modes (V, docs)
| Mode | Behaviour |
|---|---|
| `PREFER_ON_DEVICE` | On-device if available; otherwise falls back to the cloud model |
| `ONLY_ON_DEVICE` | On-device only; throws if unavailable/unsupported |
| `PREFER_IN_CLOUD` | Cloud if available; otherwise falls back to on-device |
| `ONLY_IN_CLOUD` | Cloud only; throws otherwise |

### Default cloud model (V, config docs)
- **Default cloud-hosted fallback model is `gemini-3.5-flash-lite`** (starting with JS SDK v13.0.0).
- Override it with `inCloudParams`:
```js
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: {
    model: "gemini-3.5-flash",          // any supported Gemini model name
    generationConfig: { maxOutputTokens: 200 }
  }
});
```
- Note: an older secondary article claimed there is *no* default cloud model and one must be set explicitly. That is outdated — the current docs state the v13.0.0 default above. (V, docs vs C, secondary.)

### On-device model config (V, config docs)
```js
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  onDeviceParams: {
    createOptions: {
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [
        { role: "system", content: [{ type: "text", value: "You are a helpful and concise assistant." }] }
      ]
    }
  }
});
```
This is where the app's system prompt lives for on-device answers.

### Initialize the on-device model (V, docs)
```js
// MUST be called after/on a user interaction (e.g. button click)
// and BEFORE any generateContent() call.
model.initializeDeviceModel((val) =>
  console.log(`Download progress: ${Math.round(val * 10000) / 100}%`)
);
```
If the model isn't downloaded yet, this starts the download in the background.

### Send a prompt (V, docs)
```js
const result = await model.generateContent(prompt);
const text = result.response.text();
// Which path served it (JS SDK v12.5.0+):
console.log(result.response.inferenceSource); // "ON_DEVICE" or "IN_CLOUD"
```
Streaming variant: `generateContentStream()` (V, docs).

### What on-device supports (V, docs)
- **Single-turn text generation only — NOT multi-turn chat.** Each call is one prompt in, one answer out.
- Text-only input.
- Text + image input, **JPEG and PNG only**.
- Structured output (JSON and enums).
- Streaming or non-streaming output.

### What on-device does NOT support (V, docs)
- Image generation (Gemini Nano Banana) — falls back to cloud; `ONLY_ON_DEVICE` throws.
- Image inputs other than JPEG/PNG; audio, video, PDF inputs.
- Files by URL (must be inline data).
- Multi-turn chat — falls back to cloud; `ONLY_ON_DEVICE` throws.
- Tools: function calling, code execution, URL context, Grounding with Google Search/Maps.
- Gemini Live API, server prompt templates, count tokens.
- Firebase console AI monitoring shows **no data for on-device inference** (cloud calls are monitored normally).

---

## 2. Gemini Nano on-device in Chrome (V + C)

Sources:
- Firebase hybrid docs (V): on-device inference uses the **Prompt API from Chrome**; supported for web apps on **Chrome on Desktop v139+**.
- Chrome Prompt API docs via Firebase links (V, referenced): `LanguageModel.availability()` returns `available` / `downloading` / `downloadable` / `unavailable`; `LanguageModel.create({ monitor })` opens a session.
- Secondary sources, agreeing (C): Prompt API stable on the open web since **Chrome 148**; stable in extensions since Chrome 138; entry point is the global `LanguageModel` (old `window.ai` surface is gone).

### Chrome setup for local dev (V, Firebase docs)
1. Chrome v139+. Check/update at `chrome://settings/help`.
2. Enable the flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled. (Needed for image input; text-only may work without it — U, verify during build.)
3. Restart Chrome.
4. Optional: pre-download the model in DevTools console:
   ```js
   await LanguageModel.availability(); // "available" | "downloading" | "downloadable"
   await LanguageModel.create();       // starts download if "downloadable"
   ```

### Hardware / environment limits (C, multiple agreeing secondaries)
- Desktop only: Windows 10/11, macOS 13+, Linux, Chromebook Plus. **No mobile.**
- Needs roughly: GPU with >4 GB VRAM, **or** 16 GB RAM + 4 CPU cores; **22 GB free disk**.
- Model is ~1.5–2.4 GB, downloads on first use; Chrome deletes it if free disk drops below ~10 GB or if unused for 30 days.
- Users can disable on-device AI entirely (Chrome Settings → System); then every call returns `unavailable`.
- On-device context is small (~4,096–6,144 tokens) — keep prompts short.
- Supported languages for text in/out include English (V, Firebase docs use English examples; full language list U).

### Implication for the demo
The demo must **show its fallback working**, because judges may run it on a machine without Nano. The app must never hard-fail when on-device is unavailable: `PREFER_ON_DEVICE` falls back to cloud automatically, and the UI shows which path answered (`inferenceSource`). If the judge's machine has no internet either, the app must still show the schedule and the deterministic (non-AI) answers — see PLAN.md.

---

## 3. App Check with debug tokens (V)

Sources:
- https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference (Step 4) and
  https://firebase.google.com/docs/app-check/web/debug-provider (both crawled Nov 16, 2026).

- Since early July 2026, the Firebase console's AI Logic guided setup **automatically enforces Firebase App Check** for AI Logic. Cloud calls from an app without a valid App Check token are rejected.
- For local development, use the **debug provider**: in the debug build, before initializing App Check, set
  ```js
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  ```
  then call `initializeAppCheck(firebaseApp, { /* App Check options */ })`.
- On first local run, the browser console prints a debug token:
  `AppCheck debug token: "123a4567-b89c-12d3-e456-789012345678"`.
- Register that token in the Firebase console: **Security → App Check → Apps tab → overflow menu → Manage debug tokens**.
- **Correction to an older doc snippet (V, checked in the installed package):** an older crawl of the get-started guide shows `import { initializeAppCheck, DebugProvider } from "firebase/app-check"`, but **firebase v13.3.0 exports no `DebugProvider`** — the debug provider is enabled solely by setting `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` before `initializeAppCheck()`. The scaffold uses the flag only. (Verified in the installed module: it lists `initializeAppCheck`, `ReCaptchaEnterpriseProvider`, `ReCaptchaV3Provider`, no `DebugProvider`.)
- The token allows access to backend services without a valid device — **never commit it to a public repo and never ship it in production builds**. If compromised, delete it in the console immediately.
- The contest rules explicitly say: **"Firebase AI Logic requires App Check; debug tokens are accepted in submissions."** (V, Devpost rules.)

### Production attestation (C/U)
- Production needs a real attestation provider (e.g. reCAPTCHA Enterprise) configured in the console. Exact provider setup for this app is U — to be done when the Firebase project is created. The scaffold uses the debug provider only, gated to localhost.

---

## 4. Web Speech API — voice in / voice out (C)

Sources: multiple agreeing secondaries (redbison.dev, textintoaudio.com, iessonferrer.com, micdrop blog), Nov 2026.

- Two halves: **`speechSynthesis`** (text-to-speech) and **`SpeechRecognition`** (speech-to-text).
- `speechSynthesis`: works in all modern browsers; mostly **local system voices, works offline**. Chrome needs user activation before `speak()` (since Chrome 71). (C)
- `SpeechRecognition` in Chrome: exposed as `SpeechRecognition` (Chrome 139+) or `webkitSpeechRecognition` (older). **By default the audio is sent to Google's speech servers — it does NOT work offline** and fails with a `network` error when offline. (C)
- **Chrome 139+ adds on-device recognition**: set `recognition.processLocally = true` before `start()`; audio stays on device once the language pack is downloaded. Without the pack it errors `language-not-supported`. (C — two agreeing secondaries; not yet verified in our own test.)
- Honest design consequence: voice *input* is the one part that is not fully offline by default. The app must also offer **big tap buttons** for every question, so it works with no microphone, no network, and no recognition at all. Voice output (`speechSynthesis`) is the reliable offline half.

---

## 5. Contest rules — what the submission must prove (V)

Source: https://firebasehybridaihackathon.devpost.com/rules (official rules, read Nov 16, 2026).

### Dates (V)
- Submission period: **Nov 11, 2026 1:30 PM PT – Nov 30, 2026 2:00 PM PT** (= Nov 30, 5:00 PM ET).
- Judging: Dec 10–16, 2026. Winners announced on/around Dec 21, 2026.

### What to build (V)
- A Gen AI app using **Firebase AI Logic** + supported Firebase products (AppCheck, Remote Config, Firestore, Authentication).
- At least one platform; **Web (Chrome) integrating Gemini Nano 4 via Firebase AI Logic** (web app or Chrome extension). Multi-platform preferred (we are Web-only, solo).
- Firebase AI Logic requires App Check; debug tokens accepted.

### Submission requirements (V)
- Text description: how Firebase AI Logic was used, feature/functionality summary, value proposition.
- **Public code repository (GitHub or GitLab)** with all source, assets, and instructions to run it. **Must demonstrate Firebase AI Logic at runtime in code — imported and actually called** (library import, app/backend entry point, or loaded agent/flow/MCP config), **not just named in the README**.
- **Open-source license**, detectable/visible at the top of the repo page (About section). Apache preferred; any open-source license allowed.
- **Demo video ≤ 3 minutes** (only the first 3 minutes evaluated), showing the project functioning on its platform(s), public on YouTube, link on the submission form, English or English subtitles.
- Hosted project URL **strongly encouraged** (not required).
- Project must be available **free of charge, without restriction**, for testing/evaluation by Sponsor, Administrator, Judges until the Judging Period ends. If private, include login credentials in testing instructions.
- **Must NOT include production API keys, live Google Cloud project secrets, confidential commercial data, or PII** in the repo, submission form, or testing instructions.
- Multiple submissions allowed (each unique). New projects or existing projects significantly updated during the period (with a summary of what was built during the period).

### Judging (V)
- Stage One: pass/fail — meets all requirements, reasonably addresses a challenge, reasonably applies the requirements.
- Stage Two: four **equally weighted** criteria, 1–5 each, averaged:
  1. **Technological Implementation** — how well built, how effectively it uses Firebase AI Logic hybrid inference.
  2. **Design** — complete, coherent product experience, not just a proof of concept.
  3. **Potential Impact** — credible, specific case for solving a real problem for a real audience, demonstrated.
  4. **Quality of the Idea** — creative, non-obvious use of Firebase AI Logic; genuine understanding of the problem space.
- Prizes (V): $30,000 total — Grand $10,000; 1st Runner Up $7,000; 2nd Runner Up $4,000; Best iOS / Android / Web $3,000 each. One grand prize + up to one Best-of-category prize per submission.

### Quota sprints (V)
- Free tier covers all required tools (Firebase AI Logic, Gemini Nano 4). Extra access to billing-required models (e.g. image generation) via a sponsored Google Account Quota form; no purchase required; account valid 4 days from issuance; not guaranteed.
- Sprint 2: request by **Wed Nov 18, 2026, 10:00 AM PT** (1:00 PM ET); account sent Thu Nov 19.
- Sprint 3 (final): request by **Wed Nov 25, 2026, 10:00 AM PT** (1:00 PM ET); account sent Fri Nov 27.
- This app does **not** need image generation, so no quota request is expected. (Plan decision, not a rule.)

---

## 6. Open questions / things still uncertain

1. **U — Whether the multimodal flag is needed for text-only on-device calls.** The Firebase doc's Step 1 enables `#prompt-api-for-gemini-nano-multimodal-input` for "the on-device multimodal model". Text-only may work without the flag on Chrome 148+. Verify during first local test.
2. **U — Which Chrome version the judges will use.** If judges run Chrome <139, on-device is unavailable and everything falls back to cloud. The app must demo well on the cloud path too.
3. **U — Exact on-device model name served by Chrome's Prompt API on web.** The contest calls it "Gemini Nano 4". Chrome's Prompt API serves Gemini Nano; the "4" branding is the contest's term. No code change depends on the name (Firebase handles it), but the submission text should say "Gemini Nano (on-device, via Chrome's Prompt API)".
4. **C — `processLocally` for SpeechRecognition.** Two secondaries agree Chrome 139+ supports on-device recognition with a language pack. Not verified in our own test yet; treat as a progressive enhancement, not a dependency.
5. **U — Firebase free-tier quota limits for the Gemini Developer API backend** (requests/minute for the cloud fallback). The rules say required tools work at no cost through the free tier; exact numeric limits not checked. For a demo this is a non-issue; note it in the README if the demo ever hits a limit.
6. **U — Production App Check provider choice** (reCAPTCHA Enterprise vs other). Only matters after the Firebase project exists; debug provider covers dev + submission.

# Daily Meds Helper

A voice-first daily medication helper for an older adult with poor eyesight — the #BuildHybridAI 2026 entry (solo, Web track).

She asks **"Did I take my morning pills?"**, **"What's next?"**, or **"What time is my evening dose?"** — by tapping a big button or by voice — and gets a spoken answer in large type. Routine questions are answered **on her device by Gemini Nano** (Firebase AI Logic hybrid inference, `PREFER_ON_DEVICE`), so they work with no internet, keep her health routine private, and cost nothing. Harder jobs — reading a prescription label from a photo, explaining what a pill is for, the weekly family summary — go to the **cloud model** (`ONLY_IN_CLOUD`). Every answer shows whether it came from the device or the cloud.

**Demo data only.** The person and medicines are fictional. The app is not medical advice.

- Research: [`RESEARCH.md`](RESEARCH.md) (live-doc findings, V/C/U tagged)
- Plan: [`PLAN.md`](PLAN.md)

---

## Run it (no Firebase project needed for the demo UI)

```bash
npm install
npm run dev        # serves the folder on http://localhost:3000
```

Open http://localhost:3000 in **Chrome on Desktop (v139+)**. Without a Firebase config the page runs in **demo mode**: the schedule, the three questions, "I took them", refill warnings, and spoken answers all work from plain code. The AI status line tells you the config is missing.

### For on-device AI in Chrome (once the Firebase project exists)
1. Chrome v139+. Check at `chrome://settings/help`.
2. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled, then restart Chrome.
3. In the app, tap **Enable on-device AI** (this calls `model.initializeDeviceModel()` on your tap, as the API requires) and wait for the model download.
4. Test the offline path: turn Wi-Fi off, ask "Did I take my morning pills?" — the answer badge should read "Answered on your device".

---

## Create the Firebase project (needs David's Google sign-in)

Do this once, in the Firebase console (https://console.firebase.google.com). Nothing here creates a project for you.

1. **Sign in** with the Google account and click **Add project** (or pick the existing Google developer account's project). Name it e.g. `daily-meds-helper`. You do **not** need Google Analytics.
2. Go to **AI Services → AI Logic** and click **Get started**. Follow the guided workflow to set up the required APIs.
3. When asked for a **Gemini API provider**, choose the **Gemini Developer API** (free tier, no billing).
4. The workflow **automatically enforces Firebase App Check** for AI Logic. This is expected.
5. Register this web app: in **Project settings → Your apps → Web app (</>)**, give it a nickname (e.g. `daily-meds-helper-web`). Copy the `firebaseConfig` object it shows.
6. Paste the config values into `src/config.js` (replace the `YOUR_…` placeholders). **Do not commit real values to a public repo yet** — for the contest repo, the config goes in only when the repo is ready, and the App Check rules + API restrictions should be set first.
7. **App Check debug token (local dev):** with the app running on `http://localhost:3000`, open DevTools → Console. The first run prints `AppCheck debug token: "…"`. In the console go to **Security → App Check → Apps tab → overflow menu → Manage debug tokens** and register it. (The scaffold sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` on localhost automatically.) **Never commit a debug token.**
8. **Production attestation:** before the hosted demo goes live, set up a real attestation provider (e.g. reCAPTCHA Enterprise) in App Check and put its site key in `src/config.js` as `recaptchaSiteKey`. Debug tokens are accepted by the contest, but a real provider is the right thing for a public demo.

### Quota
No quota request is needed: the app uses text (and one photo read) on the free tier only. If the plan ever changes to need image generation, the final quota sprint closes **Wed Nov 25, 2026, 10:00 AM PT** (form: https://forms.gle/uPcDhaYW3iVo2AYw5).

---

## How the hybrid routing works

| Question / feature | Route | Why |
|---|---|---|
| Did I take my morning pills? / What's next? / What time is my evening dose? | `PREFER_ON_DEVICE` | Short, schedule-grounded, single-turn. Works offline, private, free. Falls back to cloud automatically. |
| Read a prescription label (photo) | `ONLY_IN_CLOUD` | Small label text needs the bigger model's accuracy. |
| What is this pill for? | `ONLY_IN_CLOUD` | Needs broad knowledge; Nano is small and likelier to invent details. |
| Weekly family summary | `ONLY_IN_CLOUD` | Longer synthesis across seven days. |

Every answer displays `response.inferenceSource` (`ON_DEVICE` / `IN_CLOUD`). The three routine questions are **also** answered by plain code from the schedule, so the app always has a correct answer even if the AI call fails.

## Verify the API surface

```bash
npm run verify-api   # asserts the firebase/ai exports + hybrid model construction
npm run check        # syntax-checks every src/*.js file
```

## Submission checklist (contest rules)

- [ ] Public GitHub repo, Apache-2.0 license visible at the top (About section)
- [ ] Firebase AI Logic imported **and actually called** at runtime (`src/firebase.js` → `getAI` + `getGenerativeModel`; `src/ai.js` → `generateContent`)
- [ ] Hosted demo URL (static host; no secrets in the repo)
- [ ] Demo video ≤ 3 min, public on YouTube, English
- [ ] Text description: how Firebase AI Logic was used, features, value proposition
- [ ] No production API keys, secrets, or PII in the repo or submission
- [ ] Submit on Devpost by **Nov 30, 2026, 5:00 PM ET**

## Safety

- Demo data only — fictional person "Rose", 78, and fictional medicines.
- "Not medical advice" disclaimer on the page and spoken on first use.
- The app never changes a dose, never suggests a dose, never checks interactions.
- Label reads always ask the user to confirm before anything is saved.
- No accounts, no tracking, no analytics. Schedule state lives in `localStorage` only.

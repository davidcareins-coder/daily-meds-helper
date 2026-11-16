# Daily Meds Helper — Plan

**Contest:** #BuildHybridAI 2026 · **Track:** Web (Chrome + Gemini Nano) · **Entry:** solo
**Deadline:** Nov 30, 2026, 5:00 PM ET · **Budget:** $0 — free tier only, no paid APIs/services
**Working name:** Daily Meds Helper

---

## 1. The app in plain language

A voice-first daily medication helper for an older person whose eyesight is poor — someone like David's mom, who manages her money and medicines with help because she can't see a screen well.

It answers the three questions she asks every day, out loud, in big clear words:

- **"Did I take my morning pills?"**
- **"What's next?"**
- **"What time is my evening dose?"**

She can ask by **tapping one of three big buttons** or by **speaking** (microphone button). The answer is spoken back to her and shown on screen in very large type. She taps **"I took them"** and the app remembers, so the next time she asks, the answer is right.

The clever part — and the whole point of this contest — is that the **everyday questions are answered right on her own computer, with no internet at all**, by the small AI model built into Chrome (Gemini Nano). When the internet is there and the question is harder, the app reaches up to the bigger cloud model instead. She never has to know or care which one answered; the app just always works.

### Who it is for
An older adult living at home, with impaired vision, taking several daily medications on a morning/evening schedule, and the family member who worries about whether the doses were taken.

### The real problem it solves
- Pill schedules are easy to lose track of — "did I already take these?" is a daily, genuine worry, and double-dosing or missing a dose is a real risk.
- Phone apps assume good eyesight, small text, and a good internet connection. This user has none of those guaranteed.
- A helper that stops working when the Wi-Fi drops is a helper that fails exactly when it is needed most. On-device answers mean it works during an outage, in a dead zone, or on a slow connection — and the answers never leave her computer.

---

## 2. Features

### Core (must have for the demo)
1. **Today's schedule, shown huge.** Morning and evening dose groups with times, medicine names, and a clear TAKEN / NOT YET state. Demo data only (see §6).
2. **Three big question buttons** (also voice-askable):
   - "Did I take my morning pills?"
   - "What's next?"
   - "What time is my evening dose?"
3. **"I took them" button** per dose group — marks taken, stored in the browser (localStorage), so state survives a refresh.
4. **Spoken answers** via `speechSynthesis` (works offline with system voices) + large-type on-screen answer.
5. **Answer source badge** — a small line under each answer: "Answered on your device" or "Answered in the cloud". This is the contest's hybrid story made visible.
6. **"Enable on-device AI" button** — triggers `model.initializeDeviceModel()` on a user tap (required by the API) and shows download progress. If the device can't run Nano, the app says so plainly and keeps working via the cloud.

### Cloud features (harder stuff, routed to the cloud model)
7. **Read a prescription label from a photo.** Snap or upload a photo of a pill bottle label; the cloud model reads the drug name, strength, and directions and adds it to the schedule (with the user confirming before anything is saved). Cloud, because label text is small and accuracy matters — a wrong read is worse than no read.
8. **"What is this pill for?"** General information about a medicine from the schedule. Cloud, because it needs the bigger model's knowledge. Always paired with the disclaimer (see §6).
9. **Refill reminder.** The app counts doses left (demo data) and warns a few days before a bottle runs out. The counting is plain logic; the cloud model only phrases the reminder and the weekly summary.
10. **Weekly summary for family.** A short plain-language summary — doses taken on time, doses missed, refills coming up — that can be copied or read aloud. Generated in the cloud (longer synthesis), and it contains no real personal data in the demo.

### Deliberately NOT in scope
- No real medical advice, no diagnosis, no dosage changes, no interaction checking.
- No accounts, no sign-in, no data leaving the device except the cloud AI calls the user explicitly triggers.
- No multi-turn chat (on-device doesn't support it; the app is single-question, single-answer by design).
- No image generation (so no quota request is needed).

---

## 3. Hybrid routing rules

Two model instances, one for each job. Both are real Firebase AI Logic `GenerativeModel` instances — the routing is explicit, not hidden.

| Question / feature | Route | Why |
|---|---|---|
| "Did I take my morning pills?" | **On-device first** (`PREFER_ON_DEVICE`) | Short, schedule-grounded, single-turn. Works with no internet; private (health routine never leaves the device); instant; free. Falls back to cloud automatically if Nano is unavailable. |
| "What's next?" | **On-device first** (`PREFER_ON_DEVICE`) | Same: short, grounded in the schedule + current time. |
| "What time is my evening dose?" | **On-device first** (`PREFER_ON_DEVICE`) | Same. |
| Read a prescription label (photo) | **Cloud only** (`ONLY_IN_CLOUD`) | Small label text needs the bigger model's accuracy. A misread dose is dangerous; reliability beats offline here. (On-device *can* take JPEG/PNG, but we choose cloud deliberately — say so in the submission text.) |
| "What is this pill for?" | **Cloud only** (`ONLY_IN_CLOUD`) | Needs broad knowledge; Nano is small and more likely to invent details. Medical info must come from the stronger model, with a disclaimer. |
| Refill reminder wording | Deterministic count + **cloud** phrasing | The count is plain code; the model only writes the sentence. |
| Weekly family summary | **Cloud only** (`ONLY_IN_CLOUD`) | Longer synthesis across seven days; not a Nano job. |

**How the routing is implemented:**
- `routineModel` = `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, onDeviceParams: { createOptions: { initialPrompts: [system prompt] } } })` — system prompt includes the schedule and the instruction to answer only from it, in one or two short sentences.
- `cloudModel` = `getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model: "gemini-3.5-flash", generationConfig: { maxOutputTokens: 400 } } })`.
- Every answer displays `result.response.inferenceSource` (`ON_DEVICE` / `IN_CLOUD`) as the badge, so the hybrid behaviour is visible and provable in the demo video.
- **Deterministic safety net:** the three routine questions are *also* answered by plain code from the schedule state (no AI needed). The AI answer is the spoken, natural phrasing; if the AI call fails for any reason, the plain-code answer is shown and spoken instead. The app never has nothing to say.

---

## 4. File structure

```
buildhybridai-meds-helper/
├── RESEARCH.md            # live-doc research (this plan's companion)
├── PLAN.md                # this file
├── README.md              # setup + Firebase project steps + how to run the demo
├── LICENSE                # Apache-2.0 (contest-preferred)
├── package.json           # firebase dep, dev scripts (no build step)
├── .env.example           # placeholder Firebase config keys (NEVER real values)
├── .gitignore             # node_modules, .env, debug tokens
├── index.html             # the whole app UI (single page, import map for Firebase CDN)
├── styles.css             # huge type, high contrast, big touch targets
└── src/
    ├── config.js          # Firebase config (reads window.__FIREBASE_CONFIG__ or .env values; placeholder by default)
    ├── demo-data.js       # fictional schedule + doses-left counts
    ├── firebase.js        # initializeApp, App Check (debug provider on localhost), getAI, both models
    ├── ai.js              # askRoutine() / askCloud() / readLabel() + inferenceSource badge
    ├── schedule.js        # taken/not-taken state in localStorage, "what's next" logic
    ├── speech.js          # speechSynthesis speak + SpeechRecognition listen (processLocally where available)
    └── app.js             # UI wiring: buttons, mic, "I took them", status line
```

No framework, no build step: a static page served over `http://localhost` (or any static host) so the judges can open it and it just works. Firebase is loaded from the CDN via an import map pinned to the installed major version.

---

## 5. Build milestones (to a working demo)

| # | Milestone | Done when… |
|---|---|---|
| M1 | **Scaffold** (this task) | Repo skeleton, placeholder config, page loads, Firebase imports resolve, call path wired, graceful "no config yet" state. |
| M2 | **Firebase project** (needs David) | David creates the Firebase project in the console (Google sign-in), enables AI Logic with the Gemini Developer API, registers the web app, copies the config into `.env`, registers the App Check debug token. Exact steps in README.md. |
| M3 | **Cloud path live** | Routine + cloud questions answered via the cloud model with the config in place; `inferenceSource: IN_CLOUD` shown. |
| M4 | **On-device path live** | Chrome 139+ with the multimodal flag on: `initializeDeviceModel()` downloads Nano, routine questions answer `ON_DEVICE` with Wi-Fi off. Prove it by turning the network off and asking a routine question. |
| M5 | **Voice + schedule UI** | Big buttons, mic input, spoken answers, taken/not-taken state, "what's next" logic — all working end to end with demo data. |
| M6 | **Label reading + summary** | Photo upload → cloud label read (confirm-before-save) + weekly family summary generation. |
| M7 | **Polish + submit** | Hosted demo URL, README + submission text, public GitHub repo (Apache-2.0), ≤3-min YouTube demo video, Devpost submission by Nov 30, 5 PM ET. |

**Quota decision:** no quota request needed — the app uses text (and one photo-read) via the free tier only. Sprint 2 closes Wed Nov 18, 1 PM ET and Sprint 3 closes Wed Nov 25, 1 PM ET; if the plan changes to need image generation, request Sprint 3. Otherwise skip both.

---

## 6. Safety, privacy, and demo-data rules

- **Demo data only.** The schedule belongs to a fictional person ("Rose", 78). No real medical data, no real prescriptions, no real names, no PII anywhere in the repo, demo, or submission.
- **"Not medical advice" disclaimer** — shown on the page and spoken on first use: *"Daily Meds Helper is a demo. It is not medical advice. Always follow your doctor's and pharmacist's instructions, and check with them if anything looks wrong."*
- The app never changes a dose, never suggests a dose, and never checks drug interactions.
- Label reading always asks the user to confirm before anything is added to the schedule.
- Routine answers stay on the device when Nano is available; cloud calls happen only for the features listed in §3, and only when the user asks for them.
- No accounts, no tracking, no analytics. Schedule state lives in the browser's localStorage only.
- App Check debug token (if one is ever generated) is **never committed** — it lives only in the local browser + Firebase console.

---

## 7. What the submission text will say (draft)

> Daily Meds Helper is a voice-first medication companion for an older adult with poor eyesight. She asks "Did I take my morning pills?" and gets a spoken answer in large type. Routine questions are answered **on her device by Gemini Nano** through Firebase AI Logic's hybrid inference (`PREFER_ON_DEVICE`), so they work with no internet, keep her health routine private, and cost nothing. Harder jobs — reading a prescription label from a photo, explaining what a pill is for, and the weekly family summary — go to the **cloud model** (`ONLY_IN_CLOUD`), where accuracy and breadth matter more than offline access. Every answer shows whether it came from the device or the cloud. Firebase AI Logic is imported from `firebase/ai` and called at runtime in `src/ai.js`; App Check protects the cloud calls, with a debug token for local development. Demo data only — no real medical information.

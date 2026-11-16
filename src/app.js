// Daily Meds Helper — UI wiring.
// ---------------------------------------------------------------------------
// Flow for every question:
//   1. Show + speak the DETERMINISTIC answer instantly (plain code, always
//      correct, works with no AI and no network).
//   2. If Firebase AI Logic is configured, ask the routine model too and
//      replace the phrasing with the AI answer, showing whether it came
//      from the device (ON_DEVICE) or the cloud (IN_CLOUD).
// The app never has nothing to say.
// ---------------------------------------------------------------------------

import { initFirebase, enableOnDevice, getState } from "./firebase.js";
import { isConfigured } from "./config.js";
import { DEMO_PERSON, SCHEDULE } from "./demo-data.js";
import {
  isTaken,
  markTaken,
  answerDidITake,
  answerWhatsNext,
  answerEveningTime,
  refillWarnings,
  getScheduleState,
} from "./schedule.js";
import { askRoutine, askCloud, explainMedicine, readLabel } from "./ai.js";
import { speak, listenOnce, speechSupported } from "./speech.js";

const $ = (id) => document.getElementById(id);

const els = {
  status: $("ai-status"),
  enableDevice: $("enable-device"),
  deviceProgress: $("device-progress"),
  schedule: $("schedule"),
  answer: $("answer"),
  answerSource: $("answer-source"),
  refill: $("refill-warnings"),
  labelInput: $("label-photo"),
  labelResult: $("label-result"),
  summary: $("summary"),
};

function sourceLabel(source) {
  switch (source) {
    case "ON_DEVICE":
      return "Answered on your device — no internet needed.";
    case "IN_CLOUD":
      return "Answered in the cloud.";
    case "FALLBACK":
      return "Answered from your schedule (AI was unavailable).";
    case "NO_AI":
      return "Answered from your schedule. Add your Firebase config to enable AI answers.";
    default:
      return "";
  }
}

function showAnswer(text, source) {
  els.answer.textContent = text;
  els.answerSource.textContent = sourceLabel(source);
  speak(text);
}

// Show a real AI failure in the status line so a failed call is never
// silent. The next successful AI answer (via updateStatus()) restores the
// normal status. The schedule answer above still stands.
function noteAiError(message) {
  els.status.textContent =
    "AI call failed: " + message + " — the schedule answer above still stands. Tap a question to try again.";
}

function renderSchedule() {
  els.schedule.innerHTML = "";
  for (const group of getScheduleState()) {
    const card = document.createElement("section");
    card.className = "dose-card" + (group.taken ? " taken" : "");
    const meds = group.meds
      .map((m) => `<li><strong>${m.name} ${m.strength}</strong> — ${m.amount}</li>`)
      .join("");
    card.innerHTML = `
      <h2>${group.label} — ${group.time}</h2>
      <ul>${meds}</ul>
      <p class="state">${group.taken ? "✓ Taken" : "Not yet taken"}</p>
      <button class="big-btn secondary" data-taken="${group.id}">
        ${group.taken ? "Undo — I haven't taken them" : "I took them"}
      </button>
      <button class="big-btn ghost" data-explain="${group.id}">What are these for?</button>
    `;
    els.schedule.appendChild(card);
  }
  document.querySelectorAll("[data-taken]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const groupId = btn.getAttribute("data-taken");
      markTaken(groupId, !isTaken(groupId));
      renderSchedule();
      renderRefills();
      const group = SCHEDULE[groupId];
      const msg = isTaken(groupId)
        ? `Done. Your ${group.label.toLowerCase()} are marked taken.`
        : `Okay, your ${group.label.toLowerCase()} are marked not taken.`;
      showAnswer(msg, "NO_AI");
    })
  );
  document.querySelectorAll("[data-explain]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const group = SCHEDULE[btn.getAttribute("data-explain")];
      const med = group.meds[0];
      try {
        const { text, source } = await explainMedicine(med.name, med.strength);
        showAnswer(text, source);
      } catch (err) {
        // Keep the spoken answer plain (no technical error read aloud);
        // the real error goes in the source line below it and the status line.
        showAnswer(
          "I can't look that up right now. Please ask your pharmacist what " +
            `${med.name} is for.`,
          "FALLBACK"
        );
        els.answerSource.textContent += " AI error: " + (err.message || err);
        noteAiError(err.message || String(err));
      }
    })
  );
}

function renderRefills() {
  const warnings = refillWarnings();
  els.refill.innerHTML = warnings.length
    ? `<h2>Refills</h2><ul>${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>`
    : "";
}

async function askQuestion(kind) {
  let plain = "";
  let question = "";
  if (kind === "morning") {
    plain = answerDidITake("morning");
    question = "Did I take my morning pills?";
  } else if (kind === "next") {
    plain = answerWhatsNext();
    question = "What's next?";
  } else if (kind === "evening") {
    plain = answerEveningTime();
    question = "What time is my evening dose?";
  }
  // 1. Instant, always-correct answer.
  showAnswer(plain, "NO_AI");
  // 2. AI phrasing on top, when configured. On failure the schedule answer
  // stands, but the real error is shown (source line + status line) instead
  // of a silent fallback.
  if (isConfigured && getState().routineModel) {
    const { text, source, error } = await askRoutine(question, plain);
    if (text && text !== plain) {
      showAnswer(text, source);
      updateStatus();
    } else {
      els.answerSource.textContent =
        sourceLabel(source) + (error ? " AI error: " + error : "");
      if (error) noteAiError(error);
    }
  }
}

function routeSpoken(text) {
  const t = text.toLowerCase();
  if (t.includes("morning")) return askQuestion("morning");
  if (t.includes("evening") || t.includes("night")) return askQuestion("evening");
  if (t.includes("next") || t.includes("what") && t.includes("take")) return askQuestion("next");
  showAnswer(
    "I can answer three things: did I take my morning pills, what's next, or what time is my evening dose. Please tap one of the big buttons.",
    "NO_AI"
  );
  return Promise.resolve();
}

function updateStatus() {
  const s = getState();
  if (s.status === "not-configured") {
    els.status.textContent =
      "Demo mode — AI is not connected yet. Add your Firebase config in src/config.js (see README.md). The schedule and answers below still work.";
    els.enableDevice.disabled = true;
  } else if (s.status === "ready") {
    els.status.textContent =
      "AI connected (cloud ready). Tap “Enable on-device AI” to download Gemini Nano for offline answers.";
    els.enableDevice.disabled = false;
  } else if (s.status === "on-device-ready") {
    els.status.textContent = "On-device AI ready — routine questions can be answered with no internet.";
    els.enableDevice.disabled = true;
  } else if (s.status === "error") {
    els.status.textContent = "AI setup had a problem: " + s.detail;
    els.enableDevice.disabled = true;
  }
}

function init() {
  document.getElementById("person").textContent =
    `${DEMO_PERSON.name}, ${DEMO_PERSON.age} — demo data, fictional person`;
  renderSchedule();
  renderRefills();

  initFirebase();
  updateStatus();

  els.enableDevice.addEventListener("click", async () => {
    els.enableDevice.disabled = true;
    els.deviceProgress.textContent = "Starting download…";
    try {
      await enableOnDevice((val) => {
        els.deviceProgress.textContent = `Downloading on-device model: ${Math.round(val * 100)}%`;
      });
      els.deviceProgress.textContent = "On-device model ready.";
      updateStatus();
    } catch (err) {
      els.deviceProgress.textContent =
        "On-device AI is not available: " + (err && err.message ? err.message : err);
      els.enableDevice.disabled = false;
    }
  });

  document.querySelectorAll("[data-ask]").forEach((btn) =>
    btn.addEventListener("click", () => askQuestion(btn.getAttribute("data-ask")))
  );

  const micBtn = $("mic-btn");
  const speech = speechSupported();
  if (!speech.listen) {
    micBtn.disabled = true;
    micBtn.textContent = "🎤 Voice input not available — use the buttons";
  }
  micBtn.addEventListener("click", async () => {
    micBtn.disabled = true;
    micBtn.textContent = "🎤 Listening… speak now";
    try {
      const heard = await listenOnce();
      showAnswer(`You said: "${heard}"`, "NO_AI");
      await routeSpoken(heard);
    } catch (err) {
      showAnswer(err.message, "NO_AI");
    } finally {
      micBtn.disabled = false;
      micBtn.textContent = "🎤 Ask by voice";
    }
  });

  els.labelInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    els.labelResult.textContent = "Reading the label…";
    try {
      const { data, raw } = await readLabel(file);
      if (data && data.medicine) {
        els.labelResult.innerHTML =
          `<p><strong>Label read:</strong> ${data.medicine} ${data.strength || ""}<br>` +
          `Directions: ${data.directions || "not clear"}<br>` +
          `Quantity: ${data.quantity || "not clear"}</p>` +
          `<p>Please check this matches the bottle before adding it to the schedule.</p>`;
      } else {
        els.labelResult.textContent =
          "I couldn't read that label clearly. The photo text was: " + raw;
      }
    } catch (err) {
      els.labelResult.textContent = "Label reading needs the cloud AI: " + err.message;
    }
  });

  $("summary-btn").addEventListener("click", async () => {
    els.summary.textContent = "Writing the weekly summary…";
    try {
      const prompt =
        `Write a short weekly summary for the family of an older adult taking daily medicines. ` +
        `Demo week: morning pills taken 6 of 7 days, evening pills taken 7 of 7 days. ` +
        `Atorvastatin has about 9 doses left. Keep it to four short sentences, plain language, kind tone.`;
      const { text, source } = await askCloud(prompt);
      els.summary.textContent = text;
      showAnswer(text, source);
      updateStatus();
    } catch (err) {
      // Do NOT restore the static line silently: show the real failure so
      // a dead cloud call is visible instead of looking like nothing happened.
      els.summary.textContent =
        "The weekly summary needs the cloud AI, and the cloud call failed: " +
        (err.message || err) +
        " Demo week: morning pills taken 6 of 7 days, evening pills taken 7 of 7 days. Atorvastatin has about 9 doses left.";
      noteAiError(err.message || String(err));
    }
  });
}

init();

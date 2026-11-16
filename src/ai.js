// Daily Meds Helper — the AI call path.
// ---------------------------------------------------------------------------
// Two real Firebase AI Logic models (created in firebase.js):
//   routineModel — PREFER_ON_DEVICE: everyday questions, Nano first.
//   cloudModel   — ONLY_IN_CLOUD: label reading, explanations, summaries.
// Every answer reports response.inferenceSource ("ON_DEVICE" / "IN_CLOUD")
// so the hybrid behaviour is visible in the UI and in the demo video.
// ---------------------------------------------------------------------------

import { getState } from "./firebase.js";
import { SCHEDULE } from "./demo-data.js";

function scheduleContext() {
  const lines = [];
  for (const group of [SCHEDULE.morning, SCHEDULE.evening]) {
    const meds = group.meds.map((m) => `${m.name} ${m.strength}`).join(", ");
    lines.push(`${group.label} at ${group.time}: ${meds}.`);
  }
  return lines.join("\n");
}

/** One-line summary of an SDK error (message + code + HTTP status when present). */
export function errorMessage(err) {
  if (!err) return "Unknown error";
  const code = err.code ? `[${err.code}] ` : "";
  const status =
    (err.customData && err.customData.status) ||
    (err.customErrorData && err.customErrorData.status);
  const statusText = status ? ` (HTTP ${status})` : "";
  return `${code}${err.message || String(err)}${statusText}`;
}

/** Ask a routine question. Falls back to `fallbackText` if AI is unavailable.
 * The `error` field carries the real failure so the UI can show it instead
 * of failing silently. */
export async function askRoutine(question, fallbackText) {
  const { routineModel } = getState();
  if (!routineModel) return { text: fallbackText, source: "NO_AI", usedAI: false, error: "" };

  const prompt = `Today's medicine schedule:\n${scheduleContext()}\n\nQuestion: ${question}\nAnswer in one or two short sentences.`;
  try {
    const result = await routineModel.generateContent(prompt);
    return {
      text: result.response.text().trim(),
      source: result.response.inferenceSource || "UNKNOWN",
      usedAI: true,
      error: "",
    };
  } catch (err) {
    console.warn("Routine AI call failed, using plain answer:", err);
    return { text: fallbackText, source: "FALLBACK", usedAI: false, error: errorMessage(err) };
  }
}

/** Ask the cloud model a general question. */
export async function askCloud(question) {
  const { cloudModel } = getState();
  if (!cloudModel) throw new Error("Firebase is not configured yet.");
  const result = await cloudModel.generateContent(question);
  return {
    text: result.response.text().trim(),
    source: result.response.inferenceSource || "IN_CLOUD",
    usedAI: true,
  };
}

/** Explain what a medicine is for (general info only, never advice). */
export async function explainMedicine(name, strength) {
  const { cloudModel } = getState();
  if (!cloudModel) throw new Error("Firebase is not configured yet.");
  const prompt =
    `In two or three short, plain sentences, what is ${name} ${strength} usually used for? ` +
    `Say only general information. Do not suggest doses or changes. ` +
    `End with exactly: "This is general information, not medical advice."`;
  const result = await cloudModel.generateContent(prompt);
  return {
    text: result.response.text().trim(),
    source: result.response.inferenceSource || "IN_CLOUD",
    usedAI: true,
  };
}

/** Read a prescription label from a photo (JPEG/PNG). Returns parsed JSON or raw text. */
export async function readLabel(file) {
  const { cloudModel } = getState();
  if (!cloudModel) throw new Error("Firebase is not configured yet.");
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    throw new Error("Please use a JPEG or PNG photo of the label.");
  }
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const prompt =
    `Read this prescription bottle label. Reply with JSON only, no other text: ` +
    `{"medicine": "", "strength": "", "directions": "", "quantity": "", "refills": ""}. ` +
    `Use "" for anything you cannot read clearly. Do not guess.`;
  const result = await cloudModel.generateContent([
    prompt,
    { type: "inlineData", inlineData: { data: base64, mimeType: file.type } },
  ]);
  const raw = result.response.text().trim();
  try {
    return { data: JSON.parse(raw), raw, source: result.response.inferenceSource || "IN_CLOUD" };
  } catch {
    return { data: null, raw, source: result.response.inferenceSource || "IN_CLOUD" };
  }
}

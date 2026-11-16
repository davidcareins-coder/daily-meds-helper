// Daily Meds Helper — schedule state + deterministic answers.
// ---------------------------------------------------------------------------
// The three routine questions are answered by PLAIN CODE from the schedule,
// so the app always has a correct answer even with no AI, no network, and
// no on-device model. The AI (ai.js) provides the natural spoken phrasing;
// this file is the safety net underneath it.
// ---------------------------------------------------------------------------

import { SCHEDULE, DOSE_GROUPS, REFILL_WARN_AT_DOSES_LEFT } from "./demo-data.js";

const STORAGE_PREFIX = "dmh-taken-";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadTaken() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + todayKey()) || "{}");
  } catch {
    return {};
  }
}

function saveTaken(state) {
  localStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(state));
}

export function isTaken(groupId) {
  return !!loadTaken()[groupId];
}

export function markTaken(groupId, taken = true) {
  const state = loadTaken();
  state[groupId] = taken;
  saveTaken(state);
  return state;
}

function medsList(group) {
  return group.meds.map((m) => `${m.name} ${m.strength}`).join(", ");
}

function groupStatus(group) {
  return isTaken(group.id) ? "taken" : "not yet taken";
}

/** "Did I take my morning pills?" — deterministic answer. */
export function answerDidITake(groupId) {
  const group = SCHEDULE[groupId];
  if (!group) return "I don't know that dose time.";
  if (isTaken(group.id)) {
    return `Yes. You took your ${group.label.toLowerCase()} at ${group.time}: ${medsList(group)}.`;
  }
  return `Not yet. Your ${group.label.toLowerCase()} at ${group.time} are ${medsList(group)}. They are not taken yet.`;
}

/** "What's next?" — deterministic answer based on time of day + taken state. */
export function answerWhatsNext(now = new Date()) {
  const hour = now.getHours();
  const morningDone = isTaken("morning");
  const eveningDone = isTaken("evening");

  if (!morningDone && hour < 12) {
    return `Your morning pills at ${SCHEDULE.morning.time}: ${medsList(SCHEDULE.morning)}. They are not taken yet.`;
  }
  if (!morningDone && hour < 20) {
    return `Your morning pills at ${SCHEDULE.morning.time} are still not taken. Your evening pills are at ${SCHEDULE.evening.time}.`;
  }
  if (!eveningDone) {
    return `Next is your evening pills at ${SCHEDULE.evening.time}: ${medsList(SCHEDULE.evening)}.`;
  }
  return "All of today's pills are taken. Well done. Your next dose is tomorrow morning.";
}

/** "What time is my evening dose?" — deterministic answer. */
export function answerEveningTime() {
  return `Your evening pills are at ${SCHEDULE.evening.time}: ${medsList(SCHEDULE.evening)}. They are ${groupStatus(SCHEDULE.evening)}.`;
}

/** Refill warnings, from the demo doses-left counts. */
export function refillWarnings() {
  const warnings = [];
  for (const group of DOSE_GROUPS) {
    for (const med of group.meds) {
      if (med.dosesLeft <= REFILL_WARN_AT_DOSES_LEFT) {
        warnings.push(
          `${med.name} ${med.strength}: about ${med.dosesLeft} doses left. Time to ask about a refill soon.`
        );
      }
    }
  }
  return warnings;
}

export function getScheduleState() {
  return DOSE_GROUPS.map((g) => ({
    ...g,
    taken: isTaken(g.id),
  }));
}

// Daily Meds Helper — DEMO DATA ONLY.
// ---------------------------------------------------------------------------
// Fictional person, fictional medicines. No real medical data, no real
// prescriptions, no real names, no PII anywhere in this repo.
// The app is a demo: it never gives medical advice and never changes a dose.
// ---------------------------------------------------------------------------

export const DEMO_PERSON = {
  name: "Rose",
  age: 78,
  note: "Demo data — fictional person",
};

export const REFILL_WARN_AT_DOSES_LEFT = 7;

export const SCHEDULE = {
  morning: {
    id: "morning",
    label: "Morning pills",
    time: "8:00 AM",
    time24: "08:00",
    meds: [
      { name: "Lisinopril", strength: "10 mg", amount: "1 tablet", dosesLeft: 12, purpose: "blood pressure" },
      { name: "Metformin", strength: "500 mg", amount: "1 tablet", dosesLeft: 26, purpose: "blood sugar" },
      { name: "Vitamin D", strength: "1000 IU", amount: "1 tablet", dosesLeft: 30, purpose: "bone health" },
    ],
  },
  evening: {
    id: "evening",
    label: "Evening pills",
    time: "8:00 PM",
    time24: "20:00",
    meds: [
      { name: "Atorvastatin", strength: "20 mg", amount: "1 tablet", dosesLeft: 9, purpose: "cholesterol" },
      { name: "Metformin", strength: "500 mg", amount: "1 tablet", dosesLeft: 26, purpose: "blood sugar" },
    ],
  },
};

export const DOSE_GROUPS = [SCHEDULE.morning, SCHEDULE.evening];

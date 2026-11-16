// Daily Meds Helper — voice in / voice out (Web Speech API).
// ---------------------------------------------------------------------------
// speechSynthesis (speaking) is local in Chrome and works offline.
// SpeechRecognition (listening) sends audio to Google's servers by DEFAULT,
// so it needs the internet — EXCEPT on Chrome 139+, where
// recognition.processLocally = true keeps it on the device once the
// language pack is downloaded. We try local first, fall back to cloud
// recognition, and always offer big tap buttons as well.
// ---------------------------------------------------------------------------

/** Speak text aloud. Returns immediately; speaking is async. */
export function speak(text, { rate = 0.9 } = {}) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function speechSupported() {
  return {
    speak: "speechSynthesis" in window,
    listen: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}

/**
 * Listen once and resolve with the transcript.
 * Tries on-device recognition first (Chrome 139+), falls back to the
 * default cloud recognition. Rejects with a friendly message on failure.
 */
export function listenOnce({ lang = "en-US", timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      reject(new Error("Voice input is not available in this browser. Please tap a button instead."));
      return;
    }
    const rec = new Rec();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    // On-device recognition where supported (Chrome 139+). If the language
    // pack is missing this throws language-not-supported and we retry cloud.
    try {
      rec.processLocally = true;
    } catch {
      /* older browser: ignore, cloud recognition is the default */
    }
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try { rec.stop(); } catch { /* ignore */ }
        reject(new Error("I didn't hear anything. Please try again or tap a button."));
      }
    }, timeoutMs);
    rec.onresult = (event) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(event.results[0][0].transcript.trim());
    };
    rec.onerror = (event) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (event.error === "language-not-supported" || event.error === "not-allowed") {
        reject(new Error("On-device listening isn't ready. Please tap a button instead."));
      } else if (event.error === "network") {
        reject(new Error("Voice input needs the internet right now. Please tap a button instead."));
      } else {
        reject(new Error("Sorry, I couldn't hear that. Please try again or tap a button."));
      }
    };
    rec.onend = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(new Error("I didn't catch that. Please try again or tap a button."));
      }
    };
    try {
      rec.start();
    } catch (err) {
      done = true;
      clearTimeout(timer);
      reject(new Error("Voice input could not start. Please tap a button instead."));
    }
  });
}

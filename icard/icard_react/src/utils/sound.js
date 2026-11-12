/** Short tones made by the browser (Web Audio): no audio files to ship or license. */
export const CHIME = {
  HALL: "hall",
  KITCHEN: "kitchen",
};

const TONES = {
  [CHIME.HALL]: [{ frequency: 880, start: 0, duration: 0.3 }],
  [CHIME.KITCHEN]: [
    { frequency: 660, start: 0, duration: 0.18 },
    { frequency: 990, start: 0.22, duration: 0.28 },
  ],
};

const PEAK_GAIN = 0.3;
const SILENT_GAIN = 0.0001;
const ATTACK_SECONDS = 0.02;

let sharedContext = null;

function audioContext() {
  if (sharedContext) return sharedContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  sharedContext = new AudioContextClass();
  return sharedContext;
}

function playTone(context, { frequency, start, duration }) {
  const startAt = context.currentTime + start;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(SILENT_GAIN, startAt);
  gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, startAt + ATTACK_SECONDS);
  gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

/**
 * Plays the chime of that kind. Returns false when the browser has no Web Audio or refuses to
 * play (it blocks sound until the page has been touched once); never throws.
 */
export function playChime(kind) {
  try {
    const context = audioContext();
    if (!context) return false;
    if (context.state === "suspended") context.resume().catch(() => {});
    (TONES[kind] ?? TONES[CHIME.HALL]).forEach((tone) => playTone(context, tone));
    return true;
  } catch {
    return false;
  }
}

/** Only for tests: forget the shared audio context. */
export function resetChimeForTests() {
  sharedContext = null;
}

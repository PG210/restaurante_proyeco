import { CHIME, playChime, resetChimeForTests } from "../sound";

function fakeAudioContext() {
  const oscillators = [];
  const param = () => ({ setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() });
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.state = "running";
      this.destination = {};
    }

    createOscillator() {
      const oscillator = { frequency: param(), connect: jest.fn(), start: jest.fn(), stop: jest.fn() };
      oscillators.push(oscillator);
      return oscillator;
    }

    createGain() {
      return { gain: param(), connect: jest.fn() };
    }
  }
  return { FakeAudioContext, oscillators };
}

describe("playChime", () => {
  const originalAudioContext = window.AudioContext;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    resetChimeForTests();
  });

  it("plays one tone for the hall and two for the kitchen", () => {
    const { FakeAudioContext, oscillators } = fakeAudioContext();
    window.AudioContext = FakeAudioContext;

    expect(playChime(CHIME.HALL)).toBe(true);
    expect(oscillators).toHaveLength(1);
    expect(playChime(CHIME.KITCHEN)).toBe(true);
    expect(oscillators).toHaveLength(3);
    oscillators.forEach((oscillator) => expect(oscillator.start).toHaveBeenCalled());
  });

  it("does nothing when the browser has no Web Audio", () => {
    window.AudioContext = undefined;

    expect(playChime(CHIME.HALL)).toBe(false);
  });

  it("never throws when the browser refuses to play", () => {
    window.AudioContext = function BrokenAudioContext() {
      throw new Error("not allowed");
    };

    expect(playChime(CHIME.KITCHEN)).toBe(false);
  });
});

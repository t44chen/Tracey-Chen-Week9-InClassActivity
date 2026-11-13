/* Tracks the demo's lifecycle and whether its latest scores are still current.
   It does not open the camera, load the model, or draw the interface. */
const ExperienceState = {
  // mode is one of: stopped, loading, live, or design.
  mode: "stopped",
  // Incremented when a run ends; async work checks its saved token before acting.
  sessionToken: 0,
  rawScores: {},
  lastScoreAt: 0,
  inferenceStartedAt: 0,

  // Start a new loading attempt and invalidate any previous pending work.
  beginLoading() {
    this.stop();
    this.mode = "loading";
    return this.sessionToken;
  },

  // Protect against an old model load or camera permission completing late.
  isCurrentSession(token) {
    return token === this.sessionToken;
  },

  // Move from loading to live only if this is still the active session.
  markInferenceLive(token) {
    if (!this.isCurrentSession(token) || this.mode !== "loading") return false;
    this.mode = "live";
    this.inferenceStartedAt = performance.now();
    return true;
  },

  // Design mode uses manually supplied scores and never starts the webcam.
  beginDesignTest() {
    this.stop();
    this.mode = "design";
  },

  // Keep the latest raw values and timestamp so the UI can identify stale scores.
  recordScores(scores) {
    this.rawScores = { ...scores };
    this.lastScoreAt = performance.now();
  },

  // Design values remain available; live scores expire after a short pause in
  // inference so the display does not imply a prediction is still current.
  hasRecentScores() {
    return this.mode === "design" ||
      (this.mode === "live" && this.lastScoreAt > 0 &&
        performance.now() - this.lastScoreAt < 4000);
  },

  // Invalidate async work and clear the information associated with this run.
  stop() {
    this.sessionToken++;
    this.mode = "stopped";
    this.rawScores = {};
    this.lastScoreAt = 0;
    this.inferenceStartedAt = 0;
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ExperienceState;
}

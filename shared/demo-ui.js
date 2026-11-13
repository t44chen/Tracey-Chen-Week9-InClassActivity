/* DOM controls and p5 display helpers. No camera, model, or lifecycle logic. */
const DemoUI = {
  // Connect page buttons to actions supplied by the sketch. Design controls
  // are optional, so Example 1 can omit them while Example 2 includes them.
  initialize(classLabels, actions) {
    document.querySelector("#start").onclick = () => {
      this.setStartEnabled(false);
      const designControls = document.querySelector("#design-controls");
      if (designControls) designControls.hidden = true;
      this.setStatusMessage("Loading model. Allow camera access when requested.");
      actions.onStart();
    };
    document.querySelector("#stop").onclick = () => {
      actions.onStop();
      this.setStartEnabled(true);
      const designControls = document.querySelector("#design-controls");
      if (designControls) designControls.hidden = true;
    };
    const controls = document.querySelector("#design-controls");
    const designButton = document.querySelector("#design");
    if (controls) controls.replaceChildren();
    if (controls && designButton && actions.onStartDesignTest) {
      designButton.onclick = () => {
        actions.onStartDesignTest();
        this.setStartEnabled(true);
        controls.hidden = false;
        this.provideDesignTestScores(classLabels, actions.onScores);
      };
      for (const label of classLabels) {
        const button = document.createElement("button");
        button.textContent = `100% ${label}`;
        button.onclick = () => this.provideDesignTestScores(
          classLabels, actions.onScores, { [label]: 1 },
        );
        controls.append(button);
      }
      const mixButton = document.createElement("button");
      mixButton.textContent = "Mixed scores";
      mixButton.onclick = () => this.provideDesignTestScores(
        classLabels, actions.onScores,
        Object.fromEntries(classLabels.map(label => [label, 1])),
      );
      controls.append(mixButton);
    } else if (controls) {
      controls.hidden = true;
    }
    this.setStatusMessage(
      controls && designButton && actions.onStartDesignTest
        ? "Ready. Start webcam inference, or choose the labelled design test."
        : "Ready. Start webcam inference.",
    );
  },

  // Provide deliberately synthetic scores for visual prototyping only. The
  // `true` flag tells the receiver to apply these requested weights immediately.
  provideDesignTestScores(classLabels, onScores, requestedScores) {
    const selectedScores = requestedScores ||
      Object.fromEntries(classLabels.map(label => [label, 1 / classLabels.length]));
    const scores = Object.fromEntries(
      classLabels.map(label => [label, selectedScores[label] || 0]),
    );
    onScores(scores, true);
    this.setStatusMessage("DESIGN TEST ONLY: manually supplied scores. No webcam and no model inference.");
  },

  // Update the visible live-region message so screen readers announce status.
  setStatusMessage(message) {
    document.querySelector("#status").textContent = message;
  },

  // Prevent starting a second model/camera setup while one is already loading.
  setStartEnabled(enabled) {
    document.querySelector("#start").disabled = !enabled;
  },

  // Restore usable controls and show a useful error when setup or inference fails.
  resetAfterError(error) {
    console.error(error);
    this.setStartEnabled(true);
    const designControls = document.querySelector("#design-controls");
    if (designControls) designControls.hidden = true;
    this.setStatusMessage(`Cannot run: ${error.message || error}`);
  },

  // Draw either the actual input frame or a message explaining why it is absent.
  drawCameraPreview(camera, state, x, y, size) {
    push();
    noStroke();
    fill(234, 236, 231);
    rect(x, y, size, size);
    if (state.mode === "live" && camera.frame) {
      image(camera.frame, x, y, size, size);
    } else {
      fill(65);
      textSize(18);
      textAlign(CENTER, CENTER);
      text(state.mode === "design" ? "Design test\nNo camera input" : "Camera not running",
        x + size / 2, y + size / 2);
    }
    pop();
  },

  // Show raw model/test scores, not the normalized weights used by the agent.
  // This distinction lets students compare model output with authored response.
  drawClassScoreBars(state, x, y, width, classLabels) {
    push();
    textSize(18);
    textAlign(LEFT, BASELINE);
    noStroke();
    classLabels.forEach((label, index) => {
      const row = y + index * 48;
      const score = state.rawScores[label];
      fill(35);
      text(label, x, row);
      textAlign(RIGHT, BASELINE);
      text(state.hasRecentScores() && Number.isFinite(score) ? `${(score * 100).toFixed(1)}%` : "--",
        x + width, row);
      textAlign(LEFT, BASELINE);
      fill(226, 230, 224);
      rect(x, row + 8, width, 8);
      fill(45, 85, 70);
      rect(x, row + 8, width * (state.hasRecentScores() ? (score || 0) : 0), 8);
    });
    pop();
    if (state.mode === "live" && !state.hasRecentScores() &&
        performance.now() - (state.lastScoreAt || state.inferenceStartedAt) > 4000) {
      this.setStatusMessage("No recent prediction. The agent is paused; check camera access and the browser console.");
    }
  },
};

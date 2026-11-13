// EXAMPLE 2: the same classifier as Example 1, now connected to a character.
// The classifier produces class scores. The mappings below are our design
// choices for turning those scores into a visual character; they are not
// measurements of anyone's actual emotions.

const MODEL_URL = new URL("../model/model.json", document.baseURI).href;

// Each class label gets an authored visual profile: one colour and one outline.
// The keys must match the labels in the trained model exactly.
// Extension: a sixth label needs a genuinely retrained six-class model too;
// adding a visual mapping cannot make a model recognize a class it never learned.
const EMOTIONS = {
  happy: { color: [255, 215, 0], shape: "circle" },
  sad: { color: [45, 100, 225], shape: "square" },
  calm: { color: [45, 170, 85], shape: "triangle" },
  anxious: { color: [245, 140, 35], shape: "pentagon" },
  angry: { color: [225, 45, 45], shape: "spiky" },
  disgust: { color: [145, 75, 170], shape: "hexagon" },
};

// Movement is authored per class, like colour and shape. Each amount controls
// the size of that movement; a larger pace makes it happen faster. Bounce
// amounts are pixels, rotation amounts are radians, and size amounts are
// changes from the normal size of 1. Omit a movement a class should not affect.

const MOTION_PROFILES = {
  // HAPPY: lively hopping with a gentle side-to-side dance.
  happy: {
    sway: { amount: 16, pace: 2.0 },
    bounce: { amount: 18, pace: 3.2, phase: -Math.PI / 2 },
    size: { amount: 0.09, pace: 3.2 },
  },

  // SAD: heavy, hesitant, and slow; the character subtly shrinks and droops.
  sad: {
    sway: { amount: 3, pace: 0.45 },
    bounce: { amount: 7, pace: 0.45, phase: Math.PI / 2 },
    size: { amount: 0.045, pace: 0.45, phase: -Math.PI / 2 },
  },

  // CALM: smooth, unhurried floating and a tiny breathing-like size change.
  calm: {
    sway: { amount: 11, pace: 0.65 },
    bounce: { amount: 8, pace: 0.85 },
    size: { amount: 0.025, pace: 0.85 },
  },

  // ANXIOUS: small, quick, uneven-looking shakes with slight tilting.
  anxious: {
    sway: { amount: 12, pace: 9.2 },
    rotation: { amount: 0.085, pace: 7.3 },
    size: { amount: 0.025, pace: 10.5 },
  },

  // ANGRY: forceful rocking and a slower, pronounced expansion/contraction.
  angry: {
    rotation: { amount: 0.22, pace: 2.7 },
    bounce: { amount: 6, pace: 2.7, phase: Math.PI / 2 },
    size: { amount: 0.075, pace: 2.7, phase: Math.PI / 2 },
  },

  // DISGUST: hesitant rocking and recoil
  disgust: {
    sway: { amount: 5, pace: 1.35 },
    bounce: { amount: 12, pace: 1.7, phase: Math.PI / 2 },
    rotation: { amount: 0.12, pace: 1.1 },
    size: { amount: 0.04, pace: 2.5 },
  },
};

// Derive the label list from the profiles so interface controls and score
// handling stay in sync when a class is added or renamed.
const LABELS = Object.keys(EMOTIONS);

let classifier; // ml5 image classifier; used only to turn camera frames into scores.
let profiles = {}; // Point geometry and colour prepared for the reusable agent.
let agent; // Owns normalized/smoothed weights and the blended visual appearance.
let motionEnabled = true; // Pauses the motion clock without pausing classification.

function setup() {
  // p5 calls setup() once, then calls draw() repeatedly.
  createCanvas(1080, 760).parent("canvas-host");
  pixelDensity(1);
  textFont("sans-serif");

  // Convert each simple design choice above into a profile that can be blended.
  // AgentMath gives every outline the same number/order of points, allowing
  // corresponding points from two shapes to be interpolated.
  for (const label of LABELS) {
    profiles[label] = {
      color: EMOTIONS[label].color,
      points: AgentMath.outline(EMOTIONS[label].shape),
    };
  }

  // BlendedAgent is independent of p5 drawing and webcam details.
  agent = new BlendedAgent(profiles);

  CameraInput.initialize();

  // DemoUI wires buttons to these sketch functions. Both live inference and
  // design-test scores then travel through receiveScores().
  DemoUI.initialize(LABELS, {
    onStart: startExperience,
    onStop: stopExperience,
    onStartDesignTest: startDesignTest,
    onScores: receiveScores,
  });

  // Optional accessibility control for the motion activity.
  const pause = document.createElement("button");
  pause.textContent = "Pause behavioural motion";

  pause.onclick = () => {
    motionEnabled = !motionEnabled;
    pause.textContent = motionEnabled
      ? "Pause behavioural motion"
      : "Resume behavioural motion";
  };

  document.querySelector(".controls").append(pause);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    motionEnabled = false;
    pause.textContent = "Resume behavioural motion";
  }
}

async function startExperience() {
  CameraInput.release();

  // A session token makes a pending load or camera request safe to cancel.
  const token = ExperienceState.beginLoading();
  agent.clearScores();

  try {
    // The model helper checks the export/labels and waits for ml5 to be ready.
    classifier = await ClassifierModel.loadClassifier(MODEL_URL, LABELS);

    if (!ExperienceState.isCurrentSession(token)) return;

    if (
      !(await CameraInput.requestAccess(
        () =>
          ExperienceState.isCurrentSession(token) &&
          ExperienceState.mode === "loading",
      ))
    )
      return;

    if (!ExperienceState.markInferenceLive(token)) return;

    DemoUI.setStatusMessage("WEBCAM INFERENCE: live model scores.");

    // Begin a loop that awaits each prediction before requesting the next one.
    classifyNextFrame(token);
  } catch (error) {
    if (ExperienceState.isCurrentSession(token)) {
      handleExperienceError(error);
    }
  }
}

async function classifyNextFrame(token) {
  // Stop scheduling predictions as soon as the user stops or restarts.
  if (!isLiveSession(token)) return;

  try {
    // Capture and classify only the square camera frame shown at left.
    if (CameraInput.captureSquareFrame()) {
      const results = await classifier.classify(CameraInput.frame.canvas);

      if (!isLiveSession(token)) return;

      receiveScores(ClassifierModel.mapResultsToScores(results, LABELS), false);
    }

    // The delay limits processing load. This is sequential, not overlapping,
    // because this next call is scheduled only after classify() has completed.
    setTimeout(() => classifyNextFrame(token), 120);
  } catch (error) {
    if (isLiveSession(token)) handleExperienceError(error);
  }
}

function receiveScores(scores, designTest) {
  // `scores` is an object keyed by class label. Live scores are smoothed to
  // avoid jitter; manual design-test choices are applied immediately so the
  // person designing the installation can see their selected mix directly.

  ExperienceState.recordScores(scores);
  agent.setScores(scores, designTest);

  if (!designTest) {
    DemoUI.setStatusMessage(
      "WEBCAM INFERENCE: live model scores. The character uses these scores to determine its designed response.",
    );
  }
}

function isLiveSession(token) {
  // Keep the session check in one place so both the frame loop and its error
  // handler agree about when inference is allowed to continue.
  return (
    ExperienceState.isCurrentSession(token) && ExperienceState.mode === "live"
  );
}

function startDesignTest() {
  // Manual scores exercise the character design without camera access or
  // classifier output; the UI labels this mode clearly as a simulation.

  ExperienceState.beginDesignTest();
  CameraInput.release();
}

function stopExperience() {
  // Stop future inference callbacks and release the camera before clearing the
  // character's score history.

  ExperienceState.stop();
  CameraInput.release();
  agent.clearScores();
  DemoUI.setStatusMessage("Stopped. Camera released.");
}

function handleExperienceError(error) {
  // Treat setup and inference failures as a stopped session so the user can
  // retry, and avoid leaving the webcam active after an error.

  ExperienceState.stop();
  CameraInput.release();
  agent.clearScores();
  DemoUI.resetAfterError(error);
}

function draw() {
  // p5 redraws the canvas continuously. Camera, bars and character all use the
  // latest available data, but only recent predictions are treated as current.

  background(255);
  noStroke();
  fill(35);
  textSize(20);

  text("Square webcam input", 28, 38);
  DemoUI.drawCameraPreview(CameraInput, ExperienceState, 28, 56, 280);

  text("Raw class scores", 28, 375);
  DemoUI.drawClassScoreBars(ExperienceState, 28, 410, 280, LABELS);

  text("The character: blended shape and colour", 355, 38);

  fill(246, 247, 241);
  rect(340, 56, 712, 590, 8);

  // deltaTime is milliseconds between p5 frames; the reusable agent expects
  // seconds. It eases the weights toward the newest scores here.

  if (
    ExperienceState.hasRecentScores() &&
    agent.update(deltaTime / 1000, motionEnabled)
  ) {
    const appearance = agent.getAppearance();

    // Motion is a separate authored response to the smoothed class weights.
    const motion = getAgentMotion(agent.weights, agent.motionTime);

    drawAgent(appearance, motion);
  } else {
    // No default character is shown before a prediction, or after scores go stale.
    fill(90);
    textAlign(CENTER, CENTER);
    textSize(19);

    text("Waiting for recent scores\nNo default emotion is assumed", 696, 345);

    textAlign(LEFT, BASELINE);
  }

  drawLegend();
}

function drawAgent(appearance, motion) {
  // p5 transformations are applied in order: move, rotate, then scale.
  // The origin remains the character's centre, so local outline coordinates
  // can be reused regardless of its position or size.

  push();

  translate(
    696 + constrain(motion.x, -100, 100),
    345 + constrain(motion.y, -100, 100),
  );

  rotate(motion.angle);
  scale(constrain(motion.size, 0.65, 1.25));

  fill(...appearance.color);
  stroke(45);
  strokeWeight(2);

  beginShape();

  // The blended outline is a list of normalized coordinates around the origin.
  // Scale them to the character's design size when drawing each vertex.
  for (const point of appearance.points) {
    vertex(point.x * 138, point.y * 138);
  }

  endShape(CLOSE);
  pop();
}

// ==============================================================
// STARTER BEHAVIOUR: use this as a model for your own motion design.
// `w` contains a smoothed weight from 0 to 1 for every label; weights sum to 1.
// `t` is seconds of behavioural time and pauses when motion is disabled.
// Return x/y offsets in pixels, angle in radians, and a size multiplier.
//
// Each class contributes a different, restrained movement quality. These are
// authored metaphors, not behaviours the model learned or emotion facts.
// Try changing amplitudes, frequencies, or axes and observe the design test.
// ==============================================================

// Calculate one movement by adding each class's profile contribution.
// Its weight scales the amount; pace controls speed, and phase offsets timing.

function getMotionContribution(w, t, movementName) {
  let contribution = 0;

  for (const [label, profile] of Object.entries(MOTION_PROFILES)) {
    const movement = profile[movementName];

    if (!movement) continue;

    contribution +=
      w[label] *
      movement.amount *
      sin(t * movement.pace + (movement.phase || 0));
  }

  return contribution;
}

// Combine the movement channels and return them in the format drawAgent uses:
// sway and bounce become x/y offsets, rotation becomes an angle, and size
// adjusts the normal scale of 1.

function getAgentMotion(w, t) {
  const sway = getMotionContribution(w, t, "sway");
  const bounce = getMotionContribution(w, t, "bounce");
  const rotation = getMotionContribution(w, t, "rotation");
  const size = 1 + getMotionContribution(w, t, "size");

  return {
    x: sway,
    y: bounce,
    angle: rotation,
    size,
  };
}

function drawLegend() {
  // Keep the author's mappings visible; they are design choices, not model facts.

  push();
  textSize(16);
  noStroke();
  fill(55);

  text(
    "Authored mappings: happy / yellow circle; sad / blue square; calm / green triangle;",
    28,
    690,
  );

  text("anxious / orange pentagon; angry / red spiky shape.", 28, 716);

  if (LABELS.includes("disgust")) {
    text(
      "Disgust: see your added colour, outline and motion mapping.",
      28,
      743,
    );
  }

  pop();
}

# GBDA 414 Week 9: Enacting a machine agent

## Contents and setup

Two p5.js / ml5.js source examples with shared helpers organized by
responsibility. Exact library versions: p5.js 1.11.11; ml5.js 1.2.1 (CDN).
Internet is required for these libraries and the stylesheet's optional font.

One Python script that uses WikiMedia Commons API to batch download images
using keyword search. Pre-downloaded WikiMedia Commons images downloaded using
the script, sorted into folders, and used to train the Teachable Machine image
classifier model.

1. Extract the entire ZIP, not just an example folder.
2. Add your complete five-class TensorFlow.js export to the model/ folder.
3. Open the COMPLETE code-emotionalAgent/ folder in VS Code.
4. With Live Server, open index.html and choose an example.
5. Click Start webcam inference and permit camera access.
6. In Example 2, test Design test (no model) separately: its inputs are manually
   supplied scores and should not be presented as classification evidence.
7. Stop camera releases the media stream. Reload after editing code/model files.

Both examples refer to the shared root model/. If hosting on GitHub Pages, preserve
the entire folder tree. Library/model requests use the network. The source does not
record or upload camera frames; inference is performed in-browser.

## Example 1

Open example1-classifier/sketch.js. The model loading and classifier.classify()
calls are visible. The shared code is divided by responsibility:

| File                       | Responsibility                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------ |
| shared/camera-input.js     | Requests/releases camera access and prepares the square model input frame.           |
| shared/experience-state.js | Tracks loading, live inference, design-test, and stopped states.                     |
| shared/classifier-model.js | Checks model files and labels, loads the ml5 classifier, and maps results to labels. |
| shared/demo-ui.js          | Wires the page controls and draws the camera preview and class-score bars.           |

The sketches orchestrate these helpers, while keeping the `classifier.classify()`
call visible. Each result is mapped by label, not by its rank in the result
array. A sequential asynchronous prediction loop runs one inference at a time
and catches errors, rather than using classifyStart().

Each HTML file loads these scripts before sketch.js. Their order follows their
dependencies; Example 2 also loads agent.js before the sketch that uses it.

The score path is: camera frame -> classifier prediction -> labelled score
object -> ExperienceState and (in Example 2) BlendedAgent -> UI/character
rendering. The design test skips the camera and classifier and supplies example
scores directly, so it is useful for visual prototyping but cannot demonstrate
model performance.

## Example 2

The exact mappings are:

| Label   | RGB colour   | Outline         |
| ------- | ------------ | --------------- |
| happy   | 255, 215, 0  | circle          |
| sad     | 45, 100, 225 | square          |
| calm    | 45, 170, 85  | triangle        |
| anxious | 245, 140, 35 | pentagon        |
| angry   | 225, 45, 45  | red spiky shape |

Each profile has 120 points in matching angular order. Polygon points are
sampled on straight edges using ray intersections. The square is axis-aligned.
Each output point is the weighted sum of the corresponding profile points.
Each RGB channel is the weighted sum of the corresponding colour channels.
Weights are normalized. No threshold or winner-take-all selection is used.
Interpolation occurs in ordinary RGB, not a perceptually uniform colour space;
mixed colours may be muted. Shapes retain a shared angular correspondence,
not a shared count of polygon corners.

Raw scores remain visible. The character uses a time-based 0.22-second smoothing
constant. Smoothing is interface timing, not further model learning.
The supplied getAgentMotion() contains a simple score-responsive starter
behaviour for all five labels; students can modify it to explore different
movement metaphors. Shape morphing alone is not the motion activity. The pause
control freezes behavioural time, not new inference or shape/colour updates.
Reduced-motion preference starts that clock paused.

The character logic is together in shared/agent.js: `AgentMath` creates and
blends point-based profiles, while `BlendedAgent` accepts scores with
`setScores()`, smooths them with `update()`, and returns a blended appearance
with `getAppearance()`. The sketch decides how to draw the appearance and define
motion. Students can reuse the character with a different sensor, set of
profiles, or visual presentation without changing the model or camera helpers.

## Motion profiles

Example 2 defines each class's authored movement in `MOTION_PROFILES` in
example2-agent/sketch.js. Each class can contribute to sway (horizontal motion),
bounce (vertical motion), rotation, and size. The current profiles are:

| Class   | Movement contributions                                 |
| ------- | ------------------------------------------------------ |
| happy   | Wide, slower sway; small bounce and size change        |
| sad     | Slow bounce and small size change                      |
| calm    | Slow bounce                                            |
| anxious | Smaller, faster sway; quicker rotation and size change |
| angry   | Gentle rotation                                        |

Each movement has an `amount` that controls its size and a `pace` that controls
how quickly it repeats. `phase` offsets where it starts in that repeating cycle;
it is optional and defaults to zero. A class's current smoothed score scales its
contribution, and contributions from different classes are added together.
To change a class's movement, edit its values in `MOTION_PROFILES`; for example,
increase happy's bounce `amount` to make its bounce larger or its `pace` to make
it faster. These are design choices, not behaviors learned by the model or facts
about anyone's emotions.

## Sources and API references

- ml5 1.2.1 model readiness, result labels and classification:
  https://github.com/ml5js/ml5-next-gen/blob/v1.2.1/src/ImageClassifier/index.js
- Teachable Machine export and labels:
  https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image
- Point-based shapes:
  https://p5js.org/reference/p5/beginShape/
  https://p5js.org/reference/p5/vertex/
- Interpolation:
  https://p5js.org/reference/p5/lerp/

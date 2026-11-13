# Add the instructor's model here

This folder intentionally does NOT contain an invented or substitute model.
Copy the complete pretrained Teachable Machine TensorFlow.js export here:

- model.json
- metadata.json
- every weights file referenced in model.json (often weights.bin)

The five labels must be happy, sad, calm, anxious, angry. Label matching ignores
capitalization and surrounding spaces, but does not translate synonyms.

For the 100% extension, retrain with ALL six classes including disgust, replace
the complete export, and extend EMOTIONS in example2-agent/sketch.js.

Keep an untouched copy of the five-class base for your required-activity evidence.
Example 1 intentionally remains five-class.

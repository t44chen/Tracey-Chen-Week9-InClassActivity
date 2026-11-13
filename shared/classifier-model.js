/* Model-file validation and ml5 classifier setup.
   The example sketch keeps the classifier.classify() inference call visible. */
   
const ClassifierModel = {
  // Check that the model and metadata exist, that the label set is the expected
  // one, and that the model file has the required TensorFlow.js export fields.
  async validateFilesAndLabels(modelURL, expectedLabels) {
    const metadataURL = new URL("metadata.json", modelURL).href;
    const responses = await Promise.all([fetch(modelURL), fetch(metadataURL)]);
    if (responses.some(response => !response.ok)) {
      throw new Error("Model files missing. Put the complete instructor export in model/ at the project root.");
    }
    const [model, metadata] = await Promise.all(responses.map(response => response.json()));
    const actualLabels = (metadata.labels || []).map(label => String(label).trim().toLowerCase());
    if (actualLabels.length !== expectedLabels.length ||
        expectedLabels.some(label => !actualLabels.includes(label))) {
      throw new Error(
        `Model labels must be exactly: ${expectedLabels.join(", ")}. Found: ${actualLabels.join(", ") || "none"}.`,
      );
    }
    if (!model.modelTopology || !model.weightsManifest) {
      throw new Error("Invalid TensorFlow.js model export.");
    }
  },

  // Complete validation before asking ml5 to load the classifier. Awaiting
  // `ready` ensures the model is loaded before the sketch requests camera input.
  async loadClassifier(modelURL, expectedLabels) {
    await this.validateFilesAndLabels(modelURL, expectedLabels);
    const classifier = ml5.imageClassifier(modelURL);
    await classifier.ready;
    if (typeof classifier.model?.predict !== "function") {
      throw new Error("Model could not load. Check all weight files.");
    }
    return classifier;
  },

  // ml5 results are arrays; convert them to a stable label -> score object.
  // Do not assume array order stays constant between predictions.
  mapResultsToScores(results, expectedLabels) {
    if (!Array.isArray(results) || results.length !== expectedLabels.length) {
      throw new Error("Missing class scores.");
    }
    const scores = {};
    for (const result of results) {
      const label = String(result.label).trim().toLowerCase();
      if (!expectedLabels.includes(label) || label in scores) {
        throw new Error(`Unexpected result label: ${label}`);
      }
      scores[label] = result.confidence;
    }
    for (const label of expectedLabels) {
      if (!Number.isFinite(scores[label]) || scores[label] < 0) {
        throw new Error("Invalid model confidence.");
      }
    }
    return scores;
  },
};

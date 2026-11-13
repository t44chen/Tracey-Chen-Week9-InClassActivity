/* Camera access and square frame preparation for model input. */
const CameraInput = {
  video: null,
  stream: null,
  frame: null,

  // Create the fixed-size image that will be shown and sent to the classifier.
  initialize() {
    this.frame = createGraphics(224, 224);
    this.frame.pixelDensity(1);
  },

  // Ask the browser for permission. The callback checks whether the user has
  // cancelled/restarted while the permission prompt was open.
  async requestAccess(isRequestCurrent) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Use Live Server (localhost) or HTTPS for webcam access.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (!isRequestCurrent()) {
      stream.getTracks().forEach(track => track.stop());
      return false;
    }
    this.release();
    this.stream = stream;
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = stream;
    await this.video.play();
    return true;
  },

  // Crop the largest centred square from the camera image. Using one identical
  // crop for display and inference makes the visible input match the model input.
  captureSquareFrame() {
    if (!this.video || this.video.readyState < 2) return false;
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    const side = Math.min(width, height);
    if (!side) return false;
    this.frame.drawingContext.drawImage(
      this.video,
      (width - side) / 2, (height - side) / 2, side, side,
      0, 0, 224, 224,
    );
    return true;
  },

  // Stop every camera track and detach the video element so the camera is released.
  release() {
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.stream = null;
    this.video = null;
    this.frame?.clear();
  },
};

window.addEventListener("pagehide", () => CameraInput.release());

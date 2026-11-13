/* Character geometry, score blending, and reusable agent state.
   The class does not depend on p5 drawing or on a particular sensor. */
(function (root) {
  "use strict";
  const TAU = Math.PI * 2;
  // Every profile outline is sampled to this many points so matching indexes
  // represent matching directions when two shapes are blended.
  const POINT_COUNT = 120;

  // Make a regular polygon as normalized coordinates around the origin.
  function polygon(sides, radius = 1, rotation = -Math.PI / 2) {
    return Array.from({ length: sides }, (_, i) => ({
      x: Math.cos(rotation + (TAU * i) / sides) * radius,
      y: Math.sin(rotation + (TAU * i) / sides) * radius,
    }));
  }

  // Alternate outer and inner radii to create a star-shaped outline.
  function star(tips = 10, inner = 0.58) {
    return Array.from({ length: tips * 2 }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.PI * i) / tips;
      const radius = i % 2 === 0 ? 1 : inner;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }

  function cross(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  // Find where a ray from the origin meets the polygon boundary. Sampling
  // these distances around the shape keeps straight-edged polygons recognizable
  // while giving every shape a shared point count for interpolation.
  function rayRadius(vertices, angle) {
    const ray = { x: Math.cos(angle), y: Math.sin(angle) };
    let nearest = Infinity;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      const edge = { x: b.x - a.x, y: b.y - a.y };
      const denominator = cross(ray, edge);
      if (Math.abs(denominator) < 1e-10) continue;
      const distance = cross(a, edge) / denominator;
      const fraction = cross(a, ray) / denominator;
      if (distance > 0 && fraction >= -1e-8 && fraction <= 1 + 1e-8) {
        nearest = Math.min(nearest, distance);
      }
    }
    if (!Number.isFinite(nearest)) throw new Error("Outline must surround its centre.");
    return nearest;
  }

  // Return an outline in consistent angular order. Circles need no polygon
  // intersection; their radius is one in every direction.
  function outline(kind, count = POINT_COUNT) {
    const vertices =
      kind === "square"
        ? polygon(4, 1, -Math.PI / 4)
        : kind === "triangle"
          ? polygon(3)
          : kind === "pentagon"
            ? polygon(5)
            : kind === "spiky"
              ? star()
              : kind === "hexagon"
                ? polygon(6)
                : null;
    if (kind !== "circle" && !vertices) throw new Error(`Unknown shape: ${kind}`);
    return Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (TAU * i) / count;
      const radius = vertices ? rayRadius(vertices, angle) : 1;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }

  // Convert non-negative class scores into weights that add to one. This makes
  // RGB and point blending comparable even if incoming values total differently.
  function normalize(scores, labels) {
    const clean = {};
    for (const label of labels) {
      const value = Number(scores[label] ?? 0);
      if (!Number.isFinite(value) || value < 0) throw new Error("Invalid class score.");
      clean[label] = value;
    }
    const total = Object.values(clean).reduce((sum, value) => sum + value, 0);
    if (total <= 0) throw new Error("No positive class scores.");
    for (const label of labels) clean[label] /= total;
    return clean;
  }

  // Compute a weighted average of each profile's RGB colour and corresponding
  // outline points. This is a designed visual mapping, not additional learning.
  function blend(profiles, scores) {
    const labels = Object.keys(profiles);
    const weights = normalize(scores, labels);
    const count = profiles[labels[0]].points.length;
    const points = Array.from({ length: count }, () => ({ x: 0, y: 0 }));
    const rgb = [0, 0, 0];
    for (const label of labels) {
      const profile = profiles[label];
      const weight = weights[label];
      if (profile.points.length !== count) throw new Error("Point counts must match.");
      profile.color.forEach((channel, i) => {
        rgb[i] += weight * channel;
      });
      profile.points.forEach((point, i) => {
        points[i].x += weight * point.x;
        points[i].y += weight * point.y;
      });
    }
    return { points, color: rgb, weights };
  }

  const AgentMath = { POINT_COUNT, polygon, star, outline, normalize, blend };

  // Keeps the character's current target/display weights and animation clock.
  // Input can come from a classifier, a design test, or another sensor.
  class BlendedAgent {
    constructor(profiles) {
      this.profiles = profiles;
      this.labels = Object.keys(profiles);
      if (this.labels.length === 0) throw new Error("Add at least one profile.");
      this.targetScores = null;
      this.displayScores = null;
      this.motionTime = 0;
    }

    // Replace the target weights. Design tests can skip the transition and
    // immediately show the selected mix; live updates ease toward their target.
    setScores(scores, immediate = false) {
      this.targetScores = AgentMath.normalize(scores, this.labels);
      if (!this.displayScores || immediate) {
        this.displayScores = { ...this.targetScores };
      }
    }

    // Clear previous data when a new live session starts or a session stops.
    clearScores() {
      this.targetScores = null;
      this.displayScores = null;
    }

    // Advance score smoothing and (optionally) behavioural time by elapsed
    // seconds, rather than by a fixed amount per rendered frame.
    update(deltaSeconds, motionEnabled = true) {
      if (!this.targetScores) return false;
      if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
        throw new Error("Update time must be a non-negative number.");
      }
      const dt = Math.min(deltaSeconds, 0.1);
      const response = 1 - Math.exp(-dt / 0.22);
      for (const label of this.labels) {
        this.displayScores[label] +=
          (this.targetScores[label] - this.displayScores[label]) * response;
      }
      if (motionEnabled) this.motionTime += dt;
      return true;
    }

    // Derive the current appearance from displayed weights and design profiles.
    getAppearance() {
      if (!this.displayScores) return null;
      return AgentMath.blend(this.profiles, this.displayScores);
    }

    // Return a copy so callers can use weights for motion without mutating state.
    get weights() {
      return this.displayScores ? { ...this.displayScores } : null;
    }
  }

  root.AgentMath = AgentMath;
  root.BlendedAgent = BlendedAgent;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { AgentMath, BlendedAgent };
  }
})(typeof window !== "undefined" ? window : globalThis);

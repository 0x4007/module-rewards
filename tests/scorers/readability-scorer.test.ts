import { beforeEach, describe, expect, it } from "bun:test";
import { ReadabilityScorer } from "../../scorers/readability-scorer";

describe("ReadabilityScorer", () => {
  let scorer: ReadabilityScorer;

  beforeEach(() => {
    scorer = new ReadabilityScorer({ debug: false });
  });

  it("should calculate scores for simple text", async () => {
    const result = await scorer.score(
      "This is a simple test sentence. It should be easy to read."
    );

    expect(result.rawScore).toBeGreaterThan(0);
    expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(result.normalizedScore).toBeLessThanOrEqual(1);
    expect(result.metrics.fleschReadingEase).toBeDefined();
  });

  it("should handle empty text", async () => {
    const result = await scorer.score("");

    expect(result.rawScore).toBe(0);
    expect(result.normalizedScore).toBe(0);
    expect(result.metrics.fleschReadingEase).toBe(0);
  });

  it("should include additional metrics when configured", async () => {
    scorer = new ReadabilityScorer({ includeAllMetrics: true });
    const result = await scorer.score(
      "This is a test sentence. It has multiple metrics enabled."
    );

    expect(result.metrics.fleschKincaidGrade).toBeDefined();
    expect(result.metrics.gunningFogIndex).toBeDefined();
    expect(result.metrics.textStats).toBeDefined();
  });

  it("should apply weight to normalized score", async () => {
    const weight = 0.5;
    scorer = new ReadabilityScorer({ weight });
    const result = await scorer.score("Test sentence with weight applied.");

    expect(result.normalizedScore).toBeLessThanOrEqual(weight);
  });

  it("should normalize scores based on target score", async () => {
    const targetScore = 70;
    scorer = new ReadabilityScorer({ targetScore });
    const result = await scorer.score(
      "This is a test sentence targeting a specific readability score."
    );

    // Score should be normalized relative to target
    const distance = Math.abs(result.metrics.fleschReadingEase - targetScore);
    expect(result.normalizedScore).toBe(Math.max(0, Math.min(1, (100 - distance) / 100)));
  });
});

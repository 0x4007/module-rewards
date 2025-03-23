import { beforeEach, describe, expect, it } from "bun:test";
import { BaseScorer, ScorerResult } from "../../scorers/base-scorer";
import { ScoreAggregator } from "../../scorers/score-aggregator";

// Mock scorer for testing
class MockScorer extends BaseScorer {
  readonly id: string;
  private mockScore: number;

  constructor(id: string, mockScore: number, weight?: number) {
    super({ weight });
    this.id = id;
    this.mockScore = mockScore;
  }

  async score(): Promise<ScorerResult> {
    return {
      rawScore: this.mockScore,
      normalizedScore: this.normalize(this.mockScore),
      metrics: { mockScore: this.mockScore },
    };
  }
}

describe("ScoreAggregator", () => {
  let aggregator: ScoreAggregator;
  let mockScorerA: MockScorer;
  let mockScorerB: MockScorer;

  beforeEach(() => {
    mockScorerA = new MockScorer("scorer-a", 80);
    mockScorerB = new MockScorer("scorer-b", 60);
  });

  it("should aggregate scores using weighted average by default", async () => {
    aggregator = new ScoreAggregator({
      scorers: [
        { scorer: mockScorerA, weight: 0.6 },
        { scorer: mockScorerB, weight: 0.4 },
      ],
    });

    const result = await aggregator.score("test content");
    const expectedScore = (0.8 * 0.6 + 0.6 * 0.4); // normalized scores * weights

    expect(result.normalizedScore).toBeCloseTo(expectedScore);
    expect(result.metrics.weights).toEqual({
      "scorer-a": 0.6,
      "scorer-b": 0.4,
    });
  });

  it("should use minimum score when strategy is minimum", async () => {
    aggregator = new ScoreAggregator({
      scorers: [
        { scorer: mockScorerA },
        { scorer: mockScorerB },
      ],
      strategy: "minimum",
    });

    const result = await aggregator.score("test content");
    expect(result.normalizedScore).toBeCloseTo(0.6); // minimum of 0.8 and 0.6
  });

  it("should use maximum score when strategy is maximum", async () => {
    aggregator = new ScoreAggregator({
      scorers: [
        { scorer: mockScorerA },
        { scorer: mockScorerB },
      ],
      strategy: "maximum",
    });

    const result = await aggregator.score("test content");
    expect(result.normalizedScore).toBeCloseTo(0.8); // maximum of 0.8 and 0.6
  });

  it("should handle a single scorer", async () => {
    aggregator = new ScoreAggregator({
      scorers: [{ scorer: mockScorerA }],
    });

    const result = await aggregator.score("test content");
    expect(result.normalizedScore).toBeCloseTo(0.8);
  });

  it("should include all individual scores in metrics", async () => {
    aggregator = new ScoreAggregator({
      scorers: [
        { scorer: mockScorerA },
        { scorer: mockScorerB },
      ],
    });

    const result = await aggregator.score("test content");
    expect(result.metrics.individualScores["scorer-a"]).toBeDefined();
    expect(result.metrics.individualScores["scorer-b"]).toBeDefined();
  });

  it("should use scorer's weight if not specified in config", async () => {
    mockScorerA = new MockScorer("scorer-a", 80, 0.7);
    mockScorerB = new MockScorer("scorer-b", 60, 0.3);

    aggregator = new ScoreAggregator({
      scorers: [
        { scorer: mockScorerA },
        { scorer: mockScorerB },
      ],
    });

    const result = await aggregator.score("test content");
    expect(result.metrics.weights).toEqual({
      "scorer-a": 0.7,
      "scorer-b": 0.3,
    });
  });

  it("should normalize final score to 0-1 range", async () => {
    mockScorerA = new MockScorer("scorer-a", 120); // Over 100
    mockScorerB = new MockScorer("scorer-b", -20); // Under 0

    aggregator = new ScoreAggregator({
      scorers: [
        { scorer: mockScorerA },
        { scorer: mockScorerB },
      ],
    });

    const result = await aggregator.score("test content");
    expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(result.normalizedScore).toBeLessThanOrEqual(1);
  });
});

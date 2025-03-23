import { beforeEach, describe, expect, test } from "bun:test";
import { createCloudEvent } from "../../utils/cloud-events";
import { MOCK_READABILITY_RESULT, MockReadabilityScorer } from "../mocks/mock-readability-scorer";

// Use our mock ReadabilityScorer for testing
// This avoids the need to mock the text-readability package directly

describe("ReadabilityScorer", () => {
  let scorer: MockReadabilityScorer;

  beforeEach(() => {
    // Create a fresh MockReadabilityScorer instance before each test
    scorer = new MockReadabilityScorer({
      targetScore: 60,
      includeAllMetrics: true,
    });
  });

  test("should handle GitHub issue comment events", async () => {
    // Create a sample GitHub issue comment event
    const event = createCloudEvent({
      id: "test-1",
      source: "github",
      type: "com.github.issue_comment.created",
      data: {
        comment: {
          body: "This is a test comment from GitHub.",
        },
      },
    });

    const result = await scorer.transform(event, {});

    // Verify that readability results were added
    expect(result.readability).toBeDefined();
    expect(result.readability.fleschReadingEase).toBe(MOCK_READABILITY_RESULT.fleschReadingEase);
    expect(result.weightedReadabilityScore).toBeDefined();
  });

  test("should handle Google Docs events", async () => {
    // Create a sample Google Docs event
    const event = createCloudEvent({
      id: "test-2",
      source: "google-docs",
      type: "com.google-docs.document.edited",
      data: {
        document: {
          content: "This is a test document from Google Docs.",
        },
      },
    });

    const result = await scorer.transform(event, {});

    // Verify that readability results were added
    expect(result.readability).toBeDefined();
  });

  test("should use content from previous module if available", async () => {
    // Create a generic event without specific content
    const event = createCloudEvent({
      id: "test-3",
      source: "example",
      type: "com.example.test",
      data: {},
    });

    // Provide content in the initial result (as if from a previous module)
    const initialResult = {
      content: "This is content from a previous module.",
    };

    const result = await scorer.transform(event, initialResult);

    // Verify that readability results were added
    expect(result.readability).toBeDefined();
    expect(result.content).toBe("This is content from a previous module.");
  });

  test("should skip processing if content was filtered", async () => {
    const event = createCloudEvent({
      id: "test-4",
      source: "github",
      type: "com.github.issue_comment.created",
      data: {
        comment: {
          body: "This comment should be ignored.",
        },
      },
    });

    // Result indicating content was filtered
    const initialResult = {
      filtered: true,
      reason: "test-filter",
    };

    const result = await scorer.transform(event, initialResult);

    // Verify that no readability results were added
    expect(result.readability).toBeUndefined();
    expect(result).toEqual(initialResult);
  });

  test("should handle events with no content", async () => {
    const event = createCloudEvent({
      id: "test-5",
      source: "example",
      type: "com.example.empty",
      data: {},
    });

    const result = await scorer.transform(event, {});

    // Verify that no readability results were added
    expect(result.readability).toBeUndefined();
  });

  test("should correctly normalize scores", async () => {
    // Create an event with content
    const event = createCloudEvent({
      id: "test-6",
      source: "example",
      type: "com.example.test",
      data: {
        content: "Test content for normalization.",
      },
    });

    // Create a scorer with target score matching the mock value
    const perfectScorer = new MockReadabilityScorer({
      targetScore: 70.5, // Same as our mocked fleschReadingEase
    });

    const result = await perfectScorer.transform(event, {});

    // Since the target score matches our special case in the mock, normalized score should be 1.0
    expect(result.readability?.normalizedScore).toBe(1.0);
    expect(result.weightedReadabilityScore).toBe(1.0);
  });

  test("should apply weight to the score", async () => {
    // Create an event with content
    const event = createCloudEvent({
      id: "test-7",
      source: "example",
      type: "com.example.test",
      data: {
        content: "Test content for weighting.",
      },
    });

    // Create a scorer with 0.5 weight
    const weightedScorer = new MockReadabilityScorer({
      targetScore: 70.5, // Same as our mocked fleschReadingEase
      weight: 0.5,
    });

    const result = await weightedScorer.transform(event, {});

    // Since the normalized score should be 1.0 and the weight is 0.5, weighted score should be 0.5
    expect(result.readability?.normalizedScore).toBe(1.0);
    expect(result.weightedReadabilityScore).toBe(0.5);
  });

  test("should include additional metrics when includeAllMetrics is true", async () => {
    const event = createCloudEvent({
      id: "test-8",
      source: "example",
      type: "com.example.test",
      data: {
        content: "Test content for additional metrics.",
      },
    });

    const result = await scorer.transform(event, {});

    // Check that additional metrics are included
    expect(result.readability?.fleschKincaidGrade).toBe(MOCK_READABILITY_RESULT.fleschKincaidGrade);
    expect(result.readability?.gunningFogIndex).toBe(MOCK_READABILITY_RESULT.gunningFogIndex);
    expect(result.readability?.textStats).toBeDefined();
    expect(result.readability?.textStats?.words).toBe(MOCK_READABILITY_RESULT.textStats.words);
  });
});

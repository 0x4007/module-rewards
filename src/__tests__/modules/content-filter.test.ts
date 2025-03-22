import { beforeEach, describe, expect, test } from "bun:test";
import { ContentFilter } from "../../modules/content-filter";
import { createCloudEvent } from "../../utils/cloud-events";

describe("ContentFilter", () => {
  let filter: ContentFilter;

  // Create a basic GitHub issue comment event for testing
  const createCommentEvent = (body: string, author: string = "test-user") => {
    return createCloudEvent({
      id: `test-${Date.now()}`,
      source: "github",
      type: "com.github.issue_comment.created",
      data: {
        comment: {
          body,
          user: {
            login: author,
          },
        },
      },
    });
  };

  beforeEach(() => {
    // Create a fresh filter instance before each test with default settings
    filter = new ContentFilter();
  });

  test("should pass through valid content", async () => {
    const event = createCommentEvent("This is a valid comment with good length.");
    const result = await filter.transform(event, {});

    expect(result.filtered).toBe(false);
    expect(result.content).toBe("This is a valid comment with good length.");
    expect(result.author).toBe("test-user");
  });

  test("should filter content from bots by default", async () => {
    const event = createCommentEvent("This is a bot comment.", "github-actions[bot]");
    const result = await filter.transform(event, {});

    expect(result.filtered).toBe(true);
    expect(result.reason).toBe("bot-author");
  });

  test("should respect excludeBots=false config", async () => {
    // Create filter with excludeBots turned off
    const customFilter = new ContentFilter({ excludeBots: false });

    const event = createCommentEvent("This is a bot comment.", "github-actions[bot]");
    const result = await customFilter.transform(event, {});

    expect(result.filtered).toBe(false);
  });

  test("should filter content that is too short", async () => {
    const event = createCommentEvent("Too short");
    const result = await filter.transform(event, {});

    expect(result.filtered).toBe(true);
    expect(result.reason).toBe("too-short");
  });

  test("should respect custom minLength config", async () => {
    // Create filter with very short minimum length
    const customFilter = new ContentFilter({ minLength: 3 });

    // This would be too short for default config but ok for custom
    const event = createCommentEvent("Hi!");
    const result = await customFilter.transform(event, {});

    expect(result.filtered).toBe(false);
  });

  test("should filter excluded users", async () => {
    // Create filter with excluded users
    const customFilter = new ContentFilter({
      excludeUsers: ["blocked-user", "another-blocked-user"],
    });

    const event = createCommentEvent("Comment from blocked user.", "blocked-user");
    const result = await customFilter.transform(event, {});

    expect(result.filtered).toBe(true);
    expect(result.reason).toBe("excluded-user");
  });

  test("should filter content matching patterns", async () => {
    // Create filter with content patterns to filter
    const customFilter = new ContentFilter({
      filterPatterns: ["spam", "bad-word"],
    });

    const event = createCommentEvent("This comment contains spam and should be filtered.");
    const result = await customFilter.transform(event, {});

    expect(result.filtered).toBe(true);
    expect(result.reason).toBe("matched-pattern");
  });

  test("should handle events with no content", async () => {
    const emptyEvent = createCloudEvent({
      id: "empty-event",
      source: "test",
      type: "com.test.empty",
      data: {},
    });

    const result = await filter.transform(emptyEvent, {});

    expect(result.filtered).toBe(false);
    expect(result.reason).toBe("no-content");
  });

  test("should handle Google Docs events", async () => {
    const docsEvent = createCloudEvent({
      id: "docs-event",
      source: "google-docs",
      type: "com.google-docs.document.edited",
      data: {
        document: {
          content: "This is a Google Docs document with sufficient length.",
          author: "test-user@example.com",
        },
      },
    });

    const result = await filter.transform(docsEvent, {});

    expect(result.filtered).toBe(false);
    expect(result.content).toBe("This is a Google Docs document with sufficient length.");
  });

  test("should handle Telegram events", async () => {
    const telegramEvent = createCloudEvent({
      id: "telegram-event",
      source: "telegram",
      type: "com.telegram.message.sent",
      data: {
        message: {
          text: "This is a Telegram message with sufficient length.",
          from: {
            username: "telegram-user",
          },
        },
      },
    });

    const result = await filter.transform(telegramEvent, {});

    expect(result.filtered).toBe(false);
    expect(result.content).toBe("This is a Telegram message with sufficient length.");
    expect(result.author).toBe("telegram-user");
  });

  test("should not reprocess already filtered content", async () => {
    // Create an event that would normally pass
    const event = createCommentEvent("This is a valid comment with good length.");

    // But provide an initial result indicating it was already filtered
    const initialResult = {
      filtered: true,
      reason: "pre-filtered",
    };

    const result = await filter.transform(event, initialResult);

    // Verify that the filter didn't change anything
    expect(result).toEqual(initialResult);
  });

  test("should use content from previous module if available", async () => {
    // Create event without specific content
    const event = createCloudEvent({
      id: "generic-event",
      source: "test",
      type: "com.test.generic",
      data: {},
    });

    // Provide content in the initial result
    const initialResult = {
      content: "This content came from a previous module.",
      author: "previous-module-user",
    };

    const result = await filter.transform(event, initialResult);

    // Verify that we used the content from the previous module
    expect(result.filtered).toBe(false);
    expect(result.content).toBe("This content came from a previous module.");
    expect(result.author).toBe("previous-module-user");
  });
});

import { describe, expect, test } from "bun:test";
import { createCloudEvent } from "../../utils/cloud-events";

describe("CloudEvents Utilities", () => {
  test("createCloudEvent should create a valid CloudEvent", () => {
    // Setup
    const params = {
      id: "test-event-1",
      source: "test-source",
      type: "com.example.test",
      data: { message: "Hello World" },
      subject: "test-subject",
      datacontenttype: "application/json",
    };

    // Execute
    const event = createCloudEvent(params);

    // Verify
    expect(event.specversion).toBe("1.0");
    expect(event.id).toBe(params.id);
    expect(event.source).toBe(params.source);
    expect(event.type).toBe(params.type);
    expect(event.data).toEqual(params.data);
    expect(event.subject).toBe(params.subject);
    expect(event.datacontenttype).toBe(params.datacontenttype);
    expect(event.time).toBeDefined();

    // Time should be an ISO timestamp string
    const timeDate = new Date(event.time as string);
    expect(timeDate.toString()).not.toBe("Invalid Date");
  });

  test("createCloudEvent should set default values when not provided", () => {
    // Setup - only required fields
    const params = {
      id: "test-event-2",
      source: "test-source",
      type: "com.example.minimal",
    };

    // Execute
    const event = createCloudEvent(params);

    // Verify
    expect(event.specversion).toBe("1.0");
    expect(event.id).toBe(params.id);
    expect(event.source).toBe(params.source);
    expect(event.type).toBe(params.type);
    expect(event.datacontenttype).toBe("application/json");
    expect(event.time).toBeDefined();
    expect(event.data).toBeUndefined();
    expect(event.subject).toBeUndefined();
  });

  test("createCloudEvent should handle different data types", () => {
    // String data
    const stringEvent = createCloudEvent({
      id: "string-event",
      source: "test-source",
      type: "com.example.string",
      data: "string data",
    });
    expect(typeof stringEvent.data).toBe("string");

    // Number data
    const numberEvent = createCloudEvent({
      id: "number-event",
      source: "test-source",
      type: "com.example.number",
      data: 42,
    });
    expect(typeof numberEvent.data).toBe("number");

    // Array data
    const arrayEvent = createCloudEvent({
      id: "array-event",
      source: "test-source",
      type: "com.example.array",
      data: [1, 2, 3],
    });
    expect(Array.isArray(arrayEvent.data)).toBe(true);

    // Object data
    const objectEvent = createCloudEvent({
      id: "object-event",
      source: "test-source",
      type: "com.example.object",
      data: { key: "value" },
    });
    expect(typeof objectEvent.data).toBe("object");
    expect(Array.isArray(objectEvent.data)).toBe(false);
  });
});

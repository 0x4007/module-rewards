export interface CloudEvent<T = any> {
  id: string;
  source: string;
  type: string;
  time: string;
  data: T;
  datacontenttype?: string;
  specversion: string;
  subject?: string;
}

/**
 * Generate a random UUID-like string for browser environments
 * This is a fallback for browsers that don't support crypto.randomUUID()
 */
function generateRandomId(): string {
  // Simple UUID v4 format implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a CloudEvent with browser-compatible ID generation
 */
export function createCloudEvent<T>(
  type: string,
  source: string,
  data: T,
  options: Partial<CloudEvent<T>> = {}
): CloudEvent<T> {
  // Use crypto.randomUUID() if available, otherwise fallback to our implementation
  const id =
    options.id || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : generateRandomId());

  return {
    id,
    source,
    type,
    time: options.time || new Date().toISOString(),
    data,
    datacontenttype: options.datacontenttype || "application/json",
    specversion: "1.0",
    subject: options.subject,
  };
}

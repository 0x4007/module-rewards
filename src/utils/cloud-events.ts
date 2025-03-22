/**
 * CloudEvents compliant event structure
 * @see https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
 */
export interface CloudEvent<T = any> {
  // Required attributes
  specversion: string;
  id: string;
  source: string;
  type: string;

  // Optional attributes
  datacontenttype?: string;
  dataschema?: string;
  subject?: string;
  time?: string;

  // Event data
  data?: T;
}

/**
 * Create a new CloudEvent
 */
export function createCloudEvent<T = any>(params: {
  id: string;
  source: string;
  type: string;
  data?: T;
  subject?: string;
  datacontenttype?: string;
}): CloudEvent<T> {
  return {
    specversion: "1.0",
    id: params.id,
    source: params.source,
    type: params.type,
    time: new Date().toISOString(),
    datacontenttype: params.datacontenttype || "application/json",
    subject: params.subject,
    data: params.data,
  };
}

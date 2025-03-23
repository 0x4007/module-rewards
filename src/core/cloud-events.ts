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

function createCloudEvent<T>(
  type: string,
  source: string,
  data: T,
  options: Partial<CloudEvent<T>> = {}
): CloudEvent<T> {
  return {
    id: options.id || crypto.randomUUID(),
    source,
    type,
    time: options.time || new Date().toISOString(),
    data,
    datacontenttype: options.datacontenttype || "application/json",
    specversion: "1.0",
    subject: options.subject,
  };
}

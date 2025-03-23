import { CloudEvent, createCloudEvent } from "../core/cloud-events";
import crypto from "crypto";

export function validateGitHubWebhook(headers: Record<string, string>, payload: any, webhookSecret?: string): boolean {
  if (!webhookSecret) {
    return true; // Skip validation if no secret provided
  }

  const signature = headers["x-hub-signature-256"];
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", webhookSecret);
  const computedSignature = "sha256=" + hmac.update(JSON.stringify(payload)).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
}

export function normalizeGitHubEvent(eventType: string, payload: any): CloudEvent<any> {
  const source = payload.repository?.html_url || "github";
  const normalizedType = `github.${eventType.replace(".", "_")}`;

  return createCloudEvent(normalizedType, source, payload, {
    subject: getEventSubject(eventType, payload),
  });
}

function getEventSubject(eventType: string, payload: any): string {
  switch (eventType) {
    case "issue_comment":
      return `Issue #${payload.issue.number}`;
    case "pull_request_review":
      return `PR #${payload.pull_request.number}`;
    case "pull_request_review_comment":
      return `PR #${payload.pull_request.number}`;
    default:
      return "";
  }
}

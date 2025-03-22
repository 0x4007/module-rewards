import { CloudEvent, createCloudEvent } from "../core/browser-events";

/**
 * Browser-compatible utility functions for GitHub integration
 * This version doesn't use Node.js-specific crypto modules
 */

/**
 * Validate a GitHub webhook signature (browser compatible version)
 * In browser context, we simply return true as we don't receive webhooks directly
 */
export function validateGitHubWebhook(headers: Record<string, string>, payload: any, webhookSecret?: string): boolean {
  // Browser environments don't receive webhooks directly, so we skip validation
  return true;
}

/**
 * Normalize a GitHub event into a CloudEvent format
 */
export function normalizeGitHubEvent(eventType: string, payload: any): CloudEvent<any> {
  const source = payload.repository?.html_url || "github";
  const normalizedType = `github.${eventType.replace(".", "_")}`;

  return createCloudEvent(normalizedType, source, payload, {
    subject: getEventSubject(eventType, payload),
  });
}

/**
 * Extract a meaningful subject from GitHub event payload
 */
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

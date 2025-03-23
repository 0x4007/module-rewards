import { CloudEvent, createCloudEvent } from "../core/browser-events";
import { UrlParseResult } from "./types";

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
 * Parse a GitHub URL into its components
 */
export function parseGitHubUrl(url: string): UrlParseResult | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
    number: match[4],
    type: match[3] === "pull" ? "pr" : "issue",
  };
}

/**
 * Determine if a GitHub URL should be an issue or pull request URL and return the correct version
 */
export async function getCorrectGitHubUrl(url: string): Promise<string> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return url;

  try {
    // First try to fetch as a PR
    const prResponse = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`
    );

    if (prResponse.ok) {
      // If successful, this should be a PR URL
      return url.replace(/\/(issues|pull)\//, "/pull/");
    }

    // If PR check failed, try to fetch as an issue
    const issueResponse = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`
    );

    if (issueResponse.ok) {
      // If successful, this should be an issue URL
      return url.replace(/\/(issues|pull)\//, "/issues/");
    }
  } catch (error) {
    console.error("Error checking GitHub endpoint:", error);
  }

  // If there's any error or neither is found, return original URL
  return url;
}

/**
 * Navigate to the correct GitHub URL (converts issue URLs to PR URLs when appropriate)
 */
export function navigateToCorrectUrl(url: string): void {
  getCorrectGitHubUrl(url).then((correctUrl) => {
    if (correctUrl !== url) {
      window.location.href = correctUrl;
    }
  });
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

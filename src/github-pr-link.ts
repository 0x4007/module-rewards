import { findLinkedIssue } from "./github-bidirectional";
import { LinkedIssue } from "./types";

/**
 * Wrapper for the bidirectional issue lookup function in github-bidirectional.ts
 * This provides compatibility for any existing code using this module
 */
export async function isIssueLinkedByPR(
  owner: string,
  repo: string,
  prNumber: string,
  token?: string
): Promise<LinkedIssue | undefined> {
  if (!token) {
    console.log("GitHub token is required for PR-Issue relationship lookup");
    return undefined;
  }

  try {
    console.log(`Finding issues linked by PR ${owner}/${repo}#${prNumber}`);
    return await findLinkedIssue(owner, repo, prNumber, token);
  } catch (error) {
    console.error("Failed to check issue-PR relationships:", error);
    return undefined;
  }
}

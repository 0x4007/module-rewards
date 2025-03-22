import { LinkedIssue } from "./types";

/**
 * Implements clean, robust bidirectional PR-Issue linkage
 * Based on the proven approach from text-conversation-rewards
 */

// Main GraphQL query for finding issues closed by a pull request
// Adapted from text-conversation-rewards
const PR_TO_ISSUES_QUERY = `
  query FindIssuesClosedByPR($owner: String!, $repo: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        id
        closingIssuesReferences(first: 10) {
          nodes {
            id
            number
            title
            body
            url
          }
        }
      }
    }
  }
`;

// Main GraphQL query for finding pull requests that close an issue
// Direct adaptation of the text-conversation-rewards approach
const ISSUE_TO_PRS_QUERY = `
  query FindPRsClosingIssue($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        id
        number
        title
        body
        url
        closedByPullRequestsReferences(first: 10) {
          nodes {
            id
            number
          }
        }
      }
    }
  }
`;

/**
 * Main entry point for bidirectional PR-Issue linkage
 * Uses the proven approach from text-conversation-rewards project
 */
export async function findLinkedIssue(
  owner: string,
  repo: string,
  prNumber: string,
  token: string
): Promise<LinkedIssue | undefined> {
  console.log(`🔎 DIAGNOSTIC: Finding linked issue for PR ${owner}/${repo}#${prNumber}`);

  try {
    // Try forward direction first (PR → Issue)
    const forwardLink = await findIssuesFromPR(owner, repo, prNumber, token);
    if (forwardLink) {
      console.log(`Found issue #${forwardLink.number} linked to PR #${prNumber}`);
      return forwardLink;
    }

    // If no links found, try to find issues that might reference this PR (Issue → PR)
    // This is the approach that works in text-conversation-rewards
    const reverseLink = await findIssueForPRFromIssues(owner, repo, prNumber, token);
    if (reverseLink) {
      console.log(`Found issue #${reverseLink.number} links to PR #${prNumber} (via reverse lookup)`);
      return reverseLink;
    }

    console.log(`No linked issues found for PR ${owner}/${repo}#${prNumber}`);
    return undefined;
  } catch (error) {
    console.error("Error in bidirectional issue lookup:", error);
    return undefined;
  }
}

/**
 * Find issues that are directly linked from a PR
 * Uses the forward direction (PR → Issue)
 */
async function findIssuesFromPR(
  owner: string,
  repo: string,
  prNumber: string,
  token: string
): Promise<LinkedIssue | undefined> {
  try {
    console.log(`Looking for issues closed by PR ${owner}/${repo}#${prNumber}`);

    const data = await executeGitHubGraphQL(
      PR_TO_ISSUES_QUERY,
      {
        owner,
        repo,
        prNumber: parseInt(prNumber, 10),
      },
      token
    );

    if (!data?.repository?.pullRequest) {
      console.log("Pull request not found or insufficient permissions");
      return undefined;
    }

    // First check explicit closing references
    const closingIssues = data.repository.pullRequest.closingIssuesReferences?.nodes || [];
    if (closingIssues.length > 0) {
      const issue = closingIssues[0];
      return {
        number: issue.number,
        title: issue.title || "No title",
        body: issue.body || "",
        html_url: issue.url,
      };
    }

    return undefined;
  } catch (error) {
    console.error("Error finding issues from PR:", error);
    return undefined;
  }
}

/**
 * Find issues that have this PR in their closedByPullRequestsReferences
 * This is the approach used by text-conversation-rewards
 * Uses the reverse direction (Issue → PR)
 */
async function findIssueForPRFromIssues(
  owner: string,
  repo: string,
  targetPrNumber: string,
  token: string
): Promise<LinkedIssue | undefined> {
  // For efficiency, we'll try the most likely issue numbers first
  // Typically, PRs close issues with similar numbers
  const prNum = parseInt(targetPrNumber, 10);

  // Try potential issue numbers based on common patterns
  const potentialIssueNumbers = [
    prNum - 1,      // Most common pattern: PR often closes issue with number one less
    prNum,          // Sometimes PR and issue have same number
  ];

  // Also try a range around the PR number
  for (let i = 2; i <= 5; i++) {
    if (prNum - i > 0 && !potentialIssueNumbers.includes(prNum - i)) {
      potentialIssueNumbers.push(prNum - i);
    }
  }

  // Deduplicate and sort issue numbers
  const uniqueIssueNumbers = [...new Set(potentialIssueNumbers)].sort((a, b) => a - b);

  console.log(
    `Checking potential issues that might be closed by PR #${targetPrNumber}: ${uniqueIssueNumbers.join(", ")}`
  );

  // Try each potential issue number
  for (const issueNumber of uniqueIssueNumbers) {
    try {
      // Ensure clean parameter passing without spaces
      const data = await executeGitHubGraphQL(
        ISSUE_TO_PRS_QUERY,
        {
          owner,
          repo,
          issueNumber,
        },
        token
      );

      if (!data?.repository?.issue) continue;

      const issue = data.repository.issue;
      const closingPRs = issue.closedByPullRequestsReferences?.nodes || [];

      // Check if any of these PRs match our target
      const matchingPR = closingPRs.find((pr: { number: number }) => pr.number === parseInt(targetPrNumber, 10));

      if (matchingPR) {
        console.log(`Found issue #${issueNumber} is closed by PR #${targetPrNumber}`);
        return {
          number: issue.number,
          title: issue.title || "No title",
          body: issue.body || "",
          html_url: issue.url,
        };
      }
    } catch (error) {
      console.log(`Error checking issue #${issueNumber}, continuing to next potential issue`);
      continue;
    }
  }

  return undefined;
}

/**
 * Execute a GraphQL query against GitHub's API
 */
async function executeGitHubGraphQL(query: string, variables: any, token: string): Promise<any> {
  try {
    // Log the variables we're actually sending
    console.log(`Executing GraphQL query for: ${variables.owner}/${variables.repo}`);

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error("GraphQL errors:", JSON.stringify(result.errors, null, 2));
      // Don't throw on repository not found, just return null
      if (result.errors.some((e: any) => e.type === "NOT_FOUND" && e.path?.includes("repository"))) {
        console.log(`Repository not found: ${variables.owner}/${variables.repo}`);
        return null;
      }
      return null; // Return null instead of throwing for other GraphQL errors
    }

    return result.data;
  } catch (error) {
    console.error("Error executing GraphQL query:", error);
    return null;
  }
}

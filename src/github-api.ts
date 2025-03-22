import { findLinkedIssue, findLinkedPullRequests } from "./github-bidirectional";
import { FetchedData, LinkedIssue, LinkedPullRequest, UrlParseResult } from "./types";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

/**
 * Execute a GraphQL query against GitHub's API
 */
async function executeGraphQL(query: string, variables: any, token?: string): Promise<any> {
  if (!token) {
    throw new Error("GitHub token is required for GraphQL queries");
  }

  console.log("Executing GraphQL query with variables:", JSON.stringify(variables));

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    console.error(`GraphQL request failed with status: ${response.status}`);
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    console.error("GraphQL response returned errors:", data.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  console.log("GraphQL response received successfully");
  return data.data;
}

/**
 * Parse a GitHub PR or Issue URL into its components
 */
export function parseUrl(url: string): UrlParseResult {
  try {
    // Remove any trailing slashes and whitespace
    const cleanUrl = url.trim().replace(/\/$/, "");

    // Extract parts using regex
    // Support both full URLs and shorthand formats:
    // - https://github.com/owner/repo/issues/123
    // - https://github.com/owner/repo/pull/123
    // - https://github.com/owner/repo/pulls/123
    const regex = /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)\/(?:(issues|pulls?))\/(\d+)/i;
    const match = cleanUrl.match(regex);

    if (!match) {
      throw new Error("Invalid GitHub URL format. Must be a PR or Issue URL.");
    }

    const [, owner, repo, type, number] = match;
    return {
      owner,
      repo,
      number,
      type: type.toLowerCase().startsWith("pull") ? "pr" : "issue",
    };
  } catch (error) {
    throw new Error(`Could not parse GitHub PR URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch data from GitHub API for a PR or Issue
 */
export async function fetchGitHubData(
  owner: string,
  repo: string,
  number: string,
  type: "pr" | "issue",
  token?: string
): Promise<FetchedData> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const baseUrl = "https://api.github.com";

  try {
    // Fetch details (PR or Issue)
    const detailsResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/${type === "pr" ? "pulls" : "issues"}/${number}`,
      { headers }
    );

    if (!detailsResponse.ok) {
      if (detailsResponse.status === 401 || detailsResponse.status === 403) {
        throw new Error("Authentication failed. Please provide a valid GitHub token.");
      } else if (detailsResponse.status === 404) {
        throw new Error(`${type.toUpperCase()} not found. Check the URL or your access permissions.`);
      } else {
        throw new Error(`GitHub API error: ${detailsResponse.status}`);
      }
    }

    const details = await detailsResponse.json();
    let comments = [];

    // For PRs, fetch review comments and PR reviews
    if (type === "pr") {
      // Review comments (inline comments)
      const reviewCommentsUrl = `${baseUrl}/repos/${owner}/${repo}/pulls/${number}/comments`;
      const reviewCommentsResponse = await fetch(reviewCommentsUrl, { headers });
      if (reviewCommentsResponse.ok) {
        const reviewComments = await reviewCommentsResponse.json();
        comments.push(...reviewComments);
      }

      // PR review comments (top-level review comments)
      const prReviewsUrl = `${baseUrl}/repos/${owner}/${repo}/pulls/${number}/reviews`;
      const prReviewsResponse = await fetch(prReviewsUrl, { headers });
      if (prReviewsResponse.ok) {
        const reviews = await prReviewsResponse.json();
        const reviewComments = reviews
          .filter((review: any) => review.body)
          .map((review: any) => ({
            id: review.id,
            body: review.body,
            user: review.user,
            created_at: review.submitted_at,
            updated_at: review.submitted_at,
            html_url: review.html_url,
          }));
        comments.push(...reviewComments);
      }
    }

    // Issue comments (for both PRs and Issues)
    const issueCommentsUrl = `${baseUrl}/repos/${owner}/${repo}/issues/${number}/comments`;
    const issueCommentsResponse = await fetch(issueCommentsUrl, { headers });
    if (issueCommentsResponse.ok) {
      const issueComments = await issueCommentsResponse.json();
      comments.push(...issueComments);
    }

    // Handle bidirectional linking
    let linkedIssue: LinkedIssue | undefined;
    let linkedPullRequests: LinkedPullRequest[] | undefined;

    if (token) {
      if (type === "pr") {
        // For PRs, find the linked issue
        linkedIssue = await findLinkedIssue(owner, repo, number, token);
        if (linkedIssue) {
          try {
            const issueCommentsUrl = `${baseUrl}/repos/${linkedIssue.repository?.owner || owner}/${
              linkedIssue.repository?.name || repo
            }/issues/${linkedIssue.number}/comments`;
            const issueCommentsResponse = await fetch(issueCommentsUrl, { headers });
            if (issueCommentsResponse.ok) {
              const issueComments = await issueCommentsResponse.json();
              linkedIssue.comments = issueComments;
            }
          } catch (error) {
            console.error("Error fetching linked issue comments:", error);
          }
        }
      } else if (type === "issue") {
        // For issues, find linked pull requests
        console.log(`Finding linked PRs for issue #${number}`);
        const foundLinkedPRs = await findLinkedPullRequests(owner, repo, number, token);

        if (foundLinkedPRs && foundLinkedPRs.length > 0) {
          console.log(`Found ${foundLinkedPRs.length} linked PRs for issue #${number}`);
          linkedPullRequests = foundLinkedPRs;

          // For the first PR, try to fetch its comments too
          if (linkedPullRequests.length > 0) {
            try {
              const mainPR = linkedPullRequests[0];
              // Make sure we have repository information
              const prOwner = mainPR.repository?.owner?.login || owner;
              const prRepo = mainPR.repository?.name || repo;

              const prCommentsUrl = `${baseUrl}/repos/${prOwner}/${prRepo}/pulls/${mainPR.number}/comments`;
              const prReviewCommentsResponse = await fetch(prCommentsUrl, { headers });

              // For issue comments on the PR
              const prIssueCommentsUrl = `${baseUrl}/repos/${prOwner}/${prRepo}/issues/${mainPR.number}/comments`;
              const prIssueCommentsResponse = await fetch(prIssueCommentsUrl, { headers });

              const allComments = [];

              if (prReviewCommentsResponse.ok) {
                const reviewComments = await prReviewCommentsResponse.json();
                allComments.push(...reviewComments);
              }

              if (prIssueCommentsResponse.ok) {
                const issueComments = await prIssueCommentsResponse.json();
                allComments.push(...issueComments);
              }

              // Add the comments to the PR
              mainPR.comments = allComments;

              console.log(`Fetched ${allComments.length} comments for linked PR #${mainPR.number}`);
            } catch (error) {
              console.error("Error fetching linked PR comments:", error);
            }
          }
        } else {
          console.log(`No linked PRs found for issue #${number}`);
        }
      }
    }

    return {
      details,
      comments,
      type,
      linkedIssue,
      linkedPullRequests,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

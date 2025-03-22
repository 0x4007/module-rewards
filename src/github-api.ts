import { FetchedData, LinkedIssue, UrlParseResult } from "./types";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

/**
 * Execute a GraphQL query against GitHub's API
 */
async function executeGraphQL(query: string, variables: any, token?: string): Promise<any> {
  if (!token) {
    throw new Error("GitHub token is required for GraphQL queries");
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

/**
 * Fetch linked issue data for a pull request
 */
async function fetchLinkedIssue(owner: string, repo: string, prNumber: string, token?: string): Promise<LinkedIssue | undefined> {
  const query = `
    query GetLinkedIssue($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          id
          closingIssuesReferences(first: 1) {
            nodes {
              number
              title
              body
              url
            }
          }
          linkedIssues(first: 1) {
            nodes {
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

  try {
    const data = await executeGraphQL(query, {
      owner,
      repo,
      number: parseInt(prNumber, 10)
    }, token);

    // Check both closingIssuesReferences and linkedIssues
    const closingIssues = data.repository.pullRequest.closingIssuesReferences.nodes || [];
    const linkedIssues = data.repository.pullRequest.linkedIssues.nodes || [];

    // Combine and take the first issue found
    const allIssues = [...closingIssues, ...linkedIssues];
    if (allIssues.length > 0) {
      const issue = allIssues[0];
      return {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        html_url: issue.url
      };
    }
    return undefined;
  } catch (error) {
    console.warn("Failed to fetch linked issue:", error);
    return undefined;
  }
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

  // Add authorization header if token exists
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  // Base GitHub API URL
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

    // Fetch all comments
    let comments = [];

    if (type === "pr") {
      // For PRs, fetch:
      // 1. Review comments (inline comments)
      const reviewCommentsUrl = `${baseUrl}/repos/${owner}/${repo}/pulls/${number}/comments`;
      const reviewCommentsResponse = await fetch(reviewCommentsUrl, { headers });
      if (reviewCommentsResponse.ok) {
        const reviewComments = await reviewCommentsResponse.json();
        comments.push(...reviewComments);
      }

      // 2. PR review comments (top-level review comments)
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

    // 3. Issue comments (for both PRs and Issues)
    const issueCommentsUrl = `${baseUrl}/repos/${owner}/${repo}/issues/${number}/comments`;
    const issueCommentsResponse = await fetch(issueCommentsUrl, { headers });
    if (issueCommentsResponse.ok) {
      const issueComments = await issueCommentsResponse.json();
      comments.push(...issueComments);
    } else {
      throw new Error(`Failed to fetch comments: ${issueCommentsResponse.status}`);
    }

    // If this is a PR, try to fetch linked issue
    let linkedIssue;
    if (type === "pr" && token) {
      linkedIssue = await fetchLinkedIssue(owner, repo, number, token);
    }

    return {
      details,
      comments,
      type,
      linkedIssue,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

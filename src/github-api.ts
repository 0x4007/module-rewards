import { findLinkedIssue } from "./github-bidirectional";
import { FetchedData, LinkedIssue, UrlParseResult } from "./types";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

/**
 * Execute a GraphQL query against GitHub's API
 */
async function executeGraphQL(query: string, variables: any, token?: string): Promise<any> {
  if (!token) {
    throw new Error("GitHub token is required for GraphQL queries");
  }

  console.log('Executing GraphQL query with variables:', JSON.stringify(variables));

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
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
    console.error('GraphQL response returned errors:', data.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  console.log('GraphQL response received successfully');
  return data.data;
}

/**
 * Fetch linked issue data for a pull request using the reliable bidirectional approach
 */
async function fetchLinkedIssue(owner: string, repo: string, prNumber: string, token?: string): Promise<LinkedIssue | undefined> {
  if (!token) {
    console.log('No token provided, cannot fetch linked issues');
    return undefined;
  }

  try {
    console.log(`Fetching linked issue for PR ${owner}/${repo}#${prNumber} using bidirectional approach`);
    return await findLinkedIssue(owner, repo, prNumber, token);
  } catch (error) {
    console.error('Error in bidirectional issue lookup:', error);
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
    headers["Authorization"] = `Bearer ${token}`;
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

    // Handle bidirectional linking (PR → Issue and Issue → PR)
    let linkedIssue;
    let linkedPullRequests = [];

    if (token) {
      if (type === "pr") {
        // PR → Issue direction: Find linked issue for this PR
        console.log(`Attempting to find linked issue for PR ${owner}/${repo}#${number}`);
        linkedIssue = await fetchLinkedIssue(owner, repo, number, token);

        // If we found a linked issue, fetch its comments too
        if (linkedIssue) {
          console.log(`Found linked issue #${linkedIssue.number}, fetching its comments...`);

          try {
            // Fetch comments for the linked issue
            const issueCommentsUrl = `${baseUrl}/repos/${owner}/${repo}/issues/${linkedIssue.number}/comments`;
            const issueCommentsResponse = await fetch(issueCommentsUrl, { headers });

            if (issueCommentsResponse.ok) {
              const issueComments = await issueCommentsResponse.json();
              console.log(`Retrieved ${issueComments.length} comments from linked issue #${linkedIssue.number}`);

              // Add comments to the linkedIssue object
              linkedIssue.comments = issueComments;
            } else {
              console.error(`Failed to fetch linked issue comments: ${issueCommentsResponse.status}`);
            }
          } catch (error) {
            console.error("Error fetching linked issue comments:", error);
            // Continue even if comments fetching fails - we'll still have the issue itself
          }
        }
      } else if (type === "issue") {
        // Issue → PR direction: Find PRs that reference this issue
        console.log(`Attempting to find PRs that reference issue ${owner}/${repo}#${number}`);

        // Skip GraphQL for issue→PR direction since it's unreliable
        // Go directly to REST API search which is more effective based on testing
        console.log("Using REST API search to find PRs that mention this issue...");
        try {
          // Look for PRs that mention issue #number
          const searchUrl = `${baseUrl}/search/issues?q=repo:${owner}/${repo}+is:pr+${number}+in:body`;
          const searchResponse = await fetch(searchUrl, { headers });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();

            // Convert search results to match our expected format
            linkedPullRequests = searchData.items
              .filter((item: any) => item.pull_request) // Ensure it's a PR
              .map((item: any) => ({
                number: item.number,
                title: item.title,
                url: item.html_url,
                state: item.state,
                author: { login: item.user.login }
              }));

            console.log(`Found ${linkedPullRequests.length} PRs from search that mention issue #${number}`);
          }
        } catch (error) {
          console.error("Error in REST API search:", error);
        }
      }
    }

    return {
      details,
      comments,
      type,
      linkedIssue,
      linkedPullRequests: linkedPullRequests.length > 0 ? linkedPullRequests : undefined
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

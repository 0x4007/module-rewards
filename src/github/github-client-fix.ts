import { GitHubClient } from "./github-client";
import { FetchedData, LinkedIssue, LinkedPullRequest } from "./types";

/**
 * This is a GitHubClient wrapper that uses composition instead of inheritance.
 * It adds fallback mechanisms for repositories with names that cause issues with GraphQL.
 */
export class GitHubClientWithFallback {
  private readonly githubClient: GitHubClient;
  private readonly githubApiBaseUrl = "https://api.github.com";
  private readonly token?: string;

  constructor(token?: string, webhookSecret?: string) {
    this.token = token;
    this.githubClient = new GitHubClient(token, webhookSecret);
  }

  // Create headers for API requests
  private getApiHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Delegate all standard methods to the wrapped GitHubClient
  public validateWebhook(headers: Record<string, string>, payload: any): boolean {
    return this.githubClient.validateWebhook(headers, payload);
  }

  public normalizeEvent(eventType: string, payload: any): any {
    return this.githubClient.normalizeEvent(eventType, payload);
  }

  public parseUrl(url: string): any {
    return this.githubClient.parseUrl(url);
  }

  public async fetchData(owner: string, repo: string, number: string, type: "pr" | "issue"): Promise<FetchedData> {
    try {
      // Detect environment for consistent logging
      const inProduction =
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";
      const envPrefix = inProduction ? "[PROD]" : "[DEV]";

      // Get the fetch result from the standard client
      const result = await this.githubClient.fetchData(owner, repo, number, type);

      // For issues, ensure we have linked pull requests - even if GraphQL failed
      if (type === "issue" && (!result.linkedPullRequests || result.linkedPullRequests.length === 0)) {
        console.log(`${envPrefix} No linked PRs found from GraphQL, attempting REST fallback...`);
        try {
          // Try the REST fallback regardless of GraphQL outcome
          const linkedPRs = await this.findLinkedPullRequestsWithREST(owner, repo, number);
          if (linkedPRs && linkedPRs.length > 0) {
            console.log(`${envPrefix} REST fallback found ${linkedPRs.length} linked PRs`);
            result.linkedPullRequests = linkedPRs;
          } else {
            console.log(`${envPrefix} No linked PRs found via REST fallback either`);
          }
        } catch (fallbackError) {
          console.error(`${envPrefix} Error in REST fallback for linked PRs:`, fallbackError);
        }
      }

      return result;
    } catch (error) {
      // Handle authentication errors specifically to show token input
      // For authentication errors, we'll pass through but enhance the error message
      // This ensures the error handling in github-api-service.ts will display the auth message
      if (
        error instanceof Error &&
        (error.message.includes("Authentication failed") ||
          error.message.includes("401") ||
          error.message.includes("403"))
      ) {
        console.warn("Authentication error detected in GitHubClientWithFallback");
        // Clear the invalid token from localStorage
        localStorage.removeItem("github_token");

        // Enhance the error with our customized auth message
        const errorDetails = error.message;
        error = new Error("Authentication failed. Please provide a valid GitHub token.");
      }

      // For 404 errors, we may need to try a different endpoint
      if (error instanceof Error && error.message.includes("404")) {
        console.warn(`404 error detected. Type requested: ${type}`);

        // If we were looking for a PR but got 404, try as an issue
        if (type === "pr") {
          try {
            console.log("PR not found, attempting to fetch as an issue instead");
            return await this.fetchData(owner, repo, number, "issue");
          } catch (retryError) {
            console.error("Also failed to fetch as an issue:", retryError);
          }
        }
      }

      // Re-throw the error for upstream handling
      throw error;
    }
  }

  /**
   * Find linked pull requests with automatic fallback to REST API
   */
  public async findLinkedPullRequests(owner: string, repo: string, issueNumber: string): Promise<LinkedPullRequest[]> {
    try {
      // First try the original GraphQL method
      const graphqlResult = await this.githubClient.findLinkedPullRequests(owner, repo, issueNumber);

      // If we got results, return them
      if (graphqlResult && graphqlResult.length > 0) {
        return graphqlResult;
      }

      // If GraphQL returned empty results, try REST API fallback
      console.log(`Falling back to REST API to find linked PRs for issue ${owner}/${repo}#${issueNumber}`);
      return this.findLinkedPullRequestsWithREST(owner, repo, issueNumber);
    } catch (error) {
      console.error("GraphQL error in findLinkedPullRequests, falling back to REST:", error);
      return this.findLinkedPullRequestsWithREST(owner, repo, issueNumber);
    }
  }

  /**
   * Find linked issue with automatic fallback to REST API
   */
  public async findLinkedIssue(owner: string, repo: string, prNumber: string): Promise<LinkedIssue | undefined> {
    try {
      // First try the original GraphQL method
      const graphqlResult = await this.githubClient.findLinkedIssue(owner, repo, prNumber);

      // If we got results, return them
      if (graphqlResult) {
        return graphqlResult;
      }

      // If GraphQL returned no results, try REST API fallback
      console.log(`Falling back to REST API to find linked issue for PR ${owner}/${repo}#${prNumber}`);
      return this.findLinkedIssueWithREST(owner, repo, prNumber);
    } catch (error) {
      console.error("GraphQL error in findLinkedIssue, falling back to REST:", error);
      return this.findLinkedIssueWithREST(owner, repo, prNumber);
    }
  }

  /**
   * Fallback implementation using REST API to find linked pull requests
   */
  private async findLinkedPullRequestsWithREST(
    owner: string,
    repo: string,
    issueNumber: string
  ): Promise<LinkedPullRequest[]> {
    console.log(`Using REST API to find linked PRs for issue ${owner}/${repo}#${issueNumber}`);

    try {
      // First get the issue to extract links from its body
      const issueResponse = await fetch(`${this.githubApiBaseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`, {
        headers: this.getApiHeaders(),
      });

      if (!issueResponse.ok) {
        throw new Error(`Issue request failed: ${issueResponse.status}`);
      }

      const issue = await issueResponse.json();

      // Look for PR references in the issue body
      // This searches for strings like "Closes #123" or "#123" or "owner/repo#123"
      const linkedPRs: LinkedPullRequest[] = [];
      const prRegex =
        /(close[sd]?|fix(e[sd])?|resolve[sd]?)?(\s+)?(#|https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/)(\d+)/gi;
      const crossRepoRegex = /([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)#(\d+)/gi;

      // Extract PR numbers from the issue body
      const prMatches = [...(issue.body || "").matchAll(prRegex)];
      const crossRepoMatches = [...(issue.body || "").matchAll(crossRepoRegex)];

      const prNumbers = new Set<string>();
      const prRequests: Promise<any>[] = [];

      // Handle standard PR references (#123)
      for (const match of prMatches) {
        const prNumber = match[7];
        if (!prNumbers.has(prNumber)) {
          prNumbers.add(prNumber);
          prRequests.push(this.fetchPRDetails(owner, repo, prNumber));
        }
      }

      // Handle cross-repo references (owner/repo#123)
      for (const match of crossRepoMatches) {
        const [, matchOwner, matchRepo, prNumber] = match;
        const key = `${matchOwner}/${matchRepo}#${prNumber}`;
        if (!prNumbers.has(key)) {
          prNumbers.add(key);
          prRequests.push(this.fetchPRDetails(matchOwner, matchRepo, prNumber));
        }
      }

      // Fetch all PR details and add valid results to the list
      const results = await Promise.all(prRequests);
      for (const pr of results) {
        if (pr) {
          linkedPRs.push(pr);
        }
      }

      return linkedPRs;
    } catch (error) {
      console.error("Error in REST fallback for linked PRs:", error);
      return [];
    }
  }

  /**
   * Fallback implementation using REST API to find a linked issue
   */
  private async findLinkedIssueWithREST(
    owner: string,
    repo: string,
    prNumber: string
  ): Promise<LinkedIssue | undefined> {
    console.log(`Using REST API to find linked issue for PR ${owner}/${repo}#${prNumber}`);

    try {
      // Get the PR to extract links from its body
      const prResponse = await fetch(`${this.githubApiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: this.getApiHeaders(),
      });

      if (!prResponse.ok) {
        throw new Error(`PR request failed: ${prResponse.status}`);
      }

      const pr = await prResponse.json();

      // Look for issue references in the PR body
      // This searches for strings like "Closes #123" or "Fixes #123" or "Resolves #123"
      const issueRegex =
        /(close[sd]?|fix(e[sd])?|resolve[sd]?)(\s+)?(#|https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/)(\d+)/gi;
      const crossRepoRegex = /([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)#(\d+)/gi;

      // Extract issue numbers from the PR body
      const matches = [...(pr.body || "").matchAll(issueRegex)];
      const crossRepoMatches = [...(pr.body || "").matchAll(crossRepoRegex)];

      // First try to find references in the same repo
      for (const match of matches) {
        const issueNumber = match[7];
        try {
          const issue = await this.fetchIssueDetails(owner, repo, issueNumber);
          if (issue) {
            return issue;
          }
        } catch (error) {
          console.error(`Error fetching issue #${issueNumber}:`, error);
        }
      }

      // Then check cross-repo references
      for (const match of crossRepoMatches) {
        const [, matchOwner, matchRepo, issueNumber] = match;
        try {
          const issue = await this.fetchIssueDetails(matchOwner, matchRepo, issueNumber);
          if (issue) {
            return issue;
          }
        } catch (error) {
          console.error(`Error fetching issue ${matchOwner}/${matchRepo}#${issueNumber}:`, error);
        }
      }

      // If no matches found in the body, check the PR title
      // Often PRs are titled like "Fix #123: Description"
      const titleRegex = /(close[sd]?|fix(e[sd])?|resolve[sd]?)(\s+)?#(\d+)/i;
      const titleMatch = pr.title.match(titleRegex);

      if (titleMatch) {
        const issueNumber = titleMatch[4];
        try {
          const issue = await this.fetchIssueDetails(owner, repo, issueNumber);
          if (issue) {
            return issue;
          }
        } catch (error) {
          console.error(`Error fetching issue #${issueNumber} from title:`, error);
        }
      }

      return undefined;
    } catch (error) {
      console.error("Error in REST fallback for linked issue:", error);
      return undefined;
    }
  }

  /**
   * Helper to fetch PR details using the REST API
   */
  private async fetchPRDetails(owner: string, repo: string, prNumber: string): Promise<LinkedPullRequest | null> {
    try {
      const response = await fetch(`${this.githubApiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: this.getApiHeaders(),
      });

      if (!response.ok) {
        console.log(`PR ${owner}/${repo}#${prNumber} not found or not accessible`);
        return null;
      }

      const pr = await response.json();

      return {
        number: pr.number,
        title: pr.title || "No title",
        url: pr.html_url,
        state: pr.state?.toLowerCase() || "unknown",
        body: pr.body || "",
        author: {
          login: pr.user?.login || "unknown",
          html_url: pr.user?.html_url || "",
          avatar_url: pr.user?.avatar_url || "",
        },
        repository: {
          owner: {
            login: owner,
          },
          name: repo,
        },
      };
    } catch (error) {
      console.error(`Error fetching PR ${owner}/${repo}#${prNumber}:`, error);
      return null;
    }
  }

  /**
   * Helper to fetch issue details using the REST API
   */
  private async fetchIssueDetails(owner: string, repo: string, issueNumber: string): Promise<LinkedIssue | undefined> {
    try {
      const response = await fetch(`${this.githubApiBaseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`, {
        headers: this.getApiHeaders(),
      });

      if (!response.ok) {
        console.log(`Issue ${owner}/${repo}#${issueNumber} not found or not accessible`);
        return undefined;
      }

      const issue = await response.json();

      // Check if this is actually an issue (not a PR)
      if (issue.pull_request) {
        console.log(`${owner}/${repo}#${issueNumber} is a pull request, not an issue`);
        return undefined;
      }

      return {
        number: issue.number,
        title: issue.title || "No title",
        body: issue.body || "",
        html_url: issue.html_url,
        repository: {
          owner: owner,
          name: repo,
        },
      };
    } catch (error) {
      console.error(`Error fetching issue ${owner}/${repo}#${issueNumber}:`, error);
      return undefined;
    }
  }
}

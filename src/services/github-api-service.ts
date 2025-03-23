/**
 * GitHub API Service - Centralized handling of GitHub API requests
 * Includes caching and error handling
 */
import { GitHubClient } from "../github/github-client";
import { FetchedData, UrlParseResult } from "../github/types";

class GitHubApiService {
  private client: GitHubClient;
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly token?: string;

  constructor(token: string | null | undefined = null) {
    this.token = token || undefined;
    this.client = new GitHubClient(this.token);
  }

  /**
   * Parse a GitHub URL to extract owner, repo, number and type
   */
  public parseUrl(url: string): UrlParseResult {
    return this.client.parseUrl(url);
  }

  /**
   * Fetch data from GitHub API with caching
   */
  public async fetchData(owner: string, repo: string, number: string, type: "pr" | "issue"): Promise<FetchedData> {
    // Detect environment
    const inProduction = typeof window !== 'undefined' &&
                        window.location.hostname !== "localhost" &&
                        window.location.hostname !== "127.0.0.1";
    const debugPrefix = inProduction ? '[PROD]' : '[DEV]';

    // Check for GH token in production
    if (inProduction && !this.token) {
      console.warn(`${debugPrefix} No GitHub token available for API requests in production.`);
      console.log(`${debugPrefix} Some features may be limited due to GitHub API rate limits.`);
    }

    // Set up cache keys
    const cacheKey = `data-${owner}-${repo}-${type}-${number}`;
    const cachedTimestampKey = `${cacheKey}-timestamp`;

    let data: FetchedData | null = null;

    // Check cache first
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cachedTimestampKey);
    const cacheExpired = !cachedTimestamp || Date.now() - parseInt(cachedTimestamp) > this.CACHE_EXPIRY;

    // Use cached data if available and fresh
    if (cachedData && !cacheExpired) {
      console.log(`${debugPrefix} Using cached data for ${owner}/${repo}/${type}/${number}`);
      data = JSON.parse(cachedData) as FetchedData;
      return data;
    }

    try {
      console.log(`${debugPrefix} Fetching fresh data for ${owner}/${repo}/${type}/${number}`);
      // Fetch fresh data
      const freshData = await this.client.fetchData(owner, repo, number, type);

      // Cache the fresh data
      console.log(`${debugPrefix} Caching successful API response`);
      localStorage.setItem(cacheKey, JSON.stringify(freshData));
      localStorage.setItem(cachedTimestampKey, Date.now().toString());

      return freshData;
    } catch (error) {
      // Special handling for auth errors
      if (error instanceof Error && error.message.includes('Authentication failed')) {
        console.error(`${debugPrefix} Authentication error: ${error.message}`);
        localStorage.removeItem('github_token'); // Remove invalid token

        if (inProduction) {
          // In production, create a minimal response with error information
          // This prevents the UI from breaking completely
          const errorData: FetchedData = {
            details: {
              title: `${type.toUpperCase()} #${number}`,
              body: "Unable to load content - GitHub API authentication required.",
              number: parseInt(number),
              html_url: `https://github.com/${owner}/${repo}/${type === 'pr' ? 'pull' : 'issue'}/${number}`,
              user: {
                login: "anonymous",
                html_url: "",
                avatar_url: ""
              }
            },
            comments: [],
            type,
            linkedIssue: undefined,
            linkedPullRequests: []
          };

          return errorData;
        }
      }

      // If we have expired cached data, still use that in case of error
      if (cachedData) {
        console.warn(`${debugPrefix} Using expired cache due to API error:`, error);
        return JSON.parse(cachedData);
      }

      // Otherwise, propagate the error
      console.error(`${debugPrefix} API request failed with no fallback cache:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Check if content has meaningfully changed between data fetches
   */
  public hasContentChanged(oldData: FetchedData, newData: FetchedData): boolean {
    // Compare basic properties
    if (oldData.details.title !== newData.details.title || oldData.details.body !== newData.details.body) {
      return true;
    }

    // Compare comment counts
    if (oldData.comments.length !== newData.comments.length) {
      return true;
    }

    // Could add more sophisticated comparison here
    return false;
  }

  /**
   * Background refresh of cached data
   */
  public async refreshCachedData(
    owner: string,
    repo: string,
    number: string,
    type: "pr" | "issue"
  ): Promise<{ updated: boolean; data: FetchedData } | null> {
    try {
      // Set up cache keys
      const cacheKey = `data-${owner}-${repo}-${type}-${number}`;

      // Get cached data
      const cachedData = localStorage.getItem(cacheKey);
      if (!cachedData) return null;

      const oldData = JSON.parse(cachedData) as FetchedData;

      // Fetch fresh data
      const freshData = await this.client.fetchData(owner, repo, number, type);

      // Check if content changed
      const updated = this.hasContentChanged(oldData, freshData);

      if (updated) {
        // Update cache with fresh data
        localStorage.setItem(cacheKey, JSON.stringify(freshData));
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
      }

      return { updated, data: freshData };
    } catch (error) {
      console.error("Background refresh failed:", error);
      return null;
    }
  }
}

// Export singleton instance with token from localStorage
export const githubApiService = new GitHubApiService(localStorage.getItem("github_token"));

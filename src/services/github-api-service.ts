/**
 * GitHub API Service - Centralized handling of GitHub API requests
 * Includes caching and error handling
 *
 * Uses GitHubClientWithFallback to handle repositories with dot-prefixed names that cause GraphQL API issues
 */
import { createAuthMessage } from "../dom-utils/auth-handler";
import { GitHubClientWithFallback } from "../github/github-client-fix";
import { FetchedData, UrlParseResult } from "../github/types";

class GitHubApiService {
  private client: GitHubClientWithFallback;
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly token?: string;

  constructor(token: string | null | undefined = null) {
    this.token = token || undefined;
    // Use the enhanced client that can handle dot-prefixed repositories
    this.client = new GitHubClientWithFallback(this.token);

    // Log information about the token
    const inProduction =
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";
    const envPrefix = inProduction ? "[PROD]" : "[DEV]";

    console.log(`${envPrefix} GitHub API Service initialized with token: ${this.token ? "YES" : "NO"}`);
    if (this.token) {
      console.log(`${envPrefix} Token length: ${this.token.length}, first chars: ${this.token.substring(0, 4)}`);
    }
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
    // Detect environment consistently
    const inProduction =
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";
    const envPrefix = inProduction ? "[PROD]" : "[DEV]";

    // More detailed token diagnostic info
    if (inProduction) {
      if (!this.token) {
        console.warn(`${envPrefix} No GitHub token available for API requests in production.`);
        console.log(`${envPrefix} Some features may be limited due to GitHub API rate limits.`);

        // Add prompt for token in console to help users troubleshoot
        console.log(`${envPrefix} To use full features, click "Log in with GitHub" or run forceTokenInput() in console`);
      } else {
        console.log(`${envPrefix} GitHub API authenticated with token (${this.token.substring(0, 4)}...)`);
      }
    }

    // Set up cache keys with token awareness (different cache for authenticated vs non-authenticated)
    // This ensures we don't use limited non-auth data when authenticated, and vice versa
    const authState = this.token ? "auth" : "noauth";
    const cacheKey = `data-${owner}-${repo}-${type}-${number}-${authState}`;
    const cacheVersionKey = `${cacheKey}-version`;
    const cachedTimestampKey = `${cacheKey}-timestamp`;
    const CURRENT_CACHE_VERSION = "3"; // Increment when data structure changes

    let data: FetchedData | null = null;

    // Check cache first
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cachedTimestampKey);
    const cachedVersion = localStorage.getItem(cacheVersionKey) || "1";

    // Cache is expired if:
    // - No timestamp
    // - Timestamp is older than cache expiry time
    // - Cache version is not current
    const cacheExpired =
      !cachedTimestamp ||
      Date.now() - parseInt(cachedTimestamp) > this.CACHE_EXPIRY ||
      cachedVersion !== CURRENT_CACHE_VERSION;

    // Clear cache if version mismatch
    if (cachedData && cachedVersion !== CURRENT_CACHE_VERSION) {
      console.log(`${envPrefix} Cache version mismatch, clearing cache for ${owner}/${repo}/${type}/${number}`);
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(cachedTimestampKey);
      localStorage.removeItem(cacheVersionKey);
    }

    // Use cached data if available and fresh
    if (cachedData && !cacheExpired) {
      console.log(`${envPrefix} Using cached data for ${owner}/${repo}/${type}/${number}`);
      try {
        data = JSON.parse(cachedData) as FetchedData;

        // Enhanced cache validation for Issue data
        if (type === "issue") {
          let cacheValid = true;

          // Check linkedPullRequests exists
          if (!data.linkedPullRequests) {
            console.warn(`${envPrefix} Cache integrity error: missing linkedPullRequests for issue ${number}`);
            cacheValid = false;
          }
          // Special validation for issue #30 that seems problematic
          else if (number === "30") {
            console.log(`${envPrefix} Special validation for issue #30`);
            // For issue #30, enforce fresh fetch to ensure latest linked PRs
            console.log(`${envPrefix} Forcing fresh fetch for issue #30 to ensure accurate linked PRs`);
            cacheValid = false;
          }

          if (!cacheValid) {
            console.log(`${envPrefix} Cache validation failed, fetching fresh data`);
            // Continue to fetch fresh data by not returning early
          } else {
            return data;
          }
        } else {
          // For PRs, just return the cached data
          return data;
        }
      } catch (error) {
        console.error(`${envPrefix} Cache parse error:`, error);
        // Continue to fetch fresh data
      }
    }

    try {
      console.log(`${envPrefix} Fetching fresh data for ${owner}/${repo}/${type}/${number}`);

      // Special logging for issue #30
      if (type === "issue" && number === "30") {
        console.log(`${envPrefix} Starting fetch for issue #30, token available: ${Boolean(this.token)}`);
      }

      // Fetch fresh data
      const freshData = await this.client.fetchData(owner, repo, number, type);

      // Extra validation for issue with linked PRs
      if (type === "issue") {
        if (!freshData.linkedPullRequests) {
          console.warn(`${envPrefix} API returned no linkedPullRequests array for issue ${number}`);
          // Initialize an empty array to prevent null errors
          freshData.linkedPullRequests = [];
        }

        // Log linked PRs for debugging
        const prCount = freshData.linkedPullRequests.length;
        console.log(`${envPrefix} Issue ${number} has ${prCount} linked PR(s): ${
          prCount > 0
            ? freshData.linkedPullRequests.map(pr => `#${pr.number}`).join(", ")
            : "None"
        }`);
      }

      // Cache the fresh data
      console.log(`${envPrefix} Caching successful API response`);
      localStorage.setItem(cacheKey, JSON.stringify(freshData));
      localStorage.setItem(cachedTimestampKey, Date.now().toString());
      localStorage.setItem(cacheVersionKey, CURRENT_CACHE_VERSION);

      return freshData;
    } catch (error) {
      // Handle all API errors with a nice fallback
      console.error(`${envPrefix} API error:`, error);

      // Clear any invalid token
      if (
        error instanceof Error &&
        (error.message.includes("Authentication failed") ||
          error.message.includes("401") ||
          error.message.includes("403"))
      ) {
        console.warn(`${envPrefix} Detected authentication error - removing invalid token`);
        localStorage.removeItem("github_token");
      }

      // Create a minimal response with error information in any environment
      // This prevents UI from breaking completely
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorData: FetchedData = {
        details: {
          title: `${type.toUpperCase()} #${number}`,
          body: inProduction ? createAuthMessage(errorMessage) : "## API Request Failed\n\nError: " + errorMessage,
          number: parseInt(number),
          html_url: `https://github.com/${owner}/${repo}/${type === "pr" ? "pull" : "issue"}/${number}`,
          user: {
            login: "system",
            html_url: "",
            avatar_url: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
          },
        },
        comments: [],
        type,
        linkedIssue: undefined,
        linkedPullRequests: [],
      };

      // If we have cached data (even expired), still prefer that over the error message
      if (cachedData) {
        try {
          console.warn(`${envPrefix} Using expired cache due to API error`);
          const parsedData = JSON.parse(cachedData) as FetchedData;
          return parsedData;
        } catch (parseError) {
          console.error(`${envPrefix} Failed to parse cached data:`, parseError);
          // Continue to return error data if parsing fails
        }
      }

      return errorData;
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
    // Detect environment consistently
    const inProduction =
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";
    const envPrefix = inProduction ? "[PROD]" : "[DEV]";

    try {
      // Set up cache keys with token awareness (matching fetchData)
      const authState = this.token ? "auth" : "noauth";
      const cacheKey = `data-${owner}-${repo}-${type}-${number}-${authState}`;
      const cacheVersionKey = `${cacheKey}-version`;
      const cachedTimestampKey = `${cacheKey}-timestamp`;
      const CURRENT_CACHE_VERSION = "3"; // Keep in sync with fetchData

      // Get cached data
      const cachedData = localStorage.getItem(cacheKey);
      if (!cachedData) {
        console.log(`${envPrefix} No cached data to refresh for ${owner}/${repo}/${type}/${number}`);
        return null;
      }

      // Special check for issue #30
      if (type === "issue" && number === "30") {
        console.log(`${envPrefix} Special handling for issue #30 background refresh`);
      }

      try {
        const oldData = JSON.parse(cachedData) as FetchedData;

        // Fetch fresh data
        const freshData = await this.client.fetchData(owner, repo, number, type);

        // Check if content changed
        const updated = this.hasContentChanged(oldData, freshData);

        if (updated) {
          console.log(`${envPrefix} Content changed, updating cache for ${owner}/${repo}/${type}/${number}`);
          // Update cache with fresh data
          localStorage.setItem(cacheKey, JSON.stringify(freshData));
          localStorage.setItem(cachedTimestampKey, Date.now().toString());
          localStorage.setItem(cacheVersionKey, CURRENT_CACHE_VERSION);
        } else {
          console.log(`${envPrefix} No content changes detected during refresh for ${owner}/${repo}/${type}/${number}`);
          // Just update timestamp to extend cache life
          localStorage.setItem(cachedTimestampKey, Date.now().toString());
        }

        return { updated, data: freshData };
      } catch (parseError) {
        console.error(`${envPrefix} Failed to parse cached data during refresh:`, parseError);
        // Continue with fetch but don't compare
        const freshData = await this.client.fetchData(owner, repo, number, type);

        // Save new data
        localStorage.setItem(cacheKey, JSON.stringify(freshData));
        localStorage.setItem(cachedTimestampKey, Date.now().toString());
        localStorage.setItem(cacheVersionKey, CURRENT_CACHE_VERSION);

        return { updated: true, data: freshData };
      }
    } catch (error) {
      console.error(`${envPrefix} Background refresh failed:`, error);
      return null;
    }
  }
}

// Export singleton instance with token from localStorage
export const githubApiService = new GitHubApiService(localStorage.getItem("github_token"));

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
    // Detect environment consistently
    const inProduction = typeof window !== 'undefined' &&
                        window.location.hostname !== "localhost" &&
                        window.location.hostname !== "127.0.0.1";
    const envPrefix = inProduction ? '[PROD]' : '[DEV]';

    // Check for GH token in production
    if (inProduction && !this.token) {
      console.warn(`${envPrefix} No GitHub token available for API requests in production.`);
      console.log(`${envPrefix} Some features may be limited due to GitHub API rate limits.`);
    }

    // Set up cache keys
    const cacheKey = `data-${owner}-${repo}-${type}-${number}`;
    const cacheVersionKey = `${cacheKey}-version`;
    const cachedTimestampKey = `${cacheKey}-timestamp`;
    const CURRENT_CACHE_VERSION = '2'; // Increment when data structure changes

    let data: FetchedData | null = null;

    // Check cache first
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cachedTimestampKey);
    const cachedVersion = localStorage.getItem(cacheVersionKey) || '1';

    // Cache is expired if:
    // - No timestamp
    // - Timestamp is older than cache expiry time
    // - Cache version is not current
    const cacheExpired = !cachedTimestamp ||
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

        // Verify cache has expected structure
        if (type === 'issue' && !data.linkedPullRequests) {
          console.warn(`${envPrefix} Cache integrity error: missing linkedPullRequests for issue ${number}`);
          // Continue to fetch fresh data
        } else {
          return data;
        }
      } catch (error) {
        console.error(`${envPrefix} Cache parse error:`, error);
        // Continue to fetch fresh data
      }
    }

    try {
      console.log(`${envPrefix} Fetching fresh data for ${owner}/${repo}/${type}/${number}`);
      // Fetch fresh data
      const freshData = await this.client.fetchData(owner, repo, number, type);

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
      if (error instanceof Error &&
          (error.message.includes('Authentication failed') ||
           error.message.includes('401') ||
           error.message.includes('403'))) {
        console.warn(`${envPrefix} Detected authentication error - removing invalid token`);
        localStorage.removeItem('github_token');
      }

      // Create a minimal response with error information in any environment
      // This prevents UI from breaking completely
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorData: FetchedData = {
        details: {
          title: `${type.toUpperCase()} #${number}`,
          body: inProduction
            ? "## GitHub Authentication Required\n\n" +
              "To view this content, you need to provide a GitHub personal access token.\n\n" +
              "<div class='auth-error-actions'>\n" +
              "  <button class='auth-token-button' onclick=\"window.open('/token-input.html', 'github_token', 'width=600,height=700')\">Add GitHub Token</button>\n" +
              "</div>\n\n" +
              "Error details: " + errorMessage
            : "## API Request Failed\n\nError: " + errorMessage,
          number: parseInt(number),
          html_url: `https://github.com/${owner}/${repo}/${type === 'pr' ? 'pull' : 'issue'}/${number}`,
          user: {
            login: "system",
            html_url: "",
            avatar_url: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
          }
        },
        comments: [],
        type,
        linkedIssue: undefined,
        linkedPullRequests: []
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
    const inProduction = typeof window !== 'undefined' &&
                        window.location.hostname !== "localhost" &&
                        window.location.hostname !== "127.0.0.1";
    const envPrefix = inProduction ? '[PROD]' : '[DEV]';

    try {
      // Set up cache keys
      const cacheKey = `data-${owner}-${repo}-${type}-${number}`;
      const cacheVersionKey = `${cacheKey}-version`;
      const cachedTimestampKey = `${cacheKey}-timestamp`;
      const CURRENT_CACHE_VERSION = '2'; // Keep in sync with fetchData

      // Get cached data
      const cachedData = localStorage.getItem(cacheKey);
      if (!cachedData) {
        console.log(`${envPrefix} No cached data to refresh for ${owner}/${repo}/${type}/${number}`);
        return null;
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

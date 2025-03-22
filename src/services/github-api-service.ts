/**
 * GitHub API Service - Centralized handling of GitHub API requests
 * Includes caching and error handling
 */
import { GitHubClient } from "../github/github-client";
import { FetchedData, UrlParseResult } from "../github/types";

export class GitHubApiService {
  private client: GitHubClient;
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  constructor(token: string | null | undefined = null) {
    this.client = new GitHubClient(token || undefined);
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
  public async fetchData(
    owner: string,
    repo: string,
    number: string,
    type: "pr" | "issue"
  ): Promise<FetchedData> {
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
      data = JSON.parse(cachedData) as FetchedData;
      return data;
    }

    try {
      // Fetch fresh data
      const freshData = await this.client.fetchData(owner, repo, number, type);

      // Cache the fresh data
      localStorage.setItem(cacheKey, JSON.stringify(freshData));
      localStorage.setItem(cachedTimestampKey, Date.now().toString());

      return freshData;
    } catch (error) {
      // If we have expired cached data, still use that in case of error
      if (cachedData) {
        console.warn("Using expired cache due to API error:", error);
        return JSON.parse(cachedData);
      }

      // Otherwise, propagate the error
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

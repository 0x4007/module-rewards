/**
 * GitHub API Service - Centralized handling of GitHub API requests
 * Includes caching and error handling
 */
import { parseGitHubUrl } from "../github/browser-utils";
import { UrlParseResult } from "../github/types";

export interface FetchedData {
  details: any;
  comments: any[];
  type: "pr" | "issue";
  linkedIssue?: any;
  linkedPullRequests?: any[];
}

export interface LinkedPullRequest {
  id?: string;
  number: number;
  title: string;
  url: string;
  state: string;
  author: {
    login: string;
    html_url?: string;
    avatar_url?: string;
  };
  repository?: {
    owner: {
      login: string;
    };
    name: string;
  };
  body?: string;
  comments?: any[];
}

export interface LinkedIssue {
  number: number;
  title: string;
  body: string;
  html_url: string;
  comments?: any[];
  repository?: {
    owner: string;
    name: string;
  };
}

class GitHubApiService {
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly token?: string;

  constructor(token: string | null | undefined = null) {
    this.token = token || undefined;
  }

  /**
   * Parse a GitHub URL to extract owner, repo, number and type
   */
  public parseUrl(url: string): UrlParseResult | null {
    return parseGitHubUrl(url);
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

      // Prepare API URL
      const itemType = type === 'pr' ? 'pulls' : 'issues';
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/${itemType}/${number}`;

      // Set up headers with authorization if token available
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      // Fetch main resource (PR or Issue)
      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const itemData = await response.json();

      // Fetch comments
      const commentsUrl = `${apiUrl}/comments`;
      const commentsResponse = await fetch(commentsUrl, { headers });

      if (!commentsResponse.ok) {
        throw new Error(`GitHub API error fetching comments: ${commentsResponse.status}`);
      }

      const commentsData = await commentsResponse.json();

      // Create result object
      const result: FetchedData = {
        details: itemData,
        comments: commentsData,
        type
      };

      // If this is a PR, try to find linked issue
      if (type === 'pr') {
        const linkedIssue = await this.findLinkedIssue(owner, repo, itemData);
        if (linkedIssue) {
          result.linkedIssue = linkedIssue;
        }
      }
      // If this is an issue, try to find linked PRs
      else {
        const linkedPRs = await this.findLinkedPullRequests(owner, repo, number);
        if (linkedPRs && linkedPRs.length > 0) {
          result.linkedPullRequests = linkedPRs;
        }
      }

      // Cache the fresh data
      console.log(`${envPrefix} Caching successful API response`);
      localStorage.setItem(cacheKey, JSON.stringify(result));
      localStorage.setItem(cachedTimestampKey, Date.now().toString());
      localStorage.setItem(cacheVersionKey, CURRENT_CACHE_VERSION);

      return result;
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
   * Find linked issue for a PR
   * Uses PR body text to identify linked issues through common patterns like "Fixes #123"
   */
  private async findLinkedIssue(owner: string, repo: string, prData: any): Promise<LinkedIssue | undefined> {
    // Common patterns for linked issues in PR descriptions
    const patterns = [
      /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi,
      /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+(?:https?:\/\/github\.com\/)?([^\/]+)\/([^\/]+)\/issues\/(\d+)/gi
    ];

    const body = prData.body || '';
    let issueNumber: string | null = null;

    // Check for patterns in PR body
    for (const pattern of patterns) {
      const match = pattern.exec(body);
      if (match) {
        // Extract issue number from match
        issueNumber = match[1];
        break;
      }
    }

    if (!issueNumber) {
      return undefined;
    }

    try {
      // Fetch issue details
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const issueResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, { headers });

      if (!issueResponse.ok) {
        return undefined;
      }

      const issueData = await issueResponse.json();

      // Fetch issue comments
      const commentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { headers });
      const commentsData = commentsResponse.ok ? await commentsResponse.json() : [];

      return {
        number: issueData.number,
        title: issueData.title,
        body: issueData.body || '',
        html_url: issueData.html_url,
        comments: commentsData,
        repository: {
          owner: owner,
          name: repo
        }
      };
    } catch (error) {
      console.error('Error fetching linked issue:', error);
      return undefined;
    }
  }

  /**
   * Find linked pull requests for an issue
   * Uses GitHub search API to find PRs that mention the issue
   */
  private async findLinkedPullRequests(owner: string, repo: string, issueNumber: string): Promise<LinkedPullRequest[]> {
    const linkedPRs: LinkedPullRequest[] = [];

    try {
      // Set up headers with authorization if token available
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      // Search for PRs that mention the issue
      const searchUrl = `https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:pr+${issueNumber}+in:body`;
      const searchResponse = await fetch(searchUrl, { headers });

      if (!searchResponse.ok) {
        return linkedPRs;
      }

      const searchData = await searchResponse.json();

      if (!searchData.items || searchData.items.length === 0) {
        return linkedPRs;
      }

      // Process each PR from search results
      for (const item of searchData.items) {
        const prNumber = item.number;

        // Get full PR data
        const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
        const prResponse = await fetch(prUrl, { headers });

        if (!prResponse.ok) {
          continue;
        }

        const prData = await prResponse.json();

        // Get PR comments
        const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
        const commentsResponse = await fetch(commentsUrl, { headers });
        const commentsData = commentsResponse.ok ? await commentsResponse.json() : [];

        linkedPRs.push({
          id: prData.id,
          number: prData.number,
          title: prData.title,
          url: prData.html_url,
          state: prData.merged_at ? 'merged' : prData.state,
          author: {
            login: prData.user.login,
            html_url: prData.user.html_url,
            avatar_url: prData.user.avatar_url
          },
          repository: {
            owner: {
              login: owner
            },
            name: repo
          },
          body: prData.body,
          comments: commentsData
        });
      }

      return linkedPRs;
    } catch (error) {
      console.error('Error finding linked PRs:', error);
      return linkedPRs;
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
        const freshData = await this.fetchData(owner, repo, number, type);

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
        const freshData = await this.fetchData(owner, repo, number, type);

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

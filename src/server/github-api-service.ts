/**
 * Server-side GitHub API Service
 * Handles GitHub API requests from the server
 */
import fetch from 'node-fetch';

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

export interface UrlParseResult {
  owner: string;
  repo: string;
  type: "pr" | "issue";
  number: string;
}

export class ServerGitHubApiService {
  private readonly token?: string;

  constructor(token: string | null | undefined = null) {
    this.token = token || undefined;
  }

  /**
   * Parse a GitHub URL to extract owner, repo, number and type
   */
  public parseUrl(url: string): UrlParseResult | null {
    try {
      // Regular expressions to match GitHub PR and issue URLs
      const prRegex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
      const issueRegex = /github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/;

      let match = prRegex.exec(url);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          type: "pr",
          number: match[3]
        };
      }

      match = issueRegex.exec(url);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          type: "issue",
          number: match[3]
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing GitHub URL:', error);
      return null;
    }
  }

  /**
   * Fetch data from GitHub API
   */
  public async fetchData(owner: string, repo: string, number: string, type: "pr" | "issue"): Promise<FetchedData> {
    try {
      console.log(`[SERVER] Fetching data for ${owner}/${repo}/${type}/${number}`);

      // Prepare API URL
      const itemType = type === 'pr' ? 'pulls' : 'issues';
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/${itemType}/${number}`;

      // Set up headers with authorization if token available
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Analyzer-Server'
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      // Fetch main resource (PR or Issue)
      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const itemData = await response.json() as any;

      // Fetch comments
      const commentsUrl = `${apiUrl}/comments`;
      const commentsResponse = await fetch(commentsUrl, { headers });

      if (!commentsResponse.ok) {
        throw new Error(`GitHub API error fetching comments: ${commentsResponse.status}`);
      }

      const commentsData = await commentsResponse.json() as any[];

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

      return result;
    } catch (error) {
      // Handle all API errors
      console.error(`[SERVER] API error:`, error);

      // Create a minimal response with error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorData: FetchedData = {
        details: {
          title: `${type.toUpperCase()} #${number}`,
          body: "## GitHub API Request Failed\n\nError: " + errorMessage,
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
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Analyzer-Server'
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const issueResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, { headers });

      if (!issueResponse.ok) {
        return undefined;
      }

      const issueData = await issueResponse.json() as any;

      // Fetch issue comments
      const commentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { headers });
      const commentsData = commentsResponse.ok ? await commentsResponse.json() as any[] : [];

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
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Analyzer-Server'
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

      const searchData = await searchResponse.json() as any;

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

        const prData = await prResponse.json() as any;

        // Get PR comments
        const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
        const commentsResponse = await fetch(commentsUrl, { headers });
        const commentsData = commentsResponse.ok ? await commentsResponse.json() as any[] : [];

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
}

// Export factory function to create server GitHub API service instance
export function createServerGitHubApiService(token: string | null = null): ServerGitHubApiService {
  return new ServerGitHubApiService(token);
}

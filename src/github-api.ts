import { PRData, PRParseResult } from './types';

/**
 * Parse a GitHub PR URL into its components
 */
export function parsePrUrl(url: string): PRParseResult {
  try {
    // Handle different URL formats
    // Example formats:
    // https://github.com/owner/repo/pull/123
    // https://github.com/owner/repo/pulls/123
    const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pulls?\/(\d+)/;
    const match = url.match(regex);

    if (!match) {
      throw new Error('Invalid GitHub PR URL format');
    }

    return {
      owner: match[1],
      repo: match[2],
      number: match[3]
    };
  } catch (error) {
    throw new Error(`Could not parse GitHub PR URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch data from GitHub API for a specific PR
 */
export async function fetchGitHubData(owner: string, repo: string, prNumber: string, token?: string): Promise<PRData> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  // Base GitHub API URL
  const baseUrl = 'https://api.github.com';

  try {
    // Fetch PR details
    const prResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers }
    );

    if (!prResponse.ok) {
      if (prResponse.status === 401 || prResponse.status === 403) {
        // Handle auth errors
        throw new Error('Authentication failed. Please provide a valid GitHub token.');
      } else if (prResponse.status === 404) {
        throw new Error('PR not found. Check the URL or your access permissions.');
      } else {
        throw new Error(`GitHub API error: ${prResponse.status}`);
      }
    }

    const prDetails = await prResponse.json();

    // Fetch PR comments
    const commentsResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      { headers }
    );

    if (!commentsResponse.ok) {
      throw new Error(`Failed to fetch PR comments: ${commentsResponse.status}`);
    }

    const prComments = await commentsResponse.json();

    // Fetch issue comments
    const issueCommentsResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { headers }
    );

    if (!issueCommentsResponse.ok) {
      throw new Error(`Failed to fetch issue comments: ${issueCommentsResponse.status}`);
    }

    const issueComments = await issueCommentsResponse.json();

    return {
      prDetails,
      prComments,
      issueComments
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

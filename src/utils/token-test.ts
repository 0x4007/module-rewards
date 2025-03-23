/**
 * Token test utility - Use this to verify the token input functionality is working correctly
 * Enhanced for better user experience when troubleshooting token issues
 */
import { clearGitHubToken, showTokenInput } from "../dom-utils";
import { GitHubClientWithFallback } from "../github/github-client-fix";

/**
 * Test the GitHub token by making a simple API request
 * This will trigger the token input UI if the token is invalid
 */
export async function testGithubToken(): Promise<boolean> {
  // Detect environment for consistent formatting
  const inProduction =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";
  const envPrefix = inProduction ? "[PROD]" : "[DEV]";

  console.log(`${envPrefix} Testing GitHub token...`);

  // Get token from localStorage
  const token = localStorage.getItem("github_token");
  console.log(`${envPrefix} Token in localStorage: ${token ? "YES (length: " + token.length + ")" : "NO"}`);

  try {
    // Initialize GitHub client with token
    const client = new GitHubClientWithFallback(token || undefined);

    // Try to access the authenticated user endpoint
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      // If not authenticated, show appropriate message and token input
      console.error(`${envPrefix} Token authentication failed: ${userResponse.status} ${userResponse.statusText}`);

      if (userResponse.status === 401 || userResponse.status === 403) {
        console.log(`${envPrefix} 🔑 Please provide a valid GitHub token to enable full API access`);
        console.log(`${envPrefix} 🔑 This will allow viewing linked pull requests and other GitHub content`);

        // Show token input dialog
        showTokenInput();
        return false;
      }

      throw new Error(`GitHub API error: ${userResponse.status} ${userResponse.statusText}`);
    }

    // Successfully authenticated
    const userData = await userResponse.json();
    console.log(`${envPrefix} ✅ Successfully authenticated as: ${userData.login}`);

    // Show confirmation with rate limit information
    try {
      const rateLimitResponse = await fetch("https://api.github.com/rate_limit", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (rateLimitResponse.ok) {
        const rateLimit = await rateLimitResponse.json();
        const coreLimit = rateLimit.resources.core;
        console.log(`${envPrefix} Rate limit: ${coreLimit.remaining}/${coreLimit.limit} requests remaining`);

        // Alert with more information
        alert(`GitHub token valid!
Authenticated as: ${userData.login}
Rate limit: ${coreLimit.remaining}/${coreLimit.limit} requests remaining

Your token is now active and you should be able to view linked pull requests and other GitHub content.`);
      } else {
        alert(`GitHub token valid! Authenticated as: ${userData.login}`);
      }
    } catch (rateLimitError) {
      // If rate limit check fails, just show basic confirmation
      alert(`GitHub token valid! Authenticated as: ${userData.login}`);
    }

    return true;
  } catch (error) {
    console.error(`${envPrefix} Error testing token:`, error);
    alert(`Error testing GitHub token: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Force token input dialog to appear (useful for manual testing)
 */
export function forceTokenInput(): void {
  clearGitHubToken();
  showTokenInput();
  console.log("💡 GitHub token input dialog opened. Please provide a valid token with 'repo' scope.");
}

/**
 * This is a special function for checking linked PRs specifically
 * Useful when troubleshooting issues with linked PRs not showing up
 */
export async function checkLinkedPRs(issueUrl: string = ""): Promise<void> {
  // If no URL provided, try to get from URL input field
  if (!issueUrl && document.querySelector("#urlInput")) {
    issueUrl = (document.querySelector("#urlInput") as HTMLInputElement).value;
  }

  if (!issueUrl) {
    alert("Please provide an issue URL to check for linked PRs");
    return;
  }

  try {
    // Clear existing cache for this issue
    console.log("🧹 Clearing cache for this issue to ensure fresh data");

    // Extract owner/repo/number from URL
    const match = issueUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i);
    if (!match) {
      alert("Invalid GitHub issue URL format. Please use a URL like: https://github.com/owner/repo/issues/123");
      return;
    }

    const [, owner, repo, number] = match;

    // Clear all caches that might affect this issue
    const authStates = ["auth", "noauth"];
    for (const authState of authStates) {
      const cacheKey = `data-${owner}-${repo}-issue-${number}-${authState}`;
      const timestampKey = `${cacheKey}-timestamp`;
      const versionKey = `${cacheKey}-version`;

      localStorage.removeItem(cacheKey);
      localStorage.removeItem(timestampKey);
      localStorage.removeItem(versionKey);
    }

    console.log(`Cache cleared for issue ${owner}/${repo}#${number}`);

    // Refresh the page to force re-fetching
    alert(`Cache cleared for issue ${owner}/${repo}#${number}. The page will now reload to fetch fresh data.`);
    window.location.reload();
  } catch (error) {
    console.error("Error checking linked PRs:", error);
    alert(`Error checking linked PRs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Add these functions to window for testing from console
if (typeof window !== "undefined") {
  (window as any).testGithubToken = testGithubToken;
  (window as any).forceTokenInput = forceTokenInput;
  (window as any).clearGitHubToken = clearGitHubToken;
  (window as any).checkLinkedPRs = checkLinkedPRs;

  console.log(
    `GitHub token functions available:
1. testGithubToken() - Test your token and verify authentication
2. forceTokenInput() - Open the token input dialog
3. clearGitHubToken() - Remove your saved token
4. checkLinkedPRs() - Troubleshoot linked PR issues for the current URL`
  );
}

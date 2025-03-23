/**
 * Token test utility - Use this to verify the token input functionality is working correctly
 */
import { clearGitHubToken, showTokenInput } from "../dom-utils";
import { GitHubClientWithFallback } from "../github/github-client-fix";

/**
 * Test the GitHub token by making a simple API request
 * This will trigger the token input UI if the token is invalid
 */
export async function testGithubToken(): Promise<boolean> {
  console.log("Testing GitHub token...");

  // Get token from localStorage
  const token = localStorage.getItem("github_token");
  console.log(`Token in localStorage: ${token ? "YES (length: " + token.length + ")" : "NO"}`);

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
      console.error(`Token authentication failed: ${userResponse.status} ${userResponse.statusText}`);

      if (userResponse.status === 401 || userResponse.status === 403) {
        // Show token input dialog
        showTokenInput();
        return false;
      }

      throw new Error(`GitHub API error: ${userResponse.status} ${userResponse.statusText}`);
    }

    // Successfully authenticated
    const userData = await userResponse.json();
    console.log(`✅ Successfully authenticated as: ${userData.login}`);
    alert(`GitHub token valid! Authenticated as: ${userData.login}`);
    return true;
  } catch (error) {
    console.error("Error testing token:", error);
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
}

// Add these functions to window for testing from console
if (typeof window !== "undefined") {
  (window as any).testGithubToken = testGithubToken;
  (window as any).forceTokenInput = forceTokenInput;
  (window as any).clearGitHubToken = clearGitHubToken;
  console.log(
    "GitHub token test functions added to window object. Try: testGithubToken(), forceTokenInput(), or clearGitHubToken()"
  );
}

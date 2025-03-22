// Handle GitHub token input

export function promptForGitHubToken(): boolean {
  // Get current token from localStorage
  const currentToken = localStorage.getItem("github_token");

  const token = prompt(
    "GitHub API requires authentication for better rate limits.\nPlease enter your GitHub personal access token:",
    currentToken || ""
  );

  if (token) {
    // Store the new token in localStorage
    localStorage.setItem("github_token", token);
    return true;
  }

  return false;
}

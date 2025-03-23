/**
 * Auth Handler - Manages GitHub token authentication UI interactions
 * Uses the original implementation style with inline message links
 */

/**
 * Show the GitHub token input dialog
 * This can be triggered programmatically when authentication is needed
 */
export function showTokenInput(): void {
  // Open the token input page in a popup window
  window.open('/token-input.html', 'github_token', 'width=600,height=700');
}

/**
 * Creates a GitHub authentication message with a login link
 * This is the original style from the implementation
 */
export function createAuthMessage(error?: string): string {
  return `## GitHub Authentication Required

To view this content, you need to provide a GitHub personal access token.

<div class='auth-error-actions'>
  <button class='auth-token-button' onclick="window.open('/token-input.html', 'github_token', 'width=600,height=700')">Add GitHub Token</button>
</div>

${error ? `Error details: ${error}` : ''}`;
}

/**
 * Initialize auth handler
 * This should be called early in the application startup
 */
export function initAuthHandler(): void {
  // Add CSS for auth buttons
  const style = document.createElement('style');
  style.textContent = `
    .auth-error-actions {
      margin: 20px 0;
      text-align: center;
    }

    .auth-token-button {
      padding: 8px 16px;
      background-color: #2ea44f;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
    }

    .auth-token-button:hover {
      background-color: #22863a;
    }
  `;
  document.head.appendChild(style);

  // Add event listeners to any auth buttons on the page
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('auth-token-button')) {
      e.preventDefault();
      showTokenInput();
    }
  });
}

/**
 * Get the current GitHub token
 */
export function getGitHubToken(): string | null {
  return localStorage.getItem('github_token');
}

/**
 * Clear the current GitHub token
 */
export function clearGitHubToken(): void {
  localStorage.removeItem('github_token');
  alert('GitHub token has been removed. You will need to add a new token to access GitHub content.');
}

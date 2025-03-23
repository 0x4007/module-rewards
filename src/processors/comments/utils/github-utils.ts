/**
 * GitHub related utilities for comments processing
 */

/**
 * Check if a user is a GitHub bot
 * @param user GitHub user object
 * @returns true if user is likely a bot
 */
export function isGitHubBot(user: { login?: string, type?: string }): boolean {
  if (!user) return false;

  // Check if user type is Bot
  if (user.type === 'Bot') return true;

  // Check common bot username patterns
  if (user.login) {
    const login = user.login.toLowerCase();
    return (
      login.endsWith('[bot]') ||
      login.endsWith('-bot') ||
      login.startsWith('bot-') ||
      login === 'github-actions' ||
      login === 'dependabot' ||
      login === 'renovate' ||
      login === 'codecov' ||
      login === 'stale' ||
      login === 'greenkeeper'
    );
  }

  return false;
}

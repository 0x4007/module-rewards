/**
 * Helper functions for GitHub-specific operations
 */

import { GitHubUser } from "../types";

/**
 * Checks if a user is a bot based on GitHub's user type
 * @param user GitHub user object
 * @returns boolean indicating if the user is a bot
 */
export function isGitHubBot(user?: GitHubUser): boolean {
  if (!user) return false;
  return (user as any).type === "Bot";
}

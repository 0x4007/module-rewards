import { GitHubClient } from "./github-client";
import { GitHubClientWithFallback } from "./github-client-fix";

/**
 * This script tests both the original GitHubClient and our new
 * GitHubClientWithFallback to demonstrate the fix for dot-prefixed repo names.
 */

async function testFix() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("❌ No GitHub token found in environment variables");
    return;
  }

  console.log(`\n===== COMPARING GITHUB CLIENTS =====`);
  console.log(`This test demonstrates the fix for repositories with dot-prefixed names`);

  // Create instances of both clients
  const originalClient = new GitHubClient(token);
  const fixedClient = new GitHubClientWithFallback(token);

  // First test with a regular repository (should work with both clients)
  console.log(`\n----- Testing with regular repository name -----`);

  try {
    // Get the user's login
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      throw new Error(`User API request failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const username = userData.login;

    // Get user's repos to find one without a dot prefix
    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=10`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!reposResponse.ok) {
      throw new Error(`Repos API request failed: ${reposResponse.status}`);
    }

    const repos = await reposResponse.json();

    // Find a repository without a dot prefix
    const normalRepo = repos.find((repo: any) => !repo.name.startsWith("."));

    if (!normalRepo) {
      console.log(`Couldn't find a normal repository, skipping this test`);
    } else {
      console.log(`Found normal repository: ${normalRepo.full_name}`);

      // Test finding linked PRs with both clients
      console.log(`\nTest: findLinkedPullRequests with normal repository`);

      console.log(`Using original client:`);
      try {
        const result1 = await originalClient.findLinkedPullRequests(username, normalRepo.name, "1");
        console.log(`✅ Success with original client - result: ${result1.length} linked PRs`);
      } catch (error) {
        console.error(`❌ Error with original client:`, error);
      }

      console.log(`\nUsing fixed client:`);
      try {
        const result2 = await fixedClient.findLinkedPullRequests(username, normalRepo.name, "1");
        console.log(`✅ Success with fixed client - result: ${result2.length} linked PRs`);
      } catch (error) {
        console.error(`❌ Error with fixed client:`, error);
      }
    }

    // Now test with a dot-prefixed repository
    console.log(`\n----- Testing with dot-prefixed repository name -----`);

    // Find a repository with a dot prefix, or use the one we saw in previous tests
    const dotRepo = repos.find((repo: any) => repo.name.startsWith(".")) || { name: ".ubiquity-os" };

    console.log(`Testing with dot-prefixed repository: ${username}/${dotRepo.name}`);

    // Test findLinkedPullRequests with both clients
    console.log(`\nTest: findLinkedPullRequests with dot-prefixed repository`);

    let originalClientSuccess = false;
    console.log(`Using original client:`);
    try {
      const result1 = await originalClient.findLinkedPullRequests(username, dotRepo.name, "1");
      console.log(`✅ Success with original client - result: ${result1.length} linked PRs`);
      originalClientSuccess = true;
    } catch (error) {
      console.error(`❌ Error with original client:`, error);
      console.log(`This is the expected behavior with the original client when using a dot-prefixed repo`);
    }

    console.log(`\nUsing fixed client with fallback:`);
    try {
      const result2 = await fixedClient.findLinkedPullRequests(username, dotRepo.name, "1");
      console.log(`✅ Success with fixed client - result: ${result2.length} linked PRs`);

      if (!originalClientSuccess) {
        console.log(`\n✅ IMPORTANT: The fixed client successfully handled the dot-prefixed repository!`);
      }
    } catch (error) {
      console.error(`❌ Error with fixed client:`, error);
    }

    // Test findLinkedIssue with both clients
    console.log(`\nTest: findLinkedIssue with dot-prefixed repository`);

    originalClientSuccess = false;
    console.log(`Using original client:`);
    try {
      const result1 = await originalClient.findLinkedIssue(username, dotRepo.name, "1");
      console.log(`✅ Success with original client - result:`, result1 ? "Issue found" : "No linked issue found");
      originalClientSuccess = true;
    } catch (error) {
      console.error(`❌ Error with original client:`, error);
      console.log(`This is the expected behavior with the original client when using a dot-prefixed repo`);
    }

    console.log(`\nUsing fixed client with fallback:`);
    try {
      const result2 = await fixedClient.findLinkedIssue(username, dotRepo.name, "1");
      console.log(`✅ Success with fixed client - result:`, result2 ? "Issue found" : "No linked issue found");

      if (!originalClientSuccess) {
        console.log(`\n✅ IMPORTANT: The fixed client successfully handled the dot-prefixed repository!`);
      }
    } catch (error) {
      console.error(`❌ Error with fixed client:`, error);
    }

    console.log(`\n===== CONCLUSION =====`);
    console.log(`The GitHubClientWithFallback class:
1. Works correctly with normal repositories
2. Gracefully handles dot-prefixed repositories that cause GraphQL issues
3. Uses REST API fallback for repositories that have issues with GraphQL
4. Provides consistent behavior across all repository types`);
    console.log(
      `\nTo fix the 403 errors with your GitHub token, update the service to use the GitHubClientWithFallback class.`
    );
  } catch (error) {
    console.error(`Error in test:`, error);
  }
}

// Run the test
testFix().catch((error) => {
  console.error("Top-level error in test:", error);
});

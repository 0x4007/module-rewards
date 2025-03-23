import { GitHubClient } from "./github-client";

/**
 * This file helps debug GitHub token issues by testing various API endpoints
 * and providing detailed error information.
 */

async function debugToken() {
  // Check if the token is available in the environment
  const token = process.env.GITHUB_TOKEN;

  console.log("=== GitHub Token Debug ===");
  console.log(`Token in environment: ${token ? "YES (length: " + token.length + ")" : "NO"}`);

  // Test with the token from environment
  if (token) {
    await testTokenWithClient(new GitHubClient(token), "Environment");
  } else {
    console.log("No token found in environment variables.");
  }

  // If available in process.env.GITHUB_PAT, test that too
  const altToken = process.env.GITHUB_PAT;
  if (altToken && altToken !== token) {
    console.log("\nTesting with alternative token from GITHUB_PAT:");
    await testTokenWithClient(new GitHubClient(altToken), "GITHUB_PAT");
  }

  // Test with a different token extraction approach
  console.log("\nTrying to extract token from bash environment directly:");

  try {
    const { execSync } = require('child_process');
    const bashToken = execSync('echo $GITHUB_TOKEN').toString().trim();

    if (bashToken) {
      console.log(`Bash extracted token: YES (length: ${bashToken.length})`);
      if (bashToken !== token) {
        console.log("Note: This token is different from process.env.GITHUB_TOKEN!");
        await testTokenWithClient(new GitHubClient(bashToken), "Bash-extracted");
      } else {
        console.log("This is the same token as process.env.GITHUB_TOKEN");
      }
    } else {
      console.log("No token extracted from bash.");
    }
  } catch (err) {
    console.error("Error extracting token from bash:", err);
  }
}

async function testTokenWithClient(client: GitHubClient, tokenSource: string) {
  console.log(`\n--- Testing ${tokenSource} Token ---`);

  // Test basic public repo fetch (should work with minimal permissions)
  try {
    console.log("Test 1: Fetching public repo data (octokit/octokit.js issue #1)");
    const publicData = await client.fetchData("octokit", "octokit.js", "1", "issue");
    console.log("✅ Success! Public repo test passed.");
  } catch (error) {
    console.error("❌ Failed public repo test:", error);
    logDetailedFetchError(error);
  }

  // Test user's own repos (requires more permissions)
  try {
    // First make a request to the /user endpoint to get the authenticated user
    console.log("\nTest 2: Getting authenticated user info");
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${client["token"]}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!userResponse.ok) {
      throw new Error(`User API request failed: ${userResponse.status} ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    console.log(`✅ Successfully authenticated as: ${userData.login}`);

    // Now test with the user's repo
    console.log(`\nTest 3: Fetching one of ${userData.login}'s repos`);

    // Get list of repos
    const reposResponse = await fetch(`https://api.github.com/users/${userData.login}/repos?per_page=1`, {
      headers: {
        "Authorization": `Bearer ${client["token"]}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!reposResponse.ok) {
      throw new Error(`Repos API request failed: ${reposResponse.status} ${reposResponse.statusText}`);
    }

    const repos = await reposResponse.json();

    if (repos.length > 0) {
      const testRepo = repos[0];
      console.log(`Testing with repo: ${testRepo.full_name}`);

      // Try to access issues in this repo
      const [owner, repo] = testRepo.full_name.split('/');
      const issuesResponse = await fetch(`https://api.github.com/repos/${testRepo.full_name}/issues?per_page=1`, {
        headers: {
          "Authorization": `Bearer ${client["token"]}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });

      if (!issuesResponse.ok) {
        throw new Error(`Issues API request failed: ${issuesResponse.status} ${issuesResponse.statusText}`);
      }

      const issues = await issuesResponse.json();
      console.log(`✅ Successfully accessed ${issues.length} issues in ${testRepo.full_name}`);
    } else {
      console.log("No repositories found for user");
    }
  } catch (error) {
    console.error("❌ Failed authenticated user test:", error);
    logDetailedFetchError(error);
  }

  // Test GraphQL API (requires different permissions)
  try {
    console.log("\nTest 4: Testing GraphQL API");
    const testQuery = `
      query {
        viewer {
          login
          name
        }
      }
    `;

    const graphqlResponse = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${client["token"]}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: testQuery })
    });

    if (!graphqlResponse.ok) {
      throw new Error(`GraphQL API request failed: ${graphqlResponse.status} ${graphqlResponse.statusText}`);
    }

    const graphqlData = await graphqlResponse.json();

    if (graphqlData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(graphqlData.errors)}`);
    }

    console.log(`✅ GraphQL API test passed. Authenticated as: ${graphqlData.data.viewer.login}`);
  } catch (error) {
    console.error("❌ Failed GraphQL API test:", error);
    logDetailedFetchError(error);
  }
}

function logDetailedFetchError(error: any) {
  console.log("\nDetailed Error Information:");

  if (error.response) {
    console.log(`Status: ${error.response.status}`);
    console.log(`Status Text: ${error.response.statusText}`);
    console.log("Headers:", error.response.headers);

    if (error.response.status === 403) {
      console.log("\nPossible reasons for 403 Forbidden:");
      console.log("1. Token lacks required scopes/permissions");
      console.log("2. Two-factor authentication required");
      console.log("3. Rate limit exceeded");
      console.log("4. Token has been revoked or is invalid");

      if (error.response.headers && error.response.headers.get('x-ratelimit-remaining') === '0') {
        console.log("\n⚠️ RATE LIMIT EXCEEDED! This is likely the cause of your 403 error.");
        console.log(`Rate limit resets at: ${new Date(parseInt(error.response.headers.get('x-ratelimit-reset')) * 1000)}`);
      }
    }
  } else {
    console.log(`Error message: ${error.message || String(error)}`);
  }
}

// Execute the debug function
debugToken().catch(error => {
  console.error("Top-level error in debug script:", error);
});

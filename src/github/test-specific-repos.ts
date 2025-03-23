import { GitHubClient } from "./github-client";

/**
 * This file tests specific GitHub API calls that might be causing 403 errors
 */

async function testSpecificRepos() {
  console.log("=== GitHub Repository-Specific Test ===");
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("❌ No GitHub token found in environment variables");
    return;
  }

  console.log(`Token present: YES (length: ${token.length})`);
  const client = new GitHubClient(token);

  // Get the user's login first
  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!userResponse.ok) {
      throw new Error(`User API request failed: ${userResponse.status} ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    const username = userData.login;
    console.log(`Authenticated as: ${username}`);

    // Now test a few repositories specifically
    await testRepo(client, username, ".ubiquity-os");  // Your repo we saw in the previous test

    // Try specific API operations that might be causing 403 errors
    console.log("\n=== Testing Specific API Operations ===");

    // 1. Test repository collaborators endpoint (requires push access)
    console.log("\n🔍 Testing collaborators API (requires push access)");
    try {
      const collabsResponse = await fetch(`https://api.github.com/repos/${username}/.ubiquity-os/collaborators`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });

      console.log(`Status: ${collabsResponse.status}`);
      if (collabsResponse.ok) {
        const collabs = await collabsResponse.json();
        console.log(`✅ Successfully accessed collaborators (${collabs.length} found)`);
      } else {
        const error = await collabsResponse.text();
        console.log(`❌ Failed to access collaborators: ${error}`);
      }
    } catch (error) {
      console.error("Error accessing collaborators:", error);
    }

    // 2. Test webhooks API (requires admin access)
    console.log("\n🔍 Testing webhooks API (requires admin access)");
    try {
      const webhooksResponse = await fetch(`https://api.github.com/repos/${username}/.ubiquity-os/hooks`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });

      console.log(`Status: ${webhooksResponse.status}`);
      if (webhooksResponse.ok) {
        const hooks = await webhooksResponse.json();
        console.log(`✅ Successfully accessed webhooks (${hooks.length} found)`);
      } else {
        const error = await webhooksResponse.text();
        console.log(`❌ Failed to access webhooks: ${error}`);
      }
    } catch (error) {
      console.error("Error accessing webhooks:", error);
    }

    // 3. Test GraphQL query that might be failing
    console.log("\n🔍 Testing GraphQL linked PRs query");
    try {
      const result = await client.findLinkedPullRequests(username, ".ubiquity-os", "1");
      console.log(`GraphQL query result:`, result.length > 0 ? "Data returned" : "No data");
    } catch (error) {
      console.error("Error with GraphQL query:", error);
    }

    // 4. Test organization access if the user is part of an org
    console.log("\n🔍 Testing organization access");
    try {
      const orgsResponse = await fetch(`https://api.github.com/user/orgs`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });

      if (orgsResponse.ok) {
        const orgs = await orgsResponse.json();
        console.log(`✅ Successfully accessed ${orgs.length} organizations`);

        if (orgs.length > 0) {
          // Test access to first org's repos
          const orgName = orgs[0].login;
          console.log(`Testing access to ${orgName} repositories...`);

          const orgReposResponse = await fetch(`https://api.github.com/orgs/${orgName}/repos?per_page=1`, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github.v3+json"
            }
          });

          if (orgReposResponse.ok) {
            const repos = await orgReposResponse.json();
            console.log(`✅ Successfully accessed ${repos.length} repos in ${orgName}`);
          } else {
            const error = await orgReposResponse.text();
            console.log(`❌ Failed to access org repos: ${error}`);
          }
        }
      } else {
        const error = await orgsResponse.text();
        console.log(`❌ Failed to access orgs: ${error}`);
      }
    } catch (error) {
      console.error("Error accessing organizations:", error);
    }

    // 5. Test with another token name to check environment issues
    console.log("\n🔍 Testing with GITHUB_PAT environment variable if available");
    const altToken = process.env.GITHUB_PAT;
    if (altToken && altToken !== token) {
      console.log("Found GITHUB_PAT, testing with this alternative token");
      const altClient = new GitHubClient(altToken);
      try {
        const result = await altClient.findLinkedPullRequests(username, ".ubiquity-os", "1");
        console.log(`Alternative token test result:`, result.length > 0 ? "Data returned" : "No data");
      } catch (error) {
        console.error("Error with alternative token:", error);
      }
    } else {
      console.log("No alternative token found or same as primary token");
    }

  } catch (error) {
    console.error("Failed to authenticate user:", error);
  }
}

async function testRepo(client: GitHubClient, owner: string, repo: string) {
  console.log(`\n🔍 Testing repo: ${owner}/${repo}`);

  try {
    // Get basic repo info
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        "Authorization": `Bearer ${client["token"]}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!repoResponse.ok) {
      throw new Error(`Repository API request failed: ${repoResponse.status} ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();
    console.log(`✅ Successfully accessed repo info`);
    console.log(`Repository: ${repoData.full_name} (${repoData.visibility})`);

    // Try to get issues
    console.log("\nTesting issues access...");
    const issuesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?per_page=1`, {
      headers: {
        "Authorization": `Bearer ${client["token"]}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (issuesResponse.ok) {
      const issues = await issuesResponse.json();
      console.log(`✅ Successfully accessed issues (${issues.length} found)`);

      if (issues.length > 0) {
        const issueNumber = issues[0].number;
        await testIssue(client, owner, repo, issueNumber.toString());
      }
    } else {
      console.log(`❌ Failed to access issues: ${issuesResponse.status}`);
    }

    // Try to get pull requests
    console.log("\nTesting pull requests access...");
    const prsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?per_page=1`, {
      headers: {
        "Authorization": `Bearer ${client["token"]}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (prsResponse.ok) {
      const prs = await prsResponse.json();
      console.log(`✅ Successfully accessed PRs (${prs.length} found)`);

      if (prs.length > 0) {
        const prNumber = prs[0].number;
        await testPullRequest(client, owner, repo, prNumber.toString());
      }
    } else {
      console.log(`❌ Failed to access PRs: ${prsResponse.status}`);
    }

  } catch (error) {
    console.error(`Error testing repo ${owner}/${repo}:`, error);
  }
}

async function testIssue(client: GitHubClient, owner: string, repo: string, issueNumber: string) {
  console.log(`\nTesting issue #${issueNumber}...`);

  try {
    const fetchedData = await client.fetchData(owner, repo, issueNumber, "issue");
    console.log(`✅ Successfully fetched issue data`);
    console.log(`Comments: ${fetchedData.comments.length}`);
    console.log(`Linked PRs: ${fetchedData.linkedPullRequests?.length || 0}`);
  } catch (error) {
    console.error(`❌ Error fetching issue #${issueNumber}:`, error);
  }
}

async function testPullRequest(client: GitHubClient, owner: string, repo: string, prNumber: string) {
  console.log(`\nTesting PR #${prNumber}...`);

  try {
    const fetchedData = await client.fetchData(owner, repo, prNumber, "pr");
    console.log(`✅ Successfully fetched PR data`);
    console.log(`Comments: ${fetchedData.comments.length}`);
    console.log(`Linked Issue: ${fetchedData.linkedIssue ? "Yes" : "No"}`);
  } catch (error) {
    console.error(`❌ Error fetching PR #${prNumber}:`, error);
  }
}

// Execute the test function
testSpecificRepos().catch(error => {
  console.error("Top-level error in repository test script:", error);
});

/**
 * Special test for the very specific case of command-ask PR #31 and Issue #30
 * This test uses both REST API and GraphQL to fully examine the relationship
 */

async function main() {
  console.log("--------------------------------------------------");
  console.log("🔍 DEDICATED TEST FOR command-ask PR #31 → Issue #30");
  console.log("--------------------------------------------------");

  // GitHub token for authentication
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("❌ No GitHub token found. Please set GITHUB_TOKEN environment variable");
    process.exit(1);
  }

  // Target is specifically the command-ask repo PR #31 and Issue #30
  const owner = "ubiquity-os-marketplace";
  const repo = "command-ask";
  const prNumber = "31";
  const issueNumber = "30";

  console.log(`Testing PR #${prNumber} and Issue #${issueNumber} in ${owner}/${repo}`);

  // Test the relationships in both directions
  await testPRToIssue(owner, repo, prNumber, issueNumber, token);
  await testIssueToPR(owner, repo, issueNumber, prNumber, token);
}

// Test PR → Issue direction (forward)
async function testPRToIssue(owner: string, repo: string, prNumber: string, expectedIssueNumber: string, token: string) {
  console.log("\n🔍 TESTING PR → ISSUE DIRECTION");
  console.log(`Looking for issues referenced by PR #${prNumber}`);

  // 1. REST API - First check if PR body mentions the issue
  try {
    const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const prResponse = await fetch(prUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (prResponse.ok) {
      const pr = await prResponse.json();
      console.log(`PR #${prNumber} title: "${pr.title}"`);
      console.log(`PR body length: ${pr.body?.length || 0} characters`);

      if (pr.body) {
        console.log("\nChecking PR body for issue references:");
        console.log("-------------------------------------");
        console.log(pr.body);
        console.log("-------------------------------------");

        // Look for simple issue references #XX
        const simpleRefs = pr.body.match(/#(\d+)/g);
        if (simpleRefs?.length) {
          console.log(`Found simple issue references: ${simpleRefs.join(', ')}`);
        }

        // Look for closing keywords
        const closingRefs = pr.body.match(/(?:closes?|fixes?|resolves?)\s+#(\d+)/gi);
        if (closingRefs?.length) {
          console.log(`Found closing references: ${closingRefs.join(', ')}`);
        }
      }
    } else {
      console.error(`❌ Failed to fetch PR: ${prResponse.status}`);
    }
  } catch (error) {
    console.error("Error checking PR body:", error);
  }

  // 2. GraphQL API - Check PR's closing references
  try {
    const query = `
      query GetPRClosingIssues($owner: String!, $repo: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            closingIssuesReferences(first: 10) {
              nodes {
                number
                title
              }
            }
          }
        }
      }
    `;

    console.log("\nQuerying GraphQL for closing issues references:");
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        variables: { owner, repo, prNumber: parseInt(prNumber) }
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data?.repository?.pullRequest?.closingIssuesReferences?.nodes) {
        const issues = result.data.repository.pullRequest.closingIssuesReferences.nodes;
        console.log(`Found ${issues.length} closing issue references:`);
        issues.forEach((issue: any) => {
          console.log(`- Issue #${issue.number}: ${issue.title}`);
        });
      } else {
        console.log("No closing issues references found via GraphQL");

        if (result.errors) {
          console.log("GraphQL errors:", JSON.stringify(result.errors, null, 2));
        }
      }
    } else {
      console.error(`❌ GraphQL request failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Error using GraphQL:", error);
  }
}

// Test Issue → PR direction (reverse)
async function testIssueToPR(owner: string, repo: string, issueNumber: string, expectedPrNumber: string, token: string) {
  console.log("\n🔍 TESTING ISSUE → PR DIRECTION");
  console.log(`Looking for PRs that reference issue #${issueNumber}`);

  // Use GraphQL to find PRs that close the issue
  try {
    const query = `
      query GetIssueClosingPRs($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            title
            closedByPullRequestsReferences(first: 10) {
              nodes {
                number
                title
              }
            }
          }
        }
      }
    `;

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        variables: { owner, repo, issueNumber: parseInt(issueNumber) }
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data?.repository?.issue?.closedByPullRequestsReferences?.nodes) {
        const prs = result.data.repository.issue.closedByPullRequestsReferences.nodes;
        console.log(`Found ${prs.length} PRs that close issue #${issueNumber}:`);
        prs.forEach((pr: any) => {
          console.log(`- PR #${pr.number}: ${pr.title}`);
          if (pr.number.toString() === expectedPrNumber) {
            console.log(`✅ MATCH FOUND! PR #${expectedPrNumber} does close issue #${issueNumber}`);
          }
        });

        if (prs.length === 0) {
          console.log(`❌ No PRs found that close issue #${issueNumber}`);
        }
      } else {
        console.log(`No PRs found that close issue #${issueNumber} via GraphQL`);

        if (result.errors) {
          console.log("GraphQL errors:", JSON.stringify(result.errors, null, 2));
        }
      }
    } else {
      console.error(`❌ GraphQL request failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Error using GraphQL:", error);
  }

  // Also try the REST API search as a fallback
  try {
    console.log("\nTrying REST API search for PRs mentioning the issue:");
    const searchUrl = `https://api.github.com/search/issues?q=repo:${owner}/${repo}+is:pr+${issueNumber}+in:body`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log(`Found ${searchData.items.length} PRs mentioning issue #${issueNumber}:`);

      searchData.items.forEach((item: any) => {
        if (item.pull_request) {
          console.log(`- PR #${item.number}: ${item.title}`);
          if (item.number.toString() === expectedPrNumber) {
            console.log(`✅ MATCH FOUND via search! PR #${expectedPrNumber} mentions issue #${issueNumber}`);
          }
        }
      });
    } else {
      console.error(`❌ Search API request failed: ${searchResponse.status}`);
    }
  } catch (error) {
    console.error("Error using Search API:", error);
  }
}

// Run the test
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});

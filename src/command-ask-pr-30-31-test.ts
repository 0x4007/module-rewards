/**
 * Specialized test file to diagnose and fix the PR #31 → Issue #30 linkage
 * in the ubiquity-os-marketplace/command-ask repository
 */


// Testing variables
const OWNER = "ubiquity-os-marketplace";
const REPO = "command-ask";
const PR_NUMBER = "31";
const ISSUE_NUMBER = "30";

/**
 * Main test function that tries multiple approaches to find the linkage
 */
export async function testCommandAskPR31(token?: string): Promise<void> {
  console.log("=========== COMMAND-ASK PR #31 TEST ===========");
  console.log(`Testing PR ${OWNER}/${REPO}#${PR_NUMBER} linkage to Issue #${ISSUE_NUMBER}`);

  if (!token) {
    console.error("⚠️ No GitHub token provided - linkage detection will likely fail");
  }

  // Try all approaches one by one with detailed logging
  await testGraphQLLinkage(token);
  await testDirectBodyAnalysis(token);
  await testSearchAPI(token);

  console.log("=========== TEST COMPLETE ===========");
}

/**
 * Test GraphQL-based linkage detection
 */
async function testGraphQLLinkage(token?: string): Promise<void> {
  console.log("\n🔍 TESTING GRAPHQL LINKAGE DETECTION");

  if (!token) {
    console.log("❌ Skipping GraphQL test - no token provided");
    return;
  }

  try {
    // PR → Issue direction
    const prToIssueQuery = `
      query FindLinkedIssues($owner: String!, $repo: String!, $prNumber: Int!) {
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

    console.log(`Querying for issues linked from PR #${PR_NUMBER}`);
    const prResponse = await executeGraphQL(prToIssueQuery, {
      owner: OWNER,
      repo: REPO,
      prNumber: parseInt(PR_NUMBER)
    }, token);

    const linkedIssues = prResponse?.repository?.pullRequest?.closingIssuesReferences?.nodes || [];
    console.log(`Found ${linkedIssues.length} linked issues via PR → Issue GraphQL`);

    if (linkedIssues.length > 0) {
      console.log("Linked issues:", linkedIssues);
      return;
    }

    // Issue → PR direction
    const issueToPRQuery = `
      query FindLinkingPRs($owner: String!, $repo: String!, $issueNumber: Int!) {
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

    console.log(`\nQuerying for PRs that link to Issue #${ISSUE_NUMBER}`);
    const issueResponse = await executeGraphQL(issueToPRQuery, {
      owner: OWNER,
      repo: REPO,
      issueNumber: parseInt(ISSUE_NUMBER)
    }, token);

    const linkedPRs = issueResponse?.repository?.issue?.closedByPullRequestsReferences?.nodes || [];
    console.log(`Found ${linkedPRs.length} linked PRs via Issue → PR GraphQL`);

    if (linkedPRs.length > 0) {
      console.log("Linked PRs:", linkedPRs);
    } else {
      console.log("❌ No links found via GraphQL in either direction");
    }
  } catch (error) {
    console.error("❌ Error in GraphQL test:", error);
  }
}

/**
 * Test direct body analysis approach
 */
async function testDirectBodyAnalysis(token?: string): Promise<void> {
  console.log("\n🔍 TESTING DIRECT PR BODY ANALYSIS");

  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json"
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    // Fetch PR details directly
    const prUrl = `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}`;
    const prResponse = await fetch(prUrl, { headers });

    if (!prResponse.ok) {
      console.error(`❌ Failed to fetch PR: ${prResponse.status}`);
      return;
    }

    const pr = await prResponse.json();
    console.log("PR Body:", pr.body);

    // Look for issue references in the body
    const patterns = [
      // Common ways to reference issues
      /(?:close[ds]?|fix(?:e[ds])?|resolve[ds]?)\s+#(\d+)/gi,
      /(?:close[ds]?|fix(?:e[ds])?|resolve[ds]?)\s+(?:ubiquity-os-marketplace\/command-ask)?#(\d+)/gi,
      /(?:close[ds]?|fix(?:e[ds])?|resolve[ds]?)\s+(?:https:\/\/github\.com\/ubiquity-os-marketplace\/command-ask\/issues\/)(\d+)/gi,
      // Simple # references
      /#(\d+)/g,
    ];

    if (pr.body) {
      console.log("Analyzing PR body for issue references...");

      for (const pattern of patterns) {
        const matches = [...pr.body.matchAll(pattern)];

        if (matches.length > 0) {
          console.log(`✅ Found ${matches.length} matches with pattern:`, pattern);

          for (const match of matches) {
            const issueNumber = match[1];
            console.log(`   Issue #${issueNumber} referenced by "${match[0]}"`);

            if (issueNumber === ISSUE_NUMBER) {
              console.log(`✅ CONFIRMED: PR #${PR_NUMBER} references Issue #${ISSUE_NUMBER} in its body`);
            }
          }
        }
      }
    } else {
      console.log("❌ PR has no body content");
    }
  } catch (error) {
    console.error("❌ Error in direct body analysis:", error);
  }
}

/**
 * Test REST API search for linkage
 */
async function testSearchAPI(token?: string): Promise<void> {
  console.log("\n🔍 TESTING SEARCH API");

  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json"
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    // Search for PRs mentioning the issue
    const issueQuery = `repo:${OWNER}/${REPO} is:pr ${ISSUE_NUMBER} in:body`;
    const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(issueQuery)}`;

    console.log(`Searching for: ${issueQuery}`);
    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) {
      console.error(`❌ Search API failed: ${searchResponse.status}`);
      return;
    }

    const searchResults = await searchResponse.json();
    console.log(`Found ${searchResults.total_count} search results`);

    if (searchResults.items.length > 0) {
      const items = searchResults.items.map((item: any) => ({
        number: item.number,
        title: item.title,
        url: item.html_url
      }));

      console.log("Search results:", items);

      // Check if our target PR is in the results
      const targetPR = items.find((item: any) => item.number === parseInt(PR_NUMBER));
      if (targetPR) {
        console.log(`✅ CONFIRMED: PR #${PR_NUMBER} was found in search results for issue #${ISSUE_NUMBER}`);
      } else {
        console.log(`❌ PR #${PR_NUMBER} was NOT found in search results`);
      }
    }
  } catch (error) {
    console.error("❌ Error in search API test:", error);
  }
}

/**
 * Helper function to execute GraphQL queries
 */
async function executeGraphQL(query: string, variables: any, token?: string): Promise<any> {
  if (!token) {
    throw new Error("Token required for GraphQL queries");
  }

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    return null;
  }

  return result.data;
}

/**
 * Run this test immediately if executed directly
 */
if (require.main === module) {
  const token = process.env.GITHUB_TOKEN;
  testCommandAskPR31(token).catch(console.error);
}

import { isIssueLinkedByPR } from "./github-pr-link";

/**
 * Special command-line utility script for diagnosing PR #31
 * Run with: bun src/pr31-test.ts
 */

async function main() {
  console.log("--------------------------------------------------");
  console.log("🔍 PR#31 LINKED ISSUE DIAGNOSTIC UTILITY");
  console.log("--------------------------------------------------");

  // GitHub token handling
  let token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.log("⚠️ No GITHUB_TOKEN environment variable found.");
    console.log("   The script will work but with rate limits.");
    console.log("   To use with a token, run:");
    console.log("   GITHUB_TOKEN=your_token bun src/pr31-test.ts");
  } else {
    console.log("✅ Using provided GitHub token");
  }

  // Target PR information - correct repository info
  const owner = "ubiquibot";  // Changed from "ubiquity" to "ubiquibot"
  const repo = "ubiquibot";   // Changed from "text-conversation-rewards" to "ubiquibot"
  const prNumber = "31";

  console.log("\n📋 Testing for:");
  console.log(`   Repository: ${owner}/${repo}`);
  console.log(`   Pull Request: #${prNumber}`);

  try {
    console.log("\n🔄 Testing with bidirectional approach...");
    const issue = await isIssueLinkedByPR(owner, repo, prNumber, token);

    if (issue) {
      console.log("\n✅ SUCCESS! Found linked issue:");
      console.log(`   Issue #${issue.number}: ${issue.title}`);
      console.log(`   URL: ${issue.html_url}`);
    } else {
      console.log("\n❌ No linked issue found using bidirectional approach");

      // Direct REST API fallback
      console.log("\n🔄 Trying direct REST API approach...");
      await testDirectRestApi(owner, repo, prNumber, token);
    }
  } catch (error) {
    console.error("\n💥 Error in bidirectional testing:", error);

    // Still try the direct API as fallback
    try {
      console.log("\n🔄 Falling back to direct REST API approach...");
      await testDirectRestApi(owner, repo, prNumber, token);
    } catch (fallbackError) {
      console.error("\n💥 Fallback also failed:", fallbackError);
    }
  }

  console.log("\n--------------------------------------------------");
}

async function testDirectRestApi(owner: string, repo: string, prNumber: string, token?: string) {
  const headers: HeadersInit = { "Accept": "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // 1. Get PR data
  console.log("   Fetching PR data...");
  const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const prResponse = await fetch(prUrl, { headers });

  if (!prResponse.ok) {
    throw new Error(`Failed to fetch PR: ${prResponse.status} ${prResponse.statusText}`);
  }

  const pr = await prResponse.json();
  console.log(`   PR title: ${pr.title}`);
  console.log(`   PR body length: ${pr.body?.length || 0}`);

  // 2. Look for issue references in the PR body
  let issueNumbers: string[] = [];

  if (pr.body) {
    // Match Fixes/Closes #X patterns
    const closeMatches = pr.body.match(/(?:fix(?:e[ds])?|close[ds]?|resolve[ds]?)\s+(?:#|[a-zA-Z0-9_\-\.\/]+#)(\d+)/gi);
    if (closeMatches) {
      for (const match of closeMatches) {
        const numMatch = match.match(/(\d+)$/);
        if (numMatch) issueNumbers.push(numMatch[1]);
      }
    }

    // Also look for plain #X references
    const plainMatches = pr.body.match(/(?<![a-zA-Z0-9])#(\d+)(?![a-zA-Z0-9])/g);
    if (plainMatches) {
      for (const match of plainMatches) {
        const numMatch = match.match(/(\d+)$/);
        if (numMatch) issueNumbers.push(numMatch[1]);
      }
    }
  }

  // Report on issue references found
  if (issueNumbers.length > 0) {
    console.log(`   Found ${issueNumbers.length} issue references in PR body: ${issueNumbers.join(', ')}`);

    // Try to fetch each issue
    for (const num of issueNumbers) {
      console.log(`\n   Checking issue #${num}...`);
      const issueUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${num}`;
      const issueResponse = await fetch(issueUrl, { headers });

      if (issueResponse.ok) {
        const issue = await issueResponse.json();
        console.log(`   ✅ Issue exists: ${issue.title}`);
        console.log(`   State: ${issue.state}`);
        return;
      } else {
        console.log(`   ❌ Issue #${num} not found or inaccessible (${issueResponse.status})`);
      }
    }
  } else {
    console.log("   ❌ No issue references found in PR body");
  }

  // 3. Try timeline API as last resort
  console.log("\n   Trying timeline API to find cross-references...");

  // GitHub timeline API with preview header
  const timelineUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/timeline`;
  headers["Accept"] = "application/vnd.github.mockingbird-preview+json";

  const timelineResponse = await fetch(timelineUrl, { headers });

  if (timelineResponse.ok) {
    const events = await timelineResponse.json();
    console.log(`   Found ${events.length} timeline events`);

    for (const event of events) {
      if (
        event.event === "cross-referenced" ||
        event.event === "connected" ||
        event.event === "referenced"
      ) {
        console.log(`   Found ${event.event} event`);

        if (event.source?.issue?.number) {
          console.log(`   ✅ Related issue #${event.source.issue.number}: ${event.source.issue.title}`);
          console.log(`   URL: ${event.source.issue.html_url}`);
          return;
        }
      }
    }

    console.log("   ❌ No linking events found in timeline");
  } else {
    console.log(`   ❌ Failed to fetch timeline: ${timelineResponse.status}`);
  }

  console.log("\n❌ FINAL RESULT: No linked issues found for PR #31");
}

// Execute the main function
main().catch(error => {
  console.error("💥 Critical error:", error);
  process.exit(1);
});

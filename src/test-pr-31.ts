import { isIssueLinkedByPR } from "./github-pr-link";

// This file provides a special test function to debug PR #31 specifically

/**
 * Directly test PR #31 with robust error handling and debugging
 */
export async function testPR31(token?: string): Promise<void> {
  console.log("⚠️ DETAILED DIAGNOSTIC: Testing PR #31 specifically");

  try {
    // Direct test with precise parameters for PR #31
    const owner = "ubiquity";
    const repo = "text-conversation-rewards";
    const prNumber = "31";

    console.log(`🔍 Testing PR ${owner}/${repo}#${prNumber} with${token ? "" : "out"} auth token`);

    // Try our bidirectional approach first
    try {
      console.log("🔄 Attempting bidirectional lookup (Issue→PR direction first)");
      const linkedIssue = await isIssueLinkedByPR(owner, repo, prNumber, token);

      if (linkedIssue) {
        console.log("✅ SUCCESS! Found linked issue:", linkedIssue);
        console.log(`Issue #${linkedIssue.number}: ${linkedIssue.title}`);
        return;
      } else {
        console.log("❌ Bidirectional approach found no linked issues");
      }
    } catch (bidirError) {
      console.error("❌ Error in bidirectional approach:", bidirError);
    }

    // Direct REST API analysis for more reliable insight
    console.log("🔍 Falling back to direct REST API analysis");

    // 1. Get PR details directly
    const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const headers: HeadersInit = {
      "Accept": "application/vnd.github.v3+json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log("📤 Fetching PR details from:", prUrl);
    const prResponse = await fetch(prUrl, { headers });

    if (!prResponse.ok) {
      throw new Error(`Failed to fetch PR: ${prResponse.status} ${prResponse.statusText}`);
    }

    const prData = await prResponse.json();
    console.log("📥 PR details received:", {
      title: prData.title,
      body: prData.body?.substring(0, 100) + "...",
      bodyLength: prData.body?.length || 0,
      hasBody: !!prData.body,
      state: prData.state,
      merged: prData.merged,
    });

    // 2. Check for issue links in body
    if (prData.body) {
      const issueRefs = prData.body.match(/(?:fix(?:e[ds])?|close[ds]?|resolve[ds]?)\s+(?:#|[a-zA-Z0-9_\-\.\/]+#)(\d+)/gi);

      if (issueRefs?.length) {
        console.log("🔎 Found issue references in PR body:", issueRefs);

        // Get the first issue number
        for (const ref of issueRefs) {
          const numMatch = ref.match(/(\d+)$/);
          if (numMatch && numMatch[1]) {
            const issueNumber = numMatch[1];
            console.log(`⏳ Checking issue #${issueNumber}`);

            // Fetch the issue
            const issueUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
            console.log("📤 Fetching issue from:", issueUrl);

            const issueResponse = await fetch(issueUrl, { headers });

            if (issueResponse.ok) {
              const issueData = await issueResponse.json();
              console.log("✅ Found linked issue:", {
                number: issueData.number,
                title: issueData.title,
                state: issueData.state,
              });
              return;
            } else {
              console.error(`❌ Failed to fetch issue #${issueNumber}: ${issueResponse.status}`);
            }
          }
        }
      } else {
        console.log("❌ No issue references found in PR body");
      }
    }

    // 3. Check related issues endpoint
    console.log("🔍 Checking for related issues via timeline API");
    const timelineUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/timeline`;
    headers["Accept"] = "application/vnd.github.mockingbird-preview+json";

    const timelineResponse = await fetch(timelineUrl, { headers });

    if (timelineResponse.ok) {
      const timelineData = await timelineResponse.json();
      console.log(`📥 Timeline events received: ${timelineData.length} events`);

      const linkedEvents = timelineData.filter((event: any) =>
        event.event === "cross-referenced" ||
        event.event === "connected" ||
        event.event === "referenced"
      );

      console.log(`🔍 Found ${linkedEvents.length} linking events in timeline`);

      for (const event of linkedEvents) {
        console.log("Event type:", event.event);
        if (event.source?.issue?.number) {
          console.log("✅ Found linked issue through timeline:", {
            number: event.source.issue.number,
            title: event.source.issue.title,
          });
          return;
        }
      }
    } else {
      console.error(`❌ Failed to fetch timeline: ${timelineResponse.status}`);
    }

    console.log("‼️ RESULT: No linked issues found for PR #31 after exhaustive search");

  } catch (error) {
    console.error("💥 Critical error in testPR31:", error);
  }
}

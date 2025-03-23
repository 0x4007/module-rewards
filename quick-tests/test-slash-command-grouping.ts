import { detectConsecutiveComments } from "../src/comment-grouping";
import { GitHubComment } from "../src/types";

/**
 * This test verifies that slash commands are not grouped with other comments,
 * similarly to how bot comments are also not grouped.
 */

// Immediately run some debug output
console.log("Starting test script...");

try {
  // Create mock comment data
  console.log("Creating mock data...");
  const mockUser = { login: "testuser", avatar_url: "", html_url: "" };
  const mockComments: GitHubComment[] = [
    // Regular comment
    {
      id: 1,
      body: "This is a regular comment",
      user: mockUser,
      created_at: "2025-03-22T00:00:00Z",
      updated_at: "2025-03-22T00:00:00Z",
      html_url: ""
    },
    // Another regular comment from the same user (should be grouped with the first one)
    {
      id: 2,
      body: "This is another regular comment",
      user: mockUser,
      created_at: "2025-03-22T00:01:00Z",
      updated_at: "2025-03-22T00:01:00Z",
      html_url: ""
    },
    // A slash command (should NOT be grouped with anything)
    {
      id: 3,
      body: "/help me with something",
      user: mockUser,
      created_at: "2025-03-22T00:02:00Z",
      updated_at: "2025-03-22T00:02:00Z",
      html_url: ""
    },
    // Another slash command (should NOT be grouped with anything)
    {
      id: 4,
      body: "/command do something",
      user: mockUser,
      created_at: "2025-03-22T00:03:00Z",
      updated_at: "2025-03-22T00:03:00Z",
      html_url: ""
    },
    // Another regular comment (should NOT be grouped with the slash commands)
    {
      id: 5,
      body: "Back to regular commenting",
      user: mockUser,
      created_at: "2025-03-22T00:04:00Z",
      updated_at: "2025-03-22T00:04:00Z",
      html_url: ""
    }
  ];

  console.log("Testing slash command grouping...");

  // Get the comment grouping map
  console.log("Calling detectConsecutiveComments...");
  const groupMap = detectConsecutiveComments(mockComments, "issue");
  console.log("Got result from detectConsecutiveComments");

  // Check the results
  console.log("\nComment Groups:");
  console.log("Group map keys:", Object.keys(groupMap));
  for (const [commentId, group] of Object.entries(groupMap)) {
    console.log(`Comment ID ${commentId} is in a group with: ${group.commentIds.join(", ")}`);
  }

  // Verify expectations
  const expectations = [
    { id: "1", shouldBeGrouped: true, expectedGroupMembers: [1, 2] },
    { id: "2", shouldBeGrouped: true, expectedGroupMembers: [1, 2] },
    { id: "3", shouldBeGrouped: false, expectedGroupMembers: [] },
    { id: "4", shouldBeGrouped: false, expectedGroupMembers: [] },
    { id: "5", shouldBeGrouped: false, expectedGroupMembers: [] }
  ];

  console.log("\nTest Results:");
  let allPassed = true;

  for (const exp of expectations) {
    const isGrouped = Boolean(groupMap[exp.id]);
    const groupMembers = isGrouped ? groupMap[exp.id].commentIds : [];

    const passedGroupCheck = isGrouped === exp.shouldBeGrouped;
    const passedMembersCheck = isGrouped ?
      JSON.stringify(groupMembers.sort()) === JSON.stringify(exp.expectedGroupMembers.sort()) :
      true;

    const passed = passedGroupCheck && passedMembersCheck;
    allPassed = allPassed && passed;

    console.log(`Comment ID ${exp.id}:`);
    console.log(`  Should be grouped: ${exp.shouldBeGrouped}, Is grouped: ${isGrouped} - ${passedGroupCheck ? "✓" : "✗"}`);

    if (exp.shouldBeGrouped) {
      console.log(`  Expected group members: ${exp.expectedGroupMembers.join(", ")}`);
      console.log(`  Actual group members:   ${groupMembers.join(", ")} - ${passedMembersCheck ? "✓" : "✗"}`);
    }
  }

  console.log(`\nOverall test ${allPassed ? "PASSED ✓" : "FAILED ✗"}`);
} catch (error) {
  console.error("Error running test:", error);
}

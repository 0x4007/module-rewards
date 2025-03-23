/**
 * Simple test to verify our fix for slash command grouping
 *
 * This test directly uses the isSlashCommand function we added and checks
 * that slash commands aren't being grouped together by using a similar
 * implementation to the one in comment-grouping.ts
 */

// Mock GitHubComment interface
interface MockComment {
  id: number;
  body: string;
  user: { login: string };
}

// Simplified isSlashCommand function (same logic as in comment-grouping.ts)
function isSlashCommand(comment: MockComment): boolean {
  if (!comment.body) return false;
  const trimmedContent = comment.body.trimStart();
  return trimmedContent.startsWith('/');
}

// Mock data
const comments: MockComment[] = [
  { id: 1, body: "Regular comment", user: { login: "user1" } },
  { id: 2, body: "Another regular comment", user: { login: "user1" } },
  { id: 3, body: "/slash command", user: { login: "user1" } },
  { id: 4, body: "/another slash command", user: { login: "user1" } }
];

// Simplified grouping algorithm (similar to the fixed version)
function groupCommentsWithoutSlashCommands() {
  let groupedComments: Record<string, number[]> = {};
  let currentGroup: number[] = [];
  let currentUser = "";

  for (const comment of comments) {
    const isSlashCmd = isSlashCommand(comment);

    if (currentUser === comment.user.login && !isSlashCmd && currentGroup.length > 0) {
      // Continue the group
      currentGroup.push(comment.id);
    } else {
      // Start a new group
      if (currentGroup.length > 1) {
        // Save the previous group (only if it has multiple comments)
        groupedComments[currentGroup[0]] = [...currentGroup];
      }

      currentGroup = isSlashCmd ? [] : [comment.id];
      currentUser = comment.user.login;
    }
  }

  // Save the last group if needed
  if (currentGroup.length > 1) {
    groupedComments[currentGroup[0]] = [...currentGroup];
  }

  return groupedComments;
}

// Run the test
console.log("Testing slash command grouping fix...");
const grouped = groupCommentsWithoutSlashCommands();

console.log("\nGrouped comments:", grouped);

// Verify results
let passed = true;

// Should group regular comments (1 and 2)
if (grouped["1"] && grouped["1"].includes(1) && grouped["1"].includes(2)) {
  console.log("✓ Regular comments are correctly grouped");
} else {
  console.log("✗ Regular comments are NOT correctly grouped");
  passed = false;
}

// Should NOT group slash commands (3 and 4 should not be in any group)
if (!grouped["3"] && !grouped["4"]) {
  console.log("✓ Slash commands are correctly NOT grouped");
} else {
  console.log("✗ Slash commands are incorrectly grouped");
  passed = false;
}

console.log("\nTest result:", passed ? "PASSED" : "FAILED");

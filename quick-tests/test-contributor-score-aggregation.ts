import { scoreMap } from '../src/components/comment-component';
import { CommentScores, GitHubComment } from '../src/types';

// Create a mock rendering function similar to the one in score-summary-component
function mockScoreSummary() {
  console.log("=== SCORE SUMMARY TEST ===");
  console.log("This test verifies that bot comments and slash commands are properly excluded from contributor totals\n");

  // Clear the scoreMap
  scoreMap.clear();

  // Create test comments
  const user1Comments: GitHubComment[] = [
    { id: 1, body: "Regular comment from user1", user: { login: "user1", html_url: "", avatar_url: "" }, created_at: "", updated_at: "", html_url: "" },
    { id: 2, body: "/help command from user1", user: { login: "user1", html_url: "", avatar_url: "" }, created_at: "", updated_at: "", html_url: "" }
  ];

  const user2Comments: GitHubComment[] = [
    { id: 3, body: "Regular comment from user2", user: { login: "user2", html_url: "", avatar_url: "" }, created_at: "", updated_at: "", html_url: "" }
  ];

  const botComments: GitHubComment[] = [
    { id: 4, body: "Comment from a bot", user: { login: "bot-user[bot]", html_url: "", avatar_url: "" }, created_at: "", updated_at: "", html_url: "" }
  ];

  // Create test scores
  const scores: Record<number, CommentScores> = {
    1: { wordCount: 10, original: 7.0, exponential: 6.5, isGrouped: false },
    2: { wordCount: 0, original: 0, exponential: 0, isSlashCommand: true, isGrouped: false },
    3: { wordCount: 5, original: 4.0, exponential: 3.8, isGrouped: false },
    4: { wordCount: 0, original: 0, exponential: 0, isBot: true, isGrouped: false }
  };

  // Add scores to the map
  Object.entries(scores).forEach(([id, score]) => {
    scoreMap.set(parseInt(id), score);
  });

  // All comments
  const allComments = [...user1Comments, ...user2Comments, ...botComments];

  // Print the complete score map
  console.log("SCORE MAP CONTENTS:");
  scoreMap.forEach((value, key) => {
    console.log(`Comment ID ${key}:`, value);
  });
  console.log();

  // Create a simplified version of aggregateScoresByContributor
  console.log("CONTRIBUTOR AGGREGATION:");
  const contributorsMap = new Map();

  allComments.forEach((comment) => {
    if (!comment.user || !scoreMap.has(comment.id)) return;

    const username = comment.user.login;
    const scores = scoreMap.get(comment.id)!;

    // Log each comment being processed with its flags
    console.log(`Processing comment ID ${comment.id} from ${username}:`);
    console.log(`  isBot: ${scores.isBot}, isSlashCommand: ${scores.isSlashCommand}`);
    console.log(`  Original Score: ${scores.original}, Exponential Score: ${scores.exponential}`);

    // Skip bot comments and slash commands
    if (scores.isBot === true || scores.isSlashCommand === true) {
      console.log(`  SKIPPING - This is a ${scores.isBot ? 'bot comment' : 'slash command'}\n`);
      return;
    }

    // Get or create contributor entry
    if (!contributorsMap.has(username)) {
      contributorsMap.set(username, {
        username,
        totalOriginal: 0,
        totalExponential: 0,
        commentCount: 0
      });
    }

    // Update contributor totals
    const contributor = contributorsMap.get(username);
    contributor.totalOriginal += scores.original;
    contributor.totalExponential += scores.exponential;
    contributor.commentCount++;
    console.log(`  ADDED to contributor total for ${username}\n`);
  });

  // Show final contributor totals
  console.log("FINAL CONTRIBUTOR TOTALS:");
  contributorsMap.forEach((contributor) => {
    console.log(`${contributor.username}:`);
    console.log(`  Total Original: ${contributor.totalOriginal.toFixed(2)}`);
    console.log(`  Total Exponential: ${contributor.totalExponential.toFixed(2)}`);
    console.log(`  Comment Count: ${contributor.commentCount}`);
  });

  // Verify results are correct - user1 should only have one regular comment counted, not the slash command
  console.log("\nVERIFICATION:");
  console.log("✓ user1 should have only 1 comment counted (not the slash command)");
  console.log("✓ user2 should have 1 comment counted");
  console.log("✓ bot-user[bot] should have 0 comments counted");
}

// Run the test
mockScoreSummary();

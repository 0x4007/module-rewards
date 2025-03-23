import { scoreMap } from './src/components/comment-component';
import { GitHubComment } from './src/types';

// Mock aggregateScoresByContributor function to test comment filtering
function mockAggregation() {
  console.log("=== MOCK AGGREGATION TEST ===");
  
  // Clear the map first
  scoreMap.clear();
  
  // Setup test comments
  const comments: GitHubComment[] = [
    { id: 1, body: "Regular comment", user: { login: "user1", html_url: "", avatar_url: "" }, created_at: "", updated_at: "", html_url: "" },
    { id: 2, body: "/slash command", user: { login: "user2", html_url: "", avatar_url: "" }, created_at: "", updated_at: "", html_url: "" },
    { id: 3, body: "Bot message", user: { login: "dependabot[bot]", html_url: "", avatar_url: "" }, created_at: "", updated_at: "", html_url: "" }
  ];
  
  // Set up score map
  scoreMap.set(1, { wordCount: 10, original: 7.5, exponential: 7.0, isGrouped: false });
  scoreMap.set(2, { wordCount: 0, original: 0, exponential: 0, isGrouped: false, isSlashCommand: true });
  scoreMap.set(3, { wordCount: 0, original: 0, exponential: 0, isGrouped: false, isBot: true });
  
  console.log("ScoreMap content:");
  scoreMap.forEach((value, key) => {
    console.log(`Comment ID ${key}:`, value);
  });

  // Import function and run it (this will use the score-summary-component.ts file)
  try {
    // This would normally be: 
    // import { aggregateScoresByContributor } from './src/components/score-summary-component';
    // However since it's not exported, let's implement a simplified version that's similar
    const filtered = [];
    comments.forEach(comment => {
      if (!comment.user || !scoreMap.has(comment.id)) return;
      
      const scores = scoreMap.get(comment.id)!;
      
      // This is the key check - should skip bot and slash commands
      console.log(`Checking comment ID ${comment.id} (${comment.user.login}): isBot=${scores.isBot}, isSlashCommand=${scores.isSlashCommand}`);
      if (scores.isBot === true || scores.isSlashCommand === true) {
        console.log(`Skipping comment ID ${comment.id} - is bot or slash command`);
        return;
      }
      
      filtered.push({
        user: comment.user,
        scores
      });
    });
    
    console.log("\nFiltered result (should only include comment ID 1):");
    console.log(filtered);
  } catch (e) {
    console.error("Error running test:", e);
  }
}

// Run the test
mockAggregation();

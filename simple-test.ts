import { calculateAllScores } from './src/scoring-utils';

// Test 1: Regular comment
console.log("=== Regular Comment ===");
const regular = calculateAllScores("This is a regular comment with normal scoring");
console.log(`Word Count: ${regular.wordCount}`);
console.log(`Original Score: ${regular.original.toFixed(2)}`);
console.log(`Exponential Score: ${regular.exponential.toFixed(2)}`);

// Test 2: Slash command
console.log("\n=== Slash Command ===");
const slashCommand = calculateAllScores("/help me with this problem", undefined, true);
console.log(`Word Count: ${slashCommand.wordCount}`);
console.log(`Original Score: ${slashCommand.original.toFixed(2)}`);
console.log(`Exponential Score: ${slashCommand.exponential.toFixed(2)}`);
console.log(`Is Slash Command: ${slashCommand.isSlashCommand}`);

// Test 3: Bot comment
console.log("\n=== Bot Comment ===");
const botComment = calculateAllScores("This is an automated bot message", undefined, false, true);
console.log(`Word Count: ${botComment.wordCount}`);
console.log(`Original Score: ${botComment.original.toFixed(2)}`);
console.log(`Exponential Score: ${botComment.exponential.toFixed(2)}`);
console.log(`Is Bot: ${botComment.isBot}`);

import { calculateAllScores } from './src/scoring-utils';

console.log('Testing Scoring Changes for Special Comments:
');

// Test regular comment
const regularComment = 'This is a normal comment with some content for testing purposes.';
const regularScores = calculateAllScores(regularComment);
console.log('Regular Comment Scores:');
console.log(regularScores);
console.log();

// Test slash command
const slashCommand = '/help This is a slash command';
const slashScores = calculateAllScores(slashCommand, undefined, true, false);
console.log('Slash Command Scores:');
console.log(slashScores);
console.log();

// Test bot comment
const botComment = 'This is a comment from a bot account';
const botScores = calculateAllScores(botComment, undefined, false, true);
console.log('Bot Comment Scores:');
console.log(botScores);


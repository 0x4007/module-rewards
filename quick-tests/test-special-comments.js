console.log('Testing Bot and Slash Command Scoring Changes');

// Create test scores
const testScores = [
  {wordCount: 50, original: 25.5, exponential: 20.8, isBot: true},
  {wordCount: 30, original: 18.2, exponential: 16.3, isSlashCommand: true},
  {wordCount: 60, original: 29.7, exponential: 23.1}
];

// Import from score-summary-component
const {renderScoreSummary} = require('../src/components/score-summary-component');

// Test aggregation
const result = aggregateScoresByContributor(
  [{id: 1, user: {login: 'bot-user'}}, {id: 2, user: {login: 'slash-user'}}, {id: 3, user: {login: 'normal-user'}}],
  [],
  new Map([[1, testScores[0]], [2, testScores[1]], [3, testScores[2]]])
);

console.log('Aggregated contributors:', result.length);
console.log('Should only include normal-user, skipping bot and slash command comments');

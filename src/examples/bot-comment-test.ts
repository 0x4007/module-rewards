import { BotCommentPreprocessor } from "../modules/bot-comment-preprocessor";
import { countWords } from "../scoring-utils";
import { createCloudEvent } from "../utils/cloud-events";

/**
 * Example script demonstrating how to use the BotCommentPreprocessor module
 *
 * This sample shows:
 * 1. Creating CloudEvents with comments from various users including bots
 * 2. Configuring the BotCommentPreprocessor module with custom options
 * 3. Processing the events through the module
 * 4. Showing how bot comments affect word counting and scoring
 *
 * To run this example:
 * bun src/examples/bot-comment-test.ts
 */
async function main() {
  console.log("BotCommentPreprocessor Module Test\n");

  // Create sample comments with various authors
  const sampleComments = [
    {
      name: "Regular User Comment",
      content: "This is a normal comment from a regular user that should be scored as usual.",
      author: "regular-user"
    },
    {
      name: "GitHub Bot Comment",
      content: "This pull request has been automatically labeled with `enhancement`.",
      author: "github-actions[bot]"
    },
    {
      name: "Dependabot Comment",
      content: "Bumps [lodash](https://github.com/lodash/lodash) from 4.17.20 to 4.17.21.",
      author: "dependabot"
    },
    {
      name: "Custom Bot",
      content: "Build failed! See the logs for more details.",
      author: "ci-bot"
    },
    {
      name: "Excluded Bot",
      content: "This comment is from a bot that's on the exclude list, so it should still be scored.",
      author: "allowed-bot"
    },
  ];

  // Create default bot comment preprocessor
  const defaultPreprocessor = new BotCommentPreprocessor();

  // Create preprocessor with custom configuration
  const customPreprocessor = new BotCommentPreprocessor({
    additionalBotNames: ["ci-bot", "test-bot"], // Add some custom bot names
    excludeBots: ["allowed-bot"],               // Exclude certain bots from filtering
    checkGitHubBotProperty: true                // Check GitHub's bot property
  });

  // Process each sample comment with both preprocessors
  for (const sample of sampleComments) {
    console.log(`\n===== ${sample.name} =====`);
    console.log("Content:", sample.content);
    console.log("Author:", sample.author);

    // Create a CloudEvent with the sample comment
    const event = createCloudEvent({
      id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      source: "example-app",
      type: "com.github.issue_comment.created",
      data: {
        comment: {
          body: sample.content,
          user: {
            login: sample.author,
            // If the author ends with [bot], also set the GitHub bot property
            type: sample.author.endsWith("[bot]") ? "Bot" : "User"
          }
        }
      },
    });

    // Process with default preprocessor
    const defaultResult = await defaultPreprocessor.transform(event, {});

    // Process with custom preprocessor
    const customResult = await customPreprocessor.transform(event, {});

    // Show results
    console.log("\nDefault Preprocessor Results:");
    console.log(`- Is Bot: ${defaultResult.isBot}`);
    console.log(`- Word Count (without filter): ${countWords(sample.content)}`);
    console.log(`- Word Count (with filter): ${countWords(sample.content, false, defaultResult.isBot)}`);

    console.log("\nCustom Preprocessor Results:");
    console.log(`- Is Bot: ${customResult.isBot}`);
    console.log(`- Word Count (with filter): ${countWords(sample.content, false, customResult.isBot)}`);

    console.log("\n-----------------------------------");
  }

  // Show how this works in a module chain
  console.log("\n\n=== Module Chain Example ===\n");

  // Sample bot comment
  const botComment = "This PR has been automatically labeled with `dependencies`";
  const botAuthor = "dependabot";

  console.log("Processing bot comment:", botComment);
  console.log("Author:", botAuthor);

  // Create a CloudEvent
  const chainEvent = createCloudEvent({
    id: `chain-test-${Date.now()}`,
    source: "example-app",
    type: "com.github.issue_comment.created",
    data: {
      comment: {
        body: botComment,
        user: { login: botAuthor }
      }
    },
  });

  // Initialize result object
  let result: { isBot?: boolean; content?: string; author?: string } = {};

  // Process through the preprocessor
  console.log("\nStep 1: Bot Comment Preprocessor");
  const preprocessor = new BotCommentPreprocessor();
  result = await preprocessor.transform(chainEvent, result);
  console.log("Result:", result);

  // In a real module chain, the next module would use the isBot flag
  console.log("\nStep 2: Word Counting (simulated next module)");
  const wordCount = countWords(botComment, false, result.isBot);
  console.log(`Word Count: ${wordCount} (would be ${countWords(botComment)} without bot comment filtering)`);

  console.log("\nTest completed successfully.");
}

// Run the example
main().catch((error) => {
  console.error("Error running example:", error);
});

import { SlashCommandPreprocessor } from "../modules/slash-command-preprocessor";
import { countWords } from "../scoring-utils";
import { createCloudEvent } from "../utils/cloud-events";

/**
 * Example script demonstrating how to use the SlashCommandPreprocessor module
 *
 * This sample shows:
 * 1. Creating CloudEvents with comments containing slash commands
 * 2. Configuring the SlashCommandPreprocessor module with custom options
 * 3. Processing the events through the module
 * 4. Showing how slash commands affect word counting and scoring
 *
 * To run this example:
 * bun src/examples/slash-command-test.ts
 */
async function main() {
  console.log("SlashCommandPreprocessor Module Test\n");

  // Create sample comments with and without slash commands
  const sampleComments = [
    {
      name: "Regular Comment",
      content: "This is a normal comment that should be scored as usual.",
    },
    {
      name: "Slash Command",
      content: "/help show me the available commands",
    },
    {
      name: "Slash Command with Leading Whitespace",
      content: "  /status check the current status of the project",
    },
    {
      name: "Comment with Code",
      content: "Here's a code example: ```const x = 1;```",
    },
    {
      name: "Excluded Command",
      content: "/feedback This comment starts with a slash but should still be scored.",
    },
  ];

  // Create default slash command preprocessor
  const defaultPreprocessor = new SlashCommandPreprocessor();

  // Create preprocessor with custom configuration
  const customPreprocessor = new SlashCommandPreprocessor({
    ignoreLeadingWhitespace: false, // Only detect commands with no leading whitespace
    excludeCommands: ["feedback"] // Don't filter comments starting with /feedback
  });

  // Process each sample comment with both preprocessors
  for (const sample of sampleComments) {
    console.log(`\n===== ${sample.name} =====`);
    console.log("Content:", sample.content);

    // Create a CloudEvent with the sample comment
    const event = createCloudEvent({
      id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      source: "example-app",
      type: "com.github.issue_comment.created",
      data: {
        comment: {
          body: sample.content,
          user: {
            login: "example-user"
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
    console.log(`- Is Slash Command: ${defaultResult.isSlashCommand}`);
    console.log(`- Word Count (without filter): ${countWords(sample.content)}`);
    console.log(`- Word Count (with filter): ${countWords(sample.content, defaultResult.isSlashCommand)}`);

    console.log("\nCustom Preprocessor Results:");
    console.log(`- Is Slash Command: ${customResult.isSlashCommand}`);
    console.log(`- Word Count (with filter): ${countWords(sample.content, customResult.isSlashCommand)}`);

    console.log("\n-----------------------------------");
  }

  // Show how this works in a module chain
  console.log("\n\n=== Module Chain Example ===\n");

  // Sample slash command
  const slashComment = "/assign @user1 @user2";

  console.log("Processing slash command:", slashComment);

  // Create a CloudEvent
  const chainEvent = createCloudEvent({
    id: `chain-test-${Date.now()}`,
    source: "example-app",
    type: "com.github.issue_comment.created",
    data: {
      comment: {
        body: slashComment,
        user: { login: "example-user" }
      }
    },
  });

  // Initialize result object with type declaration
  let result: { isSlashCommand?: boolean; content?: string } = {};

  // Process through the preprocessor
  console.log("\nStep 1: Slash Command Preprocessor");
  const preprocessor = new SlashCommandPreprocessor();
  result = await preprocessor.transform(chainEvent, result);
  console.log("Result:", result);

  // In a real module chain, the next module would use the isSlashCommand flag
  console.log("\nStep 2: Word Counting (simulated next module)");
  const wordCount = countWords(slashComment, result.isSlashCommand);
  console.log(`Word Count: ${wordCount} (would be ${countWords(slashComment)} without slash command filtering)`);

  console.log("\nTest completed successfully.");
}

// Run the example
main().catch((error) => {
  console.error("Error running example:", error);
});

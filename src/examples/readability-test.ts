import { ReadabilityScorer } from "../modules/readability-scorer";
import { createCloudEvent } from "../utils/cloud-events";

/**
 * Example script demonstrating how to use the ReadabilityScorer module
 *
 * This sample shows:
 * 1. Creating a CloudEvent with text content
 * 2. Configuring a module with custom options
 * 3. Processing the event through the module
 * 4. Examining the results
 *
 * To run this example, first install dependencies:
 * bun add text-readability
 *
 * Then run:
 * bun src/examples/readability-test.ts
 */
async function main() {
  console.log("ReadabilityScorer Module Test\n");

  // Create sample text content with different readability levels
  const sampleTexts = [
    // Very easy text (elementary school level)
    {
      name: "Easy Text",
      content: "I went to the store. I bought some milk. The milk was cold. I like milk.",
    },
    // Medium text (high school level)
    {
      name: "Medium Text",
      content:
        "The implementation of cloud-native architecture requires careful consideration of microservice boundaries and data consistency patterns. Teams should evaluate trade-offs between synchronous and asynchronous communication.",
    },
    // Hard text (academic/scientific)
    {
      name: "Complex Text",
      content:
        "The quantitative analysis of phenotypic variance attributable to polygenic inheritance necessitates the utilization of sophisticated statistical methodologies to disentangle epistatic interactions from pleiotropic effects, thereby elucidating the genetic architecture underlying complex traits.",
    },
  ];

  // Create an instance of the ReadabilityScorer module with custom config
  const scorer = new ReadabilityScorer({
    targetScore: 60, // Target score (standard readability)
    debug: true, // Enable debug output
    weight: 1.0, // Full weight for scores
    includeAllMetrics: true, // Include all available metrics
  });

  // Process each sample text
  for (const sample of sampleTexts) {
    console.log(`\n===== ${sample.name} =====`);

    // Create a CloudEvent with the sample text
    // This mimics how an event would look coming from a platform adapter
    const event = createCloudEvent({
      id: `test-${Date.now()}`,
      source: "example-app",
      type: "com.example.text.analyzed",
      data: {
        content: sample.content,
      },
    });

    // Initial empty result object (this would normally come from previous modules)
    const initialResult = {};

    // Process the event through the module
    const result = await scorer.transform(event, initialResult);

    // Display the results
    console.log("\nText:", sample.content);

    if (result.readability) {
      const r = result.readability;
      console.log("\nReadability Score Results:");
      console.log(`- Flesch Reading Ease: ${r.fleschReadingEase.toFixed(1)}`);
      console.log(`- Interpretation: ${interpretScore(r.fleschReadingEase)}`);
      console.log(`- Normalized Score: ${r.normalizedScore.toFixed(2)}`);
      console.log(`- Weighted Score: ${result.weightedReadabilityScore.toFixed(2)}`);

      // Display additional metrics if available
      if (r.fleschKincaidGrade !== undefined) {
        console.log("\nAdditional Metrics:");
        console.log(`- Flesch-Kincaid Grade Level: ${r.fleschKincaidGrade.toFixed(1)}`);
        console.log(`- Gunning Fog Index: ${r.gunningFogIndex?.toFixed(1)}`);
        console.log(`- Coleman-Liau Index: ${r.colemanLiauIndex?.toFixed(1)}`);
        console.log(`- SMOG Index: ${r.smogIndex?.toFixed(1)}`);
        console.log(`- Automated Readability Index: ${r.automatedReadabilityIndex?.toFixed(1)}`);
      }

      // Display text statistics if available
      if (r.textStats) {
        console.log("\nText Statistics:");
        console.log(`- Words: ${r.textStats.words}`);
        console.log(`- Sentences: ${r.textStats.sentences}`);
        console.log(`- Syllables: ${r.textStats.syllables}`);
        console.log(`- Words per Sentence: ${r.textStats.wordsPerSentence.toFixed(1)}`);
        console.log(`- Syllables per Word: ${r.textStats.syllablesPerWord.toFixed(1)}`);
      }
    } else {
      console.log("\nNo readability results were generated.");
    }

    console.log("\n-----------------------------------");
  }

  console.log("\nTest completed successfully.");
}

/**
 * Helper function to interpret a Flesch-Kincaid score
 */
function interpretScore(score: number): string {
  if (score >= 90) return "Very easy to read (5th grade)";
  if (score >= 80) return "Easy to read (6th grade)";
  if (score >= 70) return "Fairly easy to read (7th grade)";
  if (score >= 60) return "Standard/plain English (8th-9th grade)";
  if (score >= 50) return "Fairly difficult to read (10th-12th grade)";
  if (score >= 30) return "Difficult to read (college level)";
  return "Very difficult to read (college graduate level)";
}

// Run the example
main().catch((error) => {
  console.error("Error running example:", error);
});

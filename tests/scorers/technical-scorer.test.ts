import { beforeEach, describe, expect, it } from "bun:test";
import { TechnicalScorer } from "../../scorers/technical-scorer";

describe("TechnicalScorer", () => {
  let scorer: TechnicalScorer;

  beforeEach(() => {
    scorer = new TechnicalScorer({ debug: false });
  });

  it("should handle empty text", async () => {
    const result = await scorer.score("");
    expect(result.rawScore).toBe(0);
    expect(result.normalizedScore).toBe(0);
    expect(result.metrics.codeBlockCount).toBe(0);
  });

  it("should analyze code blocks", async () => {
    const content = `
Here's an example code block:

\`\`\`typescript
// This is a well-formatted code block
function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}
\`\`\`
`;

    const result = await scorer.score(content);
    expect(result.metrics.codeBlockCount).toBe(1);
    expect(result.metrics.codeBlockScore).toBeGreaterThan(0);
  });

  it("should detect technical terms", async () => {
    const content = "This function uses async/await with a Promise to handle API calls.";
    const result = await scorer.score(content);

    expect(result.metrics.technicalTermCount).toBeGreaterThan(0);
    expect(result.metrics.technicalTermScore).toBeGreaterThan(0);
  });

  it("should evaluate explanation quality", async () => {
    const content = `
## Overview

This section explains how the system works:

* First, we initialize the connection
* Then, we validate the input
* Finally, we process the request

For example, when handling API requests, we need to:
1. Check authentication
2. Validate parameters
3. Process the request
4. Return the response
`;

    const result = await scorer.score(content);
    expect(result.metrics.explanationScore).toBeGreaterThan(0.5);
    expect(result.metrics.explanationLines).toBeGreaterThan(5);
  });

  it("should apply custom weights", async () => {
    const customWeights = {
      codeBlockQuality: 0.6,
      technicalTerms: 0.3,
      explanationQuality: 0.1,
    };

    scorer = new TechnicalScorer({ weights: customWeights });
    const content = `
Here's a code example:

\`\`\`typescript
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

The function takes two parameters and returns their sum.
`;

    const result = await scorer.score(content);
    expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(result.normalizedScore).toBeLessThanOrEqual(1);
  });

  it("should handle multiple code blocks", async () => {
    const content = `
First example:
\`\`\`typescript
const x = 1;
\`\`\`

Second example:
\`\`\`typescript
const y = 2;
\`\`\`
`;

    const result = await scorer.score(content);
    expect(result.metrics.codeBlockCount).toBe(2);
  });
});

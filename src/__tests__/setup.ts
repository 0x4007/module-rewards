/**
 * Test Setup and Configuration
 *
 * This file contains setup for the test suite.
 * It's executed before tests run.
 */

// Import required packages for tests
// This ensures that test files can import these without mocking them
try {
  require("text-readability");
} catch (e) {
  console.warn(`
    WARNING: text-readability package is not installed.
    Tests for ReadabilityScorer will fail.
    Run 'bun add text-readability' to install it.
  `);
}

/**
 * Extend global types for TypeScript
 */
declare global {
  var testEnvironment: {
    setup: boolean;
    timestamp: string;
  };
}

/**
 * Setting up globals for tests if needed
 */
global.testEnvironment = {
  setup: true,
  timestamp: new Date().toISOString(),
};

// Make sure TypeScript exports the declaration
export {};

/**
 * Run any setup code here that should execute before tests
 */
function setup() {
  console.log("Setting up test environment...");
  // Add any setup code here
}

setup();

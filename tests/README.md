# Module Tests

This directory contains comprehensive tests for the text-conversation-rewards modules and core components. These tests demonstrate how to use the components and provide validation of their behavior.

## Running Tests

You can run the tests using the scripts defined in package.json:

```bash
# Run all tests once
bun test

# Run tests in watch mode (tests re-run when files change)
bun test:watch

# Run tests with coverage reporting
bun test:coverage

# Run a specific test file
bun test src/__tests__/modules/content-filter.test.ts
```

## Test Structure

The tests are organized by component type:

- **Core Components**: Tests for the foundational framework

  - `module-chain.test.ts` - Tests for module chains and registry

- **Modules**: Tests for individual processing modules

  - `content-filter.test.ts` - Tests for the ContentFilter module
  - `readability-scorer.test.ts` - Tests for the ReadabilityScorer module

- **Utilities**: Tests for helper functions
  - `cloud-events.test.ts` - Tests for CloudEvents creation/handling

## Test Patterns Demonstrated

These tests showcase several important patterns for working with the module architecture:

### 1. Creating Events

```typescript
// Create a GitHub issue comment event
const event = createCloudEvent({
  id: "test-1",
  source: "github",
  type: "com.github.issue_comment.created",
  data: {
    comment: {
      body: "This is a test comment from GitHub.",
    },
  },
});
```

### 2. Configuring Modules

```typescript
// Configure module with custom options
const filter = new ContentFilter({
  excludeBots: false,
  minLength: 5,
  excludeUsers: ["github-actions[bot]"],
});
```

### 3. Processing Events with Modules

```typescript
// Process an event through a module
const result = await module.transform(event, initialState);
```

### 4. Chaining Modules

```typescript
// Create a chain and add modules
const chain = new ModuleChain("test-chain");
chain.addModule(new ContentFilter());
chain.addModule(new ReadabilityScorer());

// Execute the chain with an event
const results = await chain.execute(event);
```

## Mocking Dependencies

The tests demonstrate how to mock external dependencies:

```typescript
// Example of mocking the text-readability package
mock.module("text-readability", () => {
  return {
    fleschReadingEase: () => 70.5,
    // ... other mocked functions
  };
});
```

## Adding New Tests

When adding tests for new modules:

1. Create a new test file in the appropriate directory
2. Import the necessary testing utilities from 'bun:test'
3. Structure your tests with describe/test blocks
4. Use helper functions from existing tests to create events
5. Make assertions about the module's behavior

## Error Conditions

The tests also cover error conditions:

- Handling empty or missing content
- Processing content from different platforms
- Module execution when previous modules have filtered content
- Module chain continuing execution when a module fails

These patterns provide a framework for testing all aspects of the module system.

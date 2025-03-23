# Experimental Modules

This directory contains experimental modules and features that are not currently used in the main application but may be useful for future development.

## Modules

### Bot Comment Preprocessor
Located in `modules/bot-comment-preprocessor.ts`

Identifies and filters comments from bot accounts to exclude them from scoring metrics. Useful when you want to focus scoring on human-generated content only.

Example usage:
```typescript
const preprocessor = new BotCommentPreprocessor({
  additionalBotNames: ["ci-bot", "test-bot"] // Add custom bot names
});
```

### Slash Command Preprocessor
Located in `modules/slash-command-preprocessor.ts`

Identifies comments that start with slash commands (e.g., `/help`, `/status`) and flags them for special handling. Useful for implementing command-based interactions.

Example usage:
```typescript
const preprocessor = new SlashCommandPreprocessor({
  ignoreLeadingWhitespace: false // Only detect commands with no leading whitespace
});
```

## Test Files

- `bot-comment-test.ts`: Demonstrates usage of the BotCommentPreprocessor
- `slash-command-test.ts`: Demonstrates usage of the SlashCommandPreprocessor

## Future Development

These modules are maintained for potential future use cases. To integrate them into the main application:

1. Move the desired module from `src/experimental/modules` back to `src/modules`
2. Add the module export to `src/modules/index.ts`
3. Update the module chain configuration in `server.ts` or other relevant files
4. Add appropriate tests in `src/__tests__/modules`

# Text Conversation Rewards: New Architecture

This document outlines the implementation plan for the new platform-agnostic, event-driven architecture for the text-conversation-rewards system. It provides guidance on how to use the foundation we've built and how to proceed with implementing the rest of the modules.

## Current Implementation Status

We've implemented a foundational framework with these key components:

- ✅ **Core Framework**
  - CloudEvents standardization for cross-platform events
  - Module base interface for consistent processing
  - Module chain system for configurable processing pipelines
  - Event router for directing events to appropriate chains

- ✅ **Platform Adapters**
  - Platform adapter base interface
  - GitHub adapter implementation

- ✅ **Initial Modules**
  - ContentFilter module (formerly DataPurgeModule)
  - ReadabilityScorer module (using the `text-readability` npm package)

- ✅ **Templates & Examples**
  - Module creation template
  - Example usage for ReadabilityScorer

## Adding New Modules

To add a new module, follow these steps:

1. **Copy the template**: Start from `src/templates/module-template.ts`
2. **Rename**: Update module class and interface names
3. **Configure**: Define configuration options and defaults
4. **Implement**: Add your module-specific processing logic
5. **Test**: Create an example usage script similar to `src/examples/readability-test.ts`

## Module Migration Guide

When migrating existing modules, follow this strategy:

1. **Identify core functionality**: What does the module actually do?
2. **Simplify interfaces**: Make configuration more straightforward
3. **Generalize data extraction**: Handle multiple platforms consistently
4. **Ensure platform agnosticism**: Don't rely on GitHub-specific structures

### Migration Checklist

| Original Module | New Name | Migration Priority | Complexity |
|----------------|----------|-------------------|------------|
| UserExtractorModule | ContributorIdentifier | High | Medium |
| DataPurgeModule | ContentFilterer | High (Completed) | Low |
| FormattingEvaluatorModule | DocumentQualityScorer | Medium | High |
| ContentEvaluatorModule | AIRelevanceScorer | Low | High |
| ReviewIncentivizerModule | CodeReviewRewarder | Medium | High |
| EventIncentivesModule | ActivityTracker | Low | Medium |
| PermitGenerationModule | RewardTokenizer | Low | Medium |
| GithubCommentModule | FeedbackPublisher | Low | Low |

## Implementation Roadmap

### Phase 1: Core Modules (Current)
- [x] Set up core infrastructure
- [x] Implement ContentFilter module
- [x] Implement ReadabilityScorer module
- [ ] Implement ContributorIdentifier module

### Phase 2: Content Quality Modules
- [ ] Complete DocumentQualityScorer (integrate ReadabilityScorer)
- [ ] Implement AIRelevanceScorer (OpenAI integration)
- [ ] Implement basic CodeReviewRewarder for GitHub PRs

### Phase 3: Platform Expansion
- [ ] Implement Google Docs adapter
- [ ] Implement Telegram adapter
- [ ] Test cross-platform module execution

### Phase 4: YAML Configuration System
- [ ] Complete YAML parser
- [ ] Implement expression evaluation
- [ ] Create sample workflows

### Phase 5: Integration & Testing
- [ ] Side-by-side testing with existing system
- [ ] Performance optimization
- [ ] Documentation and examples

## Module Implementation Guidelines

1. **Single Responsibility**: Each module should do one thing well
2. **Consistent Patterns**: Follow the patterns in the template
3. **Error Handling**: Use try/catch and log errors appropriately
4. **Platform Agnosticism**: Extract data consistently from any platform
5. **Configuration**: Use clear, typed configuration options
6. **Testing**: Include example scripts and unit tests

## Example: Migrating FormattingEvaluatorModule

The current FormattingEvaluatorModule evaluates:
1. HTML elements and structure (headings, lists, code blocks)
2. Word count with configurable exponents
3. Flesch-Kincaid readability scores

In the new architecture, this is best split into:
1. A DocumentStructureScorer (for HTML elements)
2. A WordCountScorer (for word counting)
3. The ReadabilityScorer we've already implemented

This separation follows the single responsibility principle and makes each module simpler.

## Running Examples

To run the example modules:

```bash
# Install dependencies
bun add js-yaml @types/js-yaml text-readability

# Run readability example
bun src/examples/readability-test.ts
```

## Next Steps

1. Implement the next module (recommend ContributorIdentifier)
2. Enhance platform adapter to handle more event types
3. Implement full YAML configuration parsing
4. Test with real GitHub events

Remember, the goal is incremental implementation and testing. Each module should be testable in isolation before being integrated into the full system.

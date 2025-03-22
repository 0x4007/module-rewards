# Text Conversation Rewards: New Architecture Foundation

This directory contains the foundational components for the new architecture of the text-conversation-rewards system. It's designed for incremental adoption, allowing you to test the new approach while maintaining compatibility with the existing system.

## Architecture Overview

The new architecture is based on the following key principles:

1. **Platform-Agnostic Design**: All modules work with standardized event data, regardless of source
2. **CloudEvents Format**: Uses the [CloudEvents](https://cloudevents.io/) standard for event normalization
3. **Module Chains**: Configurable sequences of modules that process events
4. **Declarative Configuration**: GitHub Actions-inspired YAML configuration

## Directory Structure

```
src/
├── adapters/                       # Platform-specific adapters
│   ├── adapter-base.ts             # Base adapter interface
│   └── github/                     # GitHub adapter implementation
│       └── github-adapter.ts
│
├── config/                         # Configuration handling
│   ├── parser.ts                   # YAML configuration parser
│   └── types.ts                    # Configuration type definitions
│
├── core/                           # Core framework components
│   ├── event-router.ts             # Routes events to module chains
│   ├── module-base.ts              # Base module interface
│   └── module-chain.ts             # Module chain management
│
├── modules/                        # Module implementations
│   └── content-filter.ts           # Content filtering module
│
├── utils/                          # Shared utilities
│   └── cloud-events.ts             # CloudEvents utilities
│
└── index.ts                        # Main entry point
```

## Getting Started

To test the new architecture:

1. Install dependencies:
   ```
   bun add js-yaml @types/js-yaml
   ```

2. Uncomment the example usage code in `src/index.ts`:
   ```typescript
   if (require.main === module) {
     exampleUsage();
   }
   ```

3. Run the example:
   ```
   bun src/index.ts
   ```

## Implementation Status

- ✅ Core infrastructure (module chain, event router)
- ✅ Platform adapter interface
- ✅ GitHub adapter implementation
- ✅ Basic module implementation (ContentFilter)
- ⏳ YAML configuration parsing (placeholder)
- ⏳ Additional modules

## Next Steps

1. **Complete YAML Parser**: Implement the actual YAML parsing logic using js-yaml
2. **Create Sample Configuration**: Create example YAML files for testing
3. **Implement More Modules**: Convert remaining modules from the old system
4. **Add Integration Test**: Create a comprehensive integration test
5. **Expand Platform Support**: Add adapters for other platforms

## Testing Strategy

To test your assumptions about the new architecture:

1. **Incremental Testing**: Start by adding one module at a time
2. **Parallel Execution**: Run both old and new systems side by side
3. **Compare Results**: Verify that both systems produce similar results
4. **Add Platforms**: Test with different input sources

## Integration with Existing Code

You can integrate this new architecture with the existing system gradually:

1. Start by converting one module at a time
2. Initially, use the new system for read-only operations
3. Gradually shift processing load to the new system
4. Eventually, replace the old system entirely

## Adding New Modules

To add a new module:

1. Create a new file in the `modules/` directory
2. Extend the `BaseModule` class
3. Implement the required methods
4. Register the module in a module chain

Example:

```typescript
import { BaseModule } from '../core/module-base';
import { CloudEvent } from '../utils/cloud-events';

interface MyModuleConfig {
  // Configuration options
}

export class MyModule extends BaseModule<MyModuleConfig, Record<string, any>> {
  readonly name = 'my-module';
  readonly supportedEventTypes = /com\.github\..*/;

  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // Module implementation
    return { ...result, myResult: 'value' };
  }
}

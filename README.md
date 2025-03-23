# Content Scoring System

A modular system for analyzing and scoring content based on various metrics like readability and technical quality.

## Project Structure

```
├── src/
│   ├── core/           # Core system components
│   │   ├── module-base.ts
│   │   └── module-chain.ts
│   ├── modules/        # Scoring modules
│   │   ├── content-filter.ts
│   │   └── scoring-pipeline.ts
│   ├── scorers/        # Individual scoring implementations
│   │   ├── base-scorer.ts
│   │   ├── readability-scorer.ts
│   │   └── technical-scorer.ts
│   └── utils/          # Shared utilities
│       ├── cloud-events.ts
│       └── text-readability-shim.ts
├── experimental/       # Experimental features
└── tests/             # Test files
```

## Scoring Strategies

The system supports multiple scoring strategies through a modular architecture:

1. **Readability Scoring**
   - Flesch Reading Ease
   - Flesch-Kincaid Grade Level
   - Other readability metrics

2. **Technical Quality Scoring**
   - Code block analysis
   - Technical term usage
   - Explanation quality

3. **Future Scoring Modules** (Planned)
   - Sentiment analysis
   - Code quality metrics
   - Language model-based scoring
   - Citation and reference quality

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run tests
bun test
```

## Adding New Scoring Strategies

1. Create a new scorer in `src/scorers/`
2. Extend `BaseScorer` class
3. Implement scoring logic
4. Register in scoring pipeline

Example:

```typescript
export class NewScorer extends BaseScorer<Config> {
  readonly id = "new-scorer";

  async score(content: string): Promise<ScorerResult> {
    // Implementation
    return {
      rawScore: score,
      normalizedScore: this.normalize(score),
      metrics: { ... }
    };
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License

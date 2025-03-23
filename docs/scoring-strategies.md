# Scoring Strategies Architecture

This document outlines the architecture for implementing new scoring strategies in the content analysis system.

## Core Components

### 1. BaseScorer
The foundation for all scoring implementations:
```typescript
abstract class BaseScorer<TConfig extends BaseScorerConfig> {
  abstract get id(): string;
  abstract score(content: string): Promise<ScorerResult>;

  protected normalize(raw: number, min = 0, max = 100): number;
  protected applyWeight(score: number): number;
}
```

### 2. ScoringPipeline
Orchestrates multiple scorers:
```typescript
class ScoringPipeline {
  scorers: Array<{scorer: BaseScorer, weight: number}>;
  aggregationStrategy: "weighted-average" | "minimum" | "maximum";
}
```

## Current Scorers

1. **ReadabilityScorer**
   - Measures text readability using multiple algorithms
   - Configurable target score
   - Supports detailed metrics output

2. **TechnicalScorer**
   - Analyzes code blocks quality
   - Technical term usage
   - Explanation clarity
   - Customizable aspect weights

## Implementing New Scorers

### Template
```typescript
export interface NewScorerConfig extends BaseScorerConfig {
  // Scorer-specific configuration
}

export interface NewScorerResult extends ScorerResult {
  metrics: {
    // Scorer-specific metrics
  }
}

export class NewScorer extends BaseScorer<NewScorerConfig> {
  readonly id = "new-scorer";

  async score(content: string): Promise<NewScorerResult> {
    // Implementation
    return {
      rawScore: calculatedScore,
      normalizedScore: this.normalize(calculatedScore),
      metrics: { /* specific metrics */ }
    };
  }
}
```

### Best Practices

1. **Modular Design**
   - Keep scorers focused on single responsibility
   - Use composition for complex scoring logic
   - Share common utilities through helper functions

2. **Configuration**
   - Make scoring parameters configurable
   - Provide sensible defaults
   - Document configuration options

3. **Metrics**
   - Include both raw and normalized scores
   - Provide detailed metrics for transparency
   - Consider debug output options

4. **Performance**
   - Optimize for large content chunks
   - Consider caching when appropriate
   - Avoid blocking operations

## Planned Scoring Strategies

### 1. Sentiment Scorer
```typescript
interface SentimentScorerConfig {
  targetSentiment?: "positive" | "neutral" | "negative";
  weights?: {
    emotionalTone: number;
    subjectivity: number;
    intensity: number;
  };
}
```

### 2. Code Quality Scorer
```typescript
interface CodeQualityScorerConfig {
  weights?: {
    complexity: number;
    documentation: number;
    style: number;
    bestPractices: number;
  };
}
```

### 3. Language Model Scorer
```typescript
interface LMScorerConfig {
  model?: "gpt-3" | "gpt-4";
  aspects?: Array<{
    name: string;
    prompt: string;
    weight: number;
  }>;
}
```

### 4. Citation Quality Scorer
```typescript
interface CitationScorerConfig {
  weights?: {
    quantity: number;
    quality: number;
    relevance: number;
    diversity: number;
  };
}
```

## Integration Guidelines

1. **Registration**
   ```typescript
   const pipeline = new ScoringPipeline({
     scorers: [
       {
         scorer: new NewScorer(config),
         weight: 0.5
       }
     ]
   });
   ```

2. **Testing**
   - Create unit tests for each scoring aspect
   - Include edge cases and invalid inputs
   - Test configuration variations
   - Verify metric calculations

3. **Documentation**
   - Document configuration options
   - Provide usage examples
   - Explain scoring methodology
   - Include performance considerations

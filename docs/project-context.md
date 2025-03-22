## Scoring Algorithms

Three distinct scoring algorithms were implemented to evaluate comment quality:

1. **Original Score**
   ```
   score = wordCount^0.85
   ```
   A basic power-law relationship that rewards longer comments but with diminishing returns.

2. **Log-Adjusted Score**
   ```
   score = wordCount^0.85 * (1/log2(wordCount + 2))
   ```
   Introduces a logarithmic penalty for very long comments to better balance conciseness.

3. **Exponential-Adjusted Score**
   ```
   score = wordCount^0.85 * exp(-wordCount/100)
   ```
   Adds an exponential decay factor to more aggressively penalize excessive length.

## Key Features

The final visualization (`comment-scores.html`) includes:

- GitHub-style markdown rendering
- Proper handling of:
  - Code blocks
  - Blockquotes
  - Links
  - Lists
  - Horizontal rules
- Word counting that:
  - Excludes code blocks
  - Includes blockquote text
  - Handles markdown formatting
- Per-comment metrics
- User-based statistics
- Comparative scoring analysis

## Technical Details

### Word Count Implementation

The word counting algorithm carefully handles various markdown elements:
```javascript
const countWords = (text) => {
    // Remove code blocks
    let cleanText = text.replace(/`[^`]*`/g, '');
    // Keep link text, remove URLs
    cleanText = cleanText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove horizontal rules
    cleanText = cleanText.replace(/^-{3,}$/gm, '');
    // Keep blockquote text, remove markers
    cleanText = cleanText.replace(/^>\s*/gm, '');
    return cleanText.split(/\s+/).filter(w => w.length > 0).length;
};
```

## Future Considerations

1. **Additional Metrics**
   - Comment frequency analysis
   - Response time measurements
   - Thread depth impact

2. **Enhanced Visualization**
   - Time-based view
   - Conversation flow diagram
   - Interactive adjustments of scoring parameters

3. **Analysis Features**
   - Sentiment analysis
   - Code snippet detection
   - Link relevance scoring

## Note for Future LLMs

When working with this project:

1. Pay attention to the word counting implementation, which carefully handles markdown elements while preserving semantic content.
2. The scoring algorithms are designed to balance between encouraging thorough responses and maintaining conciseness.

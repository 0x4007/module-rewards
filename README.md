# Comment Score Analysis

A visualization tool for analyzing GitHub comment scores using different scoring algorithms. This project aims to evaluate conversation quality in GitHub discussions by applying various scoring methods to comment content.

## Scoring Algorithms

- **Original**: `wordCount^0.85`
  - Basic power-law relationship rewarding length with diminishing returns
- **Log-Adjusted**: `wordCount^0.85 * (1/log2(wordCount + 2))`
  - Introduces logarithmic penalty for very long comments
- **Exponential-Adjusted**: `wordCount^0.85 * exp(-wordCount/100)`
  - Adds exponential decay to more aggressively penalize excessive length

## Project Structure

- `src/` - Source code for the visualizations
  - `comment-scores.html` - Latest version with full feature set
  - `score-comparison-v2.html` - Enhanced comparison view
  - `score-comparison.html` - Initial comparison implementation
  - `score-visualization.html` - Original prototype
- `data/` - JSON data files from GitHub
- `docs/` - Documentation and analysis
  - [Project Context](docs/project-context.md) - Detailed background and technical information
  - `pr-31-conversation.md` - Original PR conversation

## Features

- GitHub-style markdown rendering
- Proper handling of code blocks, blockquotes, links, and formatting
- Per-comment metrics and user-based statistics
- Comparative analysis of different scoring approaches
- Clean, responsive visualization

## Getting Started

1. Clone this repository
2. Open `src/comment-scores.html` in a browser
3. Review the [Project Context](docs/project-context.md) for detailed information

## Contributing

When working with this codebase:
1. The visualization is self-contained with only marked.js as external dependency
2. Word counting carefully handles markdown elements while preserving content
3. Scoring algorithms balance thoroughness with conciseness

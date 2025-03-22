# Comment Score Analysis

A visualization tool for analyzing GitHub comment scores using different scoring algorithms:

- Original: wordCount^0.85
- Log-Adjusted: wordCount^0.85 * (1/log2(wordCount + 2))
- Exponential-Adjusted: wordCount^0.85 * exp(-wordCount/100)

## Project Structure

- `src/` - Source code for the visualization
- `data/` - JSON data files
- `docs/` - Documentation and analysis

## Getting Started

Open `src/comment-scores.html` in a browser to view the visualization.

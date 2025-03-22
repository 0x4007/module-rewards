# PR Comment Analysis

Analyze GitHub PR comments using multiple scoring algorithms to evaluate comment quality and contribution effectiveness.

## Features

- Multiple scoring algorithms (original, log-adjusted, exponential)
- Word count analysis excluding code blocks and URLs
- Comment visualization with GitHub-style formatting
- Statistical summaries and averages
- Support for both PR and issue comments

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Create a `.env` file using `.env.example` as a template and add your GitHub token:
   ```
   GITHUB_TOKEN=your_github_token
   ```

## Usage

1. Fetch PR comments:
   ```bash
   bun run fetch --owner organization --repo repository --number pr_number
   ```

2. Build and start the server:
   ```bash
   bun run build   # Build client-side code
   bun run start   # Start the server
   ```

3. Open http://localhost:3000 in your browser to view the analysis

## Scoring Algorithms

1. **Original Score**: wordCount^0.85
   - Basic scoring that grows sub-linearly with length

2. **Log-Adjusted Score**: wordCount^0.85 * (1/log2(wordCount + 2))
   - Penalizes very long comments while maintaining readability emphasis

3. **Exponential Score**: wordCount^0.85 * exp(-wordCount/100)
   - Strongly prefers concise, information-dense comments

## Development

- Source code in `src/` directory
- Client-side code compiled to `public/`
- Data files stored in `public/data/`

### File Structure

```
├── src/
│   ├── app.ts         # Server implementation
│   ├── client.ts      # Browser UI implementation
│   ├── scoring.ts     # Scoring algorithms
│   ├── types.ts       # TypeScript interfaces
│   └── fetch-pr-comments.ts  # GitHub data fetcher
├── public/
│   ├── pr-viewer.html # Main UI
│   ├── styles.css     # UI styling
│   └── data/         # JSON data files
```

## Project Documentation

See the `memory-bank/` directory for detailed project documentation:
- Project brief and goals
- System architecture
- Technical decisions
- Implementation progress

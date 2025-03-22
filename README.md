# PR Conversation Analyzer

A tool to analyze and score GitHub PR conversations, now with dynamic PR loading support.

## Setup

1. Install dependencies:
```bash
bun install
```

2. Copy .env.example to .env and add your GitHub token:
```bash
cp .env.example .env
# Edit .env and add your GITHUB_TOKEN
```

## Usage

### Running the Server

Start the local server:
```bash
bun start
```

The server will run at http://localhost:8080. You can analyze any GitHub PR in two ways:

1. Using the web interface:
   - Visit http://localhost:8080
   - Paste the GitHub PR URL (e.g., https://github.com/ubiquity-os-marketplace/command-ask/pull/31)
   - Click "Analyze Conversation"

2. Using URL parameters:
   - Format: http://localhost:8080/?url=github-pr-url
   - Example: http://localhost:8080/?url=https://github.com/ubiquity-os-marketplace/command-ask/pull/31

### Fetching PR Data

To fetch PR data for offline analysis:

```bash
bun fetch --owner org --repo name --number pr_number
```

Example:
```bash
bun fetch --owner ubiquity-os-marketplace --repo command-ask --number 31
```

## Features

- Dynamic PR loading through URL parameters
- Instant scoring and analysis
- Three scoring algorithms:
  1. Original: wordCount^0.85
  2. Log-adjusted: wordCount^0.85 * (1/log2(wordCount + 2))
  3. Exponential: wordCount^0.85 * exp(-wordCount/100)
- GitHub-style comment rendering
- Word counting with code block exclusion
- Comment statistics and averages

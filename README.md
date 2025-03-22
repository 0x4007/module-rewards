# PR Analysis Tool

A TypeScript-based application to analyze and visualize GitHub comment quality using different scoring algorithms, providing insights into conversation effectiveness in PR discussions.

## Features

- Multiple scoring algorithms (original, log-adjusted, exponential)
- Proper markdown rendering and word counting
- Individual comment analysis
- User contribution statistics
- Clean, responsive visualization

## Tech Stack

- **TypeScript**: Type-safe JavaScript
- **esbuild**: Fast, lean TypeScript/JavaScript bundler
- **Bun**: JavaScript runtime and package manager
- **Marked.js**: Markdown parsing and rendering

## Project Structure

```
├── src/                 # TypeScript source files
│   ├── types.ts         # Type definitions
│   ├── github-api.ts    # GitHub API integration
│   ├── scoring-utils.ts # Scoring algorithm implementations
│   ├── main.ts          # Main application entry point
│   └── server.ts        # Development server
├── public/              # Static assets
│   ├── index.html       # Main HTML file
│   ├── styles.css       # CSS styles
│   └── js/              # Compiled JavaScript (generated)
├── build/               # Build system
│   ├── build.ts         # Production build script
│   └── dev.ts           # Development server with hot reload
└── package.json         # Project configuration
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (JavaScript runtime)

### Installation

```bash
# Install dependencies
bun install
```

### Development

```bash
# Start development server with hot reloading
bun run dev
```

This will:
1. Compile TypeScript to JavaScript
2. Bundle the code with esbuild
3. Start a development server at http://localhost:3001
4. Watch for changes and automatically rebuild

### Building for Production

```bash
# Build for production
bun run build
```

### Running the Server

```bash
# Start the server only
bun run start
```

## Scoring Algorithms

The application implements three different scoring algorithms:

1. **Original Score**: Based on power-law (0.85 exponent): `Math.pow(wordCount, 0.85)`
2. **Log-Adjusted Score**: Balances length: `Math.pow(wordCount, 0.85) * (1 / Math.log2(wordCount + 2))`
3. **Exponential Score**: Penalizes verbosity: `Math.pow(wordCount, 0.85) * Math.exp(-wordCount / 100)`

## GitHub API Integration

The application integrates with GitHub's API to fetch:
- PR details
- PR review comments
- Issue comments

For best results, provide a GitHub personal access token when prompted.

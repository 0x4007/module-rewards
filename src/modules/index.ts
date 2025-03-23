export * from "./content-filter";
export * from "./scoring-pipeline";

/**
 * Module System Overview
 *
 * The module system is composed of specialized processors that can be chained
 * together to handle different aspects of content analysis and scoring.
 *
 * Pipeline Structure:
 *
 * 1. Content Analysis
 *    - Content Filter: Removes or flags inappropriate content
 *    - Scoring Pipeline: Orchestrates content scoring
 *      - Supports multiple scoring strategies (ReadabilityScorer, TechnicalScorer, etc.)
 *      - Results are aggregated using configurable strategies
 *      - Custom scorers can be added by extending BaseScorer
 *
 * Usage Example:
 *
 * ```typescript
 * const chain = new ModuleChain("scoring")
 *   .addModule(new ContentFilter())
 *   .addModule(new ScoringPipeline({
 *     scorers: [
 *       { scorer: new ReadabilityScorer({ targetScore: 70 }), weight: 0.6 },
 *       { scorer: new TechnicalScorer(), weight: 0.4 }
 *     ]
 *   }));
 *
 * const result = await chain.execute(event);
 * ```
 *
 * Note: Experimental modules (like bot comment and slash command processors)
 * can be found in the src/experimental directory.
 */

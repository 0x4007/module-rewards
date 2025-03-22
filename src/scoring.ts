/**
 * Calculates word count excluding code blocks, inline code, and URLs
 */
export function countWords(text: string): number {
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    // Remove inline code
    text = text.replace(/`[^`]+`/g, '');
    // Remove URLs
    text = text.replace(/https?:\/\/\S+/g, '');
    // Split into words and count
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Original scoring algorithm: wordCount^0.85
 */
export function calculateOriginalScore(wordCount: number): number {
    return Math.pow(wordCount, 0.85);
}

/**
 * Log-adjusted scoring algorithm: wordCount^0.85 * (1/log2(wordCount + 2))
 */
export function calculateLogAdjustedScore(wordCount: number): number {
    return Math.pow(wordCount, 0.85) * (1/Math.log2(wordCount + 2));
}

/**
 * Exponential scoring algorithm: wordCount^0.85 * exp(-wordCount/100)
 */
export function calculateExponentialScore(wordCount: number): number {
    return Math.pow(wordCount, 0.85) * Math.exp(-wordCount/100);
}

export interface CommentScores {
    wordCount: number;
    original: number;
    logAdjusted: number;
    exponential: number;
}

/**
 * Calculate all scores for a given text
 */
export function calculateAllScores(text: string): CommentScores {
    const wordCount = countWords(text);
    return {
        wordCount,
        original: calculateOriginalScore(wordCount),
        logAdjusted: calculateLogAdjustedScore(wordCount),
        exponential: calculateExponentialScore(wordCount)
    };
}

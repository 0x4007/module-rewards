/**
 * Browser-compatible shim for text-readability functions
 * Simplified implementation of core readability algorithms
 */

export function syllableCount(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  return words.reduce((count, word) => count + countSyllables(word), 0);
}

export function lexiconCount(text: string): number {
  const words = text.match(/\b\w+\b/g);
  return words ? words.length : 0;
}

export function sentenceCount(text: string): number {
  const sentences = text.split(/[.!?]+/);
  return sentences.filter(s => s.trim().length > 0).length;
}

export function wordsPerSentence(text: string): number {
  const words = lexiconCount(text);
  const sentences = Math.max(1, sentenceCount(text));
  return words / sentences;
}

export function fleschReadingEase(text: string): number {
  const words = lexiconCount(text);
  const sentences = Math.max(1, sentenceCount(text));
  const syllables = syllableCount(text);

  const avgSentenceLength = words / sentences;
  const avgSyllablesPerWord = syllables / Math.max(1, words);

  return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
}

export function fleschKincaidGrade(text: string): number {
  const words = lexiconCount(text);
  const sentences = Math.max(1, sentenceCount(text));
  const syllables = syllableCount(text);

  const avgSentenceLength = words / sentences;
  const avgSyllablesPerWord = syllables / Math.max(1, words);

  return (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;
}

export function gunningFog(text: string): number {
  const words = lexiconCount(text);
  const sentences = Math.max(1, sentenceCount(text));
  const complexWords = countComplexWords(text);

  const avgSentenceLength = words / sentences;
  const percentComplexWords = (complexWords / Math.max(1, words)) * 100;

  return 0.4 * (avgSentenceLength + percentComplexWords);
}

export function colemanLiau(text: string): number {
  const words = lexiconCount(text);
  const sentences = Math.max(1, sentenceCount(text));
  const letters = text.match(/[a-zA-Z]/g)?.length || 0;

  const L = (letters / Math.max(1, words)) * 100;
  const S = (sentences / Math.max(1, words)) * 100;

  return (0.0588 * L) - (0.296 * S) - 15.8;
}

export function smogIndex(text: string): number {
  const sentences = Math.max(1, sentenceCount(text));
  const complexWords = countComplexWords(text);

  return 1.043 * Math.sqrt((complexWords * 30) / sentences) + 3.1291;
}

export function automatedReadabilityIndex(text: string): number {
  const words = lexiconCount(text);
  const sentences = Math.max(1, sentenceCount(text));
  const characters = text.length;

  const avgWordLength = characters / Math.max(1, words);
  const avgSentenceLength = words / sentences;

  return (4.71 * avgWordLength) + (0.5 * avgSentenceLength) - 21.43;
}

// Helper functions
function countSyllables(word: string): number {
  word = word.toLowerCase().trim();
  if (!word) return 0;

  // Special cases
  if (word.length <= 3) return 1;
  if (word === "does") return 1;
  if (word === "doing") return 2;

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
}

function countComplexWords(text: string): number {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return words.filter(word => countSyllables(word) > 2).length;
}

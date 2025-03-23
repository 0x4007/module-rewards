declare module 'text-readability' {
  /**
   * Calculate Flesch Reading Ease score
   * @param text The text to analyze
   */
  export function fleschReadingEase(text: string): number;

  /**
   * Calculate Flesch-Kincaid Grade Level
   * @param text The text to analyze
   */
  export function fleschKincaidGrade(text: string): number;

  /**
   * Calculate Gunning Fog Index
   * @param text The text to analyze
   */
  export function gunningFog(text: string): number;

  /**
   * Calculate Coleman-Liau Index
   * @param text The text to analyze
   */
  export function colemanLiau(text: string): number;

  /**
   * Calculate SMOG Index
   * @param text The text to analyze
   */
  export function smogIndex(text: string): number;

  /**
   * Calculate Automated Readability Index
   * @param text The text to analyze
   */
  export function automatedReadabilityIndex(text: string): number;

  /**
   * Calculate the number of syllables in a word
   * @param word The word to count syllables for
   */
  export function syllable(word: string): number;

  /**
   * Calculate the total syllable count in text
   * @param text The text to analyze
   */
  export function syllableCount(text: string): number;

  /**
   * Count the number of letters in text
   * @param text The text to analyze
   */
  export function letterCount(text: string): number;

  /**
   * Count the number of words in text
   * @param text The text to analyze
   */
  export function lexiconCount(text: string, removePunctuation?: boolean): number;

  /**
   * Count the number of sentences in text
   * @param text The text to analyze
   */
  export function sentenceCount(text: string): number;

  /**
   * Calculate average sentence length
   * @param text The text to analyze
   */
  export function averageSentenceLength(text: string): number;

  /**
   * Calculate average syllables per word
   * @param text The text to analyze
   */
  export function averageSyllablesPerWord(text: string): number;

  /**
   * Calculate word count per sentence
   * @param text The text to analyze
   */
  export function wordsPerSentence(text: string): number;

  /**
   * Calculate percentage of difficult words
   * @param text The text to analyze
   */
  export function percentageWordsWithThreeSyllables(text: string, countProperNouns?: boolean): number;

  /**
   * Calculate Linsear Write Formula score
   * @param text The text to analyze
   */
  export function linsearWriteFormula(text: string): number;

  /**
   * Calculate text standard
   * @param text The text to analyze
   */
  export function textStandard(text: string, mode?: string): string | number;
}

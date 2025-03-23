export interface CommentProcessorConfig {
  minLength?: number;
  excludeBots?: boolean;
  excludeUsers?: string[];
  filterPatterns?: RegExp[];
}

export interface CommentData {
  id: string | number;
  body: string;
  user?: {
    login: string;
    type?: string;
  };
}

export interface ProcessedComment extends CommentData {
  isValid: boolean;
  invalidReason?: string;
}

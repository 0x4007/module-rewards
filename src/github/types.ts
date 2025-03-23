export interface UrlParseResult {
  owner: string;
  repo: string;
  number: string;
  type: "pr" | "issue";
}

export interface LinkedIssue {
  number: number;
  title: string;
  body: string;
  html_url: string;
  repository?: {
    owner: string;
    name: string;
  };
  comments?: any[];
}

export interface LinkedPullRequest {
  number: number;
  title: string;
  url: string;
  state: string;
  body: string;
  author: {
    login: string;
    html_url: string;
    avatar_url: string;
  };
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
  comments?: any[];
}

export interface FetchedData {
  details: any;
  comments: any[];
  type: "pr" | "issue";
  linkedIssue?: LinkedIssue;
  linkedPullRequests?: LinkedPullRequest[];
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    type?: string;
    path?: string[];
    message: string;
  }>;
}

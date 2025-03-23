export interface LinkedPullRequestsResponse {
  repository: {
    issue: {
      title: string;
      body: string;
      closedByPullRequestsReferences: {
        nodes: Array<{
          id: string;
          title: string;
          number: number;
          url: string;
          state: string;
          author: {
            login: string;
          };
          repository: {
            owner: {
              login: string;
            };
            name: string;
          };
        }>;
      };
    };
  };
}

export interface LinkedPRsQueryResponse {
  repository: {
    issue: {
      title: string;
      body: string;
      timelineItems: {
        nodes: Array<{
          source: {
            number: number;
            title: string;
            url: string;
            state: string;
            body: string;
            author: {
              login: string;
              url: string;
              avatarUrl: string;
            };
            repository: {
              name: string;
              owner: {
                login: string;
              };
            };
          };
        }>;
      };
    };
  };
}

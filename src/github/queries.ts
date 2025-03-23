export const LINKED_PULL_REQUESTS_QUERY = `
  query FindClosingPullRequests($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        closedByPullRequestsReferences(first: 10, includeClosedPrs: false) {
          nodes {
            id
            title
            number
            url
            state
            author {
              login
            }
            repository {
              owner {
                login
              }
              name
            }
          }
        }
      }
    }
  }
`;

export const ISSUES_LINKED_PRS_QUERY = `
  query FindLinkedPRs($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        title
        body
        number
        url
        state
        timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
          totalCount
          nodes {
            ... on CrossReferencedEvent {
              source {
                ... on PullRequest {
                  number
                  title
                  url
                  state
                  body
                  author {
                    login
                    url
                    avatarUrl
                  }
                  repository {
                    name
                    owner {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

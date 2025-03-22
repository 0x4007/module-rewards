import { LinkedIssue, LinkedPullRequest } from "./types";

// Main GraphQL query for finding linked pull requests that close an issue
// Adapted from text-conversation-rewards approach
const LINKED_PULL_REQUESTS_QUERY = `
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

// Query for finding PRs that reference an issue
const ISSUES_LINKED_PRS_QUERY = `
  query FindLinkedPRs($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        title
        body
        timelineItems(first: 50, itemTypes: [CROSS_REFERENCED_EVENT]) {
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

/**
 * Find a linked issue for a given PR
 */
export async function findLinkedIssue(
  owner: string,
  repo: string,
  prNumber: string,
  token: string
): Promise<LinkedIssue | undefined> {
  console.log(`🔎 Finding linked issue for PR ${owner}/${repo}#${prNumber}`);

  try {
    // Convert PR number to potential issue number (often PR closes issue with same or lower number)
    const issueNumber = parseInt(prNumber, 10);

    // Try looking for linked issues using closedByPullRequestsReferences
    const data = await executeGitHubGraphQL(
      LINKED_PULL_REQUESTS_QUERY,
      {
        owner,
        repo,
        issueNumber,
      },
      token
    );

    if (!data?.repository?.issue) {
      console.log(`No issue #${issueNumber} found in repository`);
      return undefined;
    }

    const linkedPRs = data.repository.issue.closedByPullRequestsReferences?.nodes || [];

    // Look for a PR that matches our target PR number
    const matchingPR = linkedPRs.find((pr: LinkedPullRequest) => pr.number === parseInt(prNumber, 10));

    if (matchingPR) {
      console.log(`Found issue #${issueNumber} is closed by PR #${prNumber}`);
      return {
        number: issueNumber,
        title: data.repository.issue.title || "No title",
        body: data.repository.issue.body || "",
        html_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
        repository: {
          owner: matchingPR.repository.owner.login,
          name: matchingPR.repository.name
        }
      };
    }

    return undefined;
  } catch (error) {
    console.error("Error in linked issue lookup:", error);
    return undefined;
  }
}

/**
 * Find linked pull requests for a given issue
 */
export async function findLinkedPullRequests(
  owner: string,
  repo: string,
  issueNumber: string,
  token: string
): Promise<LinkedPullRequest[]> {
  console.log(`🔎 Finding linked PRs for issue ${owner}/${repo}#${issueNumber}`);

  try {
    const data = await executeGitHubGraphQL(
      ISSUES_LINKED_PRS_QUERY,
      {
        owner,
        repo,
        issueNumber: parseInt(issueNumber, 10),
      },
      token
    );

    if (!data?.repository?.issue) {
      console.log(`No issue #${issueNumber} found in repository`);
      return [];
    }

    // Extract PRs from cross-reference events
    const timelineNodes = data.repository.issue.timelineItems?.nodes || [];

    // Process timeline nodes to extract PR references
    const linkedPRs = timelineNodes
      .filter((node: any) => node.source && node.source.number)
      .map((node: any) => {
        const pr = node.source;
        return {
          number: pr.number,
          title: pr.title || "No title",
          url: pr.url,
          state: pr.state?.toLowerCase() || "unknown",
          body: pr.body || "",
          author: {
            login: pr.author?.login || "unknown",
            html_url: pr.author?.url || "",
            avatar_url: pr.author?.avatarUrl || ""
          },
          repository: {
            owner: {
              login: pr.repository?.owner?.login || owner
            },
            name: pr.repository?.name || repo
          }
        };
      });

    console.log(`Found ${linkedPRs.length} linked PRs for issue #${issueNumber}`);
    return linkedPRs;
  } catch (error) {
    console.error("Error finding linked PRs:", error);
    return [];
  }
}

/**
 * Execute a GraphQL query against GitHub's API
 */
async function executeGitHubGraphQL(query: string, variables: any, token: string): Promise<any> {
  try {
    console.log(`Executing GraphQL query for: ${variables.owner}/${variables.repo}`);

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      // Return null instead of throwing for repository not found
      if (result.errors.some((e: any) => e.type === "NOT_FOUND" && e.path?.includes("repository"))) {
        console.log(`Repository not found: ${variables.owner}/${variables.repo}`);
        return null;
      }
      return null; // Return null for other GraphQL errors
    }

    return result.data;
  } catch (error) {
    console.error("Error executing GraphQL query:", error);
    return null;
  }
}

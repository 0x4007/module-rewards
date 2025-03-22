import { ISSUES_LINKED_PRS_QUERY, LINKED_PULL_REQUESTS_QUERY } from "./queries";
import { LinkedPRsQueryResponse, LinkedPullRequestsResponse } from "./graphql-types";
import { normalizeGitHubEvent, validateGitHubWebhook } from "./webhook-utils";
import {
  FetchedData,
  GraphQLResponse,
  LinkedIssue,
  LinkedPullRequest,
  UrlParseResult,
} from "./types";
import { CloudEvent } from "../core/cloud-events";

export class GitHubClient {
  private readonly baseUrl = "https://api.github.com";
  private readonly graphqlEndpoint = "https://api.github.com/graphql";
  private readonly token?: string;
  private readonly webhookSecret?: string;

  constructor(token?: string, webhookSecret?: string) {
    this.token = token;
    this.webhookSecret = webhookSecret;
  }

  private get headers(): HeadersInit {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  public validateWebhook(headers: Record<string, string>, payload: any): boolean {
    return validateGitHubWebhook(headers, payload, this.webhookSecret);
  }

  public normalizeEvent(eventType: string, payload: any): CloudEvent<any> {
    return normalizeGitHubEvent(eventType, payload);
  }

  public parseUrl(url: string): UrlParseResult {
    try {
      const cleanUrl = url.trim().replace(/\/$/, "");
      const regex = /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)\/(?:(issues|pulls?))\/(\d+)/i;
      const match = cleanUrl.match(regex);

      if (!match) {
        throw new Error("Invalid GitHub URL format. Must be a PR or Issue URL.");
      }

      const [, owner, repo, type, number] = match;
      return {
        owner,
        repo,
        number,
        type: type.toLowerCase().startsWith("pull") ? "pr" : "issue",
      };
    } catch (error) {
      throw new Error(
        `Could not parse GitHub URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async executeGraphQL<T>(query: string, variables: any): Promise<T | null> {
    try {
      console.log("Executing GraphQL query with variables:", JSON.stringify(variables));

      const response = await fetch(this.graphqlEndpoint, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status}`);
      }

      const result: GraphQLResponse<T> = await response.json();

      if (result.errors) {
        console.error("GraphQL errors:", result.errors);
        if (
          result.errors.some(
            (e) => e.type === "NOT_FOUND" && e.path?.includes("repository")
          )
        ) {
          console.log(
            `Repository not found: ${variables.owner}/${variables.repo}`
          );
          return null;
        }
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error("Error executing GraphQL query:", error);
      return null;
    }
  }

  public async findLinkedIssue(
    owner: string,
    repo: string,
    prNumber: string
  ): Promise<LinkedIssue | undefined> {
    console.log(`🔎 Finding linked issue for PR ${owner}/${repo}#${prNumber}`);

    try {
      const issueNumber = parseInt(prNumber, 10);
      const data = await this.executeGraphQL<LinkedPullRequestsResponse>(LINKED_PULL_REQUESTS_QUERY, {
        owner,
        repo,
        issueNumber,
      });

      if (!data?.repository?.issue) {
        console.log(`No issue #${issueNumber} found in repository`);
        return undefined;
      }

      const linkedPRs = data.repository.issue.closedByPullRequestsReferences?.nodes || [];
      const matchingPR = linkedPRs.find(
        pr => pr.number === parseInt(prNumber, 10)
      );

      if (matchingPR) {
        console.log(`Found issue #${issueNumber} is closed by PR #${prNumber}`);
        return {
          number: issueNumber,
          title: data.repository.issue.title || "No title",
          body: data.repository.issue.body || "",
          html_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
          repository: {
            owner: matchingPR.repository.owner.login,
            name: matchingPR.repository.name,
          },
        };
      }

      return undefined;
    } catch (error) {
      console.error("Error in linked issue lookup:", error);
      return undefined;
    }
  }

  public async findLinkedPullRequests(
    owner: string,
    repo: string,
    issueNumber: string
  ): Promise<LinkedPullRequest[]> {
    console.log(`🔎 Finding linked PRs for issue ${owner}/${repo}#${issueNumber}`);

    try {
      const data = await this.executeGraphQL<LinkedPRsQueryResponse>(ISSUES_LINKED_PRS_QUERY, {
        owner,
        repo,
        issueNumber: parseInt(issueNumber, 10),
      });

      if (!data?.repository?.issue) {
        console.log(`No issue #${issueNumber} found in repository`);
        return [];
      }

      const timelineNodes = data.repository.issue.timelineItems?.nodes || [];
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
              avatar_url: pr.author?.avatarUrl || "",
            },
            repository: {
              owner: {
                login: pr.repository?.owner?.login || owner,
              },
              name: pr.repository?.name || repo,
            },
          };
        });

      console.log(`Found ${linkedPRs.length} linked PRs for issue #${issueNumber}`);
      return linkedPRs;
    } catch (error) {
      console.error("Error finding linked PRs:", error);
      return [];
    }
  }

  public async fetchData(
    owner: string,
    repo: string,
    number: string,
    type: "pr" | "issue"
  ): Promise<FetchedData> {
    try {
      // Fetch details (PR or Issue)
      const detailsResponse = await fetch(
        `${this.baseUrl}/repos/${owner}/${repo}/${
          type === "pr" ? "pulls" : "issues"
        }/${number}`,
        { headers: this.headers }
      );

      if (!detailsResponse.ok) {
        if (detailsResponse.status === 401 || detailsResponse.status === 403) {
          throw new Error("Authentication failed. Please provide a valid GitHub token.");
        } else if (detailsResponse.status === 404) {
          throw new Error(
            `${type.toUpperCase()} not found. Check the URL or your access permissions.`
          );
        } else {
          throw new Error(`GitHub API error: ${detailsResponse.status}`);
        }
      }

      const details = await detailsResponse.json();
      let comments = [];

      // For PRs, fetch review comments and PR reviews
      if (type === "pr") {
        // Review comments (inline comments)
        const reviewCommentsUrl = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${number}/comments`;
        const reviewCommentsResponse = await fetch(reviewCommentsUrl, {
          headers: this.headers,
        });
        if (reviewCommentsResponse.ok) {
          const reviewComments = await reviewCommentsResponse.json();
          comments.push(...reviewComments);
        }

        // PR review comments (top-level review comments)
        const prReviewsUrl = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${number}/reviews`;
        const prReviewsResponse = await fetch(prReviewsUrl, {
          headers: this.headers,
        });
        if (prReviewsResponse.ok) {
          const reviews = await prReviewsResponse.json();
          const reviewComments = reviews
            .filter((review: any) => review.body)
            .map((review: any) => ({
              id: review.id,
              body: review.body,
              user: review.user,
              created_at: review.submitted_at,
              updated_at: review.submitted_at,
              html_url: review.html_url,
            }));
          comments.push(...reviewComments);
        }
      }

      // Issue comments (for both PRs and Issues)
      const issueCommentsUrl = `${this.baseUrl}/repos/${owner}/${repo}/issues/${number}/comments`;
      const issueCommentsResponse = await fetch(issueCommentsUrl, {
        headers: this.headers,
      });
      if (issueCommentsResponse.ok) {
        const issueComments = await issueCommentsResponse.json();
        comments.push(...issueComments);
      }

      // Handle bidirectional linking
      let linkedIssue: LinkedIssue | undefined;
      let linkedPullRequests: LinkedPullRequest[] | undefined;

      if (this.token) {
        if (type === "pr") {
          linkedIssue = await this.findLinkedIssue(owner, repo, number);
          if (linkedIssue) {
            try {
              const issueCommentsUrl = `${this.baseUrl}/repos/${
                linkedIssue.repository?.owner || owner
              }/${linkedIssue.repository?.name || repo}/issues/${
                linkedIssue.number
              }/comments`;
              const issueCommentsResponse = await fetch(issueCommentsUrl, {
                headers: this.headers,
              });
              if (issueCommentsResponse.ok) {
                const issueComments = await issueCommentsResponse.json();
                linkedIssue.comments = issueComments;
              }
            } catch (error) {
              console.error("Error fetching linked issue comments:", error);
            }
          }
        } else if (type === "issue") {
          const foundLinkedPRs = await this.findLinkedPullRequests(
            owner,
            repo,
            number
          );

          if (foundLinkedPRs && foundLinkedPRs.length > 0) {
            linkedPullRequests = foundLinkedPRs;

            if (linkedPullRequests.length > 0) {
              try {
                const mainPR = linkedPullRequests[0];
                const prOwner = mainPR.repository?.owner?.login || owner;
                const prRepo = mainPR.repository?.name || repo;

                const prCommentsUrl = `${this.baseUrl}/repos/${prOwner}/${prRepo}/pulls/${mainPR.number}/comments`;
                const prReviewCommentsResponse = await fetch(prCommentsUrl, {
                  headers: this.headers,
                });

                const prIssueCommentsUrl = `${this.baseUrl}/repos/${prOwner}/${prRepo}/issues/${mainPR.number}/comments`;
                const prIssueCommentsResponse = await fetch(prIssueCommentsUrl, {
                  headers: this.headers,
                });

                const allComments = [];

                if (prReviewCommentsResponse.ok) {
                  const reviewComments = await prReviewCommentsResponse.json();
                  allComments.push(...reviewComments);
                }

                if (prIssueCommentsResponse.ok) {
                  const issueComments = await prIssueCommentsResponse.json();
                  allComments.push(...issueComments);
                }

                mainPR.comments = allComments;
              } catch (error) {
                console.error("Error fetching linked PR comments:", error);
              }
            }
          }
        }
      }

      return {
        details,
        comments,
        type,
        linkedIssue,
        linkedPullRequests,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

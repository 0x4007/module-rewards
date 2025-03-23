import { GitHubClient } from "./github";
import { EventRouter } from "./core/event-router";
import { ModuleChain, ModuleChainRegistry } from "./core/module-chain";
import { CommentProcessorConfig, IssueCommentProcessor, PRCommentProcessor } from "./processors";
import { showError } from "./dom-utils";

export interface GitHubWebhookHeaders {
  "x-github-event"?: string;
  "x-hub-signature"?: string;
  "x-github-delivery"?: string;
}

/**
 * Initialize the module chain registry with available chains
 */
function initializeModuleChains(config: CommentProcessorConfig = {}): ModuleChainRegistry {
  const registry = new ModuleChainRegistry();

  // Create chains for different comment types
  const issueCommentChain = new ModuleChain("github-issue-comment-chain");
  issueCommentChain.addModule(new IssueCommentProcessor(config));
  registry.registerChain(issueCommentChain);

  const prCommentChain = new ModuleChain("github-pr-comment-chain");
  prCommentChain.addModule(new PRCommentProcessor(config));
  registry.registerChain(prCommentChain);

  return registry;
}

/**
 * Process a webhook from a specific platform
 */
export async function processWebhook(
  platform: string,
  eventType: string,
  payload: any,
  headers: Record<string, string> = {}
): Promise<any> {
  try {
    const client = new GitHubClient(process.env.GITHUB_TOKEN);

    // Validate the webhook
    if (!client.validateWebhook(headers, payload)) {
      throw new Error("Invalid webhook signature");
    }

    // Normalize the event
    const cloudEvent = client.normalizeEvent(eventType, payload);

    // Initialize the module chain registry
    const chainRegistry = initializeModuleChains({
      excludeBots: true,
      minLength: 5,
      excludeUsers: ["github-actions[bot]"],
      filterPatterns: [],
    });

    // Create the event router
    const router = new EventRouter(chainRegistry);

    // Route the event to the appropriate chains
    const results = await router.routeEvent(cloudEvent);

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showError(errorMessage);
    throw error;
  }
}

/**
 * Process a GitHub webhook
 */
export async function processGitHubWebhook(
  eventType: string,
  payload: any,
  headers: GitHubWebhookHeaders = {}
): Promise<any> {
  return processWebhook("github", eventType, payload, headers as Record<string, string>);
}

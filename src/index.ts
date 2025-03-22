import { GitHubAdapter } from './adapters/github/github-adapter';
import { EventRouter } from './core/event-router';
import { ModuleChain, ModuleChainRegistry } from './core/module-chain';
import { ContentFilter } from './modules/content-filter';

/**
 * Initialize the module chain registry with our available chains
 */
function initializeModuleChains(): ModuleChainRegistry {
  const registry = new ModuleChainRegistry();

  // Create a simple chain for GitHub issue comments
  const issueCommentChain = new ModuleChain('github-issue-comment-chain');

  // Add modules to the chain
  issueCommentChain.addModule(
    new ContentFilter({
      excludeBots: true,
      minLength: 5,
      excludeUsers: ['github-actions[bot]'],
      filterPatterns: []
    })
  );

  // Register the chain
  registry.registerChain(issueCommentChain);

  return registry;
}

/**
 * Initialize platform adapters
 */
function initializeAdapters() {
  // For now, just create the GitHub adapter
  // Later, we can add Google Docs, Telegram, etc.
  return {
    github: new GitHubAdapter()
  };
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
  // Get the platform adapter
  const adapters = initializeAdapters();
  const adapter = adapters[platform as keyof typeof adapters];

  if (!adapter) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Validate the webhook
  if (!adapter.validateWebhook(headers, payload)) {
    throw new Error('Invalid webhook signature');
  }

  // Normalize the event
  const cloudEvent = adapter.normalizeEvent(eventType, payload);

  // Initialize the module chain registry
  const chainRegistry = initializeModuleChains();

  // Create the event router
  const router = new EventRouter(chainRegistry);

  // Route the event to the appropriate chains
  const results = await router.routeEvent(cloudEvent);

  return results;
}

/**
 * Process a GitHub webhook
 */
export async function processGitHubWebhook(
  eventType: string,
  payload: any,
  headers: Record<string, string> = {}
): Promise<any> {
  return processWebhook('github', eventType, payload, headers);
}

/**
 * Example usage for testing
 */
async function exampleUsage() {
  // Create a sample GitHub issue comment event
  const samplePayload = {
    repository: {
      html_url: 'https://github.com/example/repo'
    },
    issue: {
      number: 123,
      html_url: 'https://github.com/example/repo/issues/123',
      user: {
        login: 'example-user'
      }
    },
    comment: {
      id: 456,
      body: 'This is a sample comment',
      user: {
        login: 'example-user'
      }
    },
    sender: {
      login: 'example-user'
    }
  };

  try {
    // Process the webhook
    const results = await processGitHubWebhook('issue_comment.created', samplePayload);

    console.log('Webhook processing results:', results);
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
}

// This can be uncommented for testing
// if (require.main === module) {
//   exampleUsage();
// }

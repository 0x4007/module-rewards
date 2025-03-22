import crypto from 'crypto';
import { CloudEvent, createCloudEvent } from '../../utils/cloud-events';
import { BasePlatformAdapter } from '../adapter-base';

/**
 * Supported GitHub event types
 */
export const GITHUB_EVENT_TYPES = [
  'issue_comment.created',
  'issue_comment.edited',
  'issues.opened',
  'issues.closed',
  'pull_request.opened',
  'pull_request.closed',
  'pull_request_review.submitted'
];

/**
 * GitHub adapter for normalizing GitHub webhook events
 */
export class GitHubAdapter extends BasePlatformAdapter {
  readonly platformName = 'github';
  readonly supportedEventTypes = GITHUB_EVENT_TYPES;

  constructor(private readonly webhookSecret?: string) {
    super();
  }

  /**
   * Normalize a GitHub webhook event to CloudEvents format
   */
  normalizeEvent(eventType: string, payload: any): CloudEvent {
    // Extract common metadata
    const source = payload.repository?.html_url || 'https://github.com';
    const id = payload.delivery_id || `github-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    // Standardize the event type
    const type = this.standardizeEventType(eventType);

    // Create CloudEvent with standardized data structure
    return createCloudEvent({
      id,
      source,
      type,
      subject: this.extractSubject(eventType, payload),
      data: {
        // Common properties
        sender: payload.sender,
        repository: payload.repository,

        // Event-specific data
        issue: payload.issue,
        comment: payload.comment,
        pull_request: payload.pull_request,
        review: payload.review,

        // Original payload for reference
        original: payload
      }
    });
  }

  /**
   * Validate GitHub webhook signature if secret is provided
   */
  validateWebhook(headers: Record<string, string>, payload: any): boolean {
    // If no webhook secret is configured, skip validation
    if (!this.webhookSecret) {
      return true;
    }

    const signature = headers['x-hub-signature-256'];
    if (!signature) {
      return false;
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const digest = 'sha256=' + hmac.update(payloadString).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  /**
   * Extract a meaningful subject for the CloudEvent
   */
  private extractSubject(eventType: string, payload: any): string {
    if (eventType.startsWith('issue_comment')) {
      return `issue/${payload.issue?.number}/comment/${payload.comment?.id}`;
    } else if (eventType.startsWith('issues')) {
      return `issue/${payload.issue?.number}`;
    } else if (eventType.startsWith('pull_request_review')) {
      return `pull/${payload.pull_request?.number}/review/${payload.review?.id}`;
    } else if (eventType.startsWith('pull_request')) {
      return `pull/${payload.pull_request?.number}`;
    }
    return '';
  }
}

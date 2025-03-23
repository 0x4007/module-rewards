import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreDependencies: [
    // Add dependencies that are actually used but knip might report as unused
  ],
  ignore: [
    // Ignore the entire text-conversation-rewards directory
    'text-conversation-rewards/**/*'
  ],
  ignoreExportsUsedInFile: {
    // Patterns for exports that are used in the same file via side effects
  },
  workspaces: {
    // You can define workspace-specific configurations here if needed
  }
};

export default config;

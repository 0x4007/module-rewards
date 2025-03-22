// Script to fetch PR comments using GitHub API
import fetch from 'node-fetch';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OWNER = 'ubiquity-os-marketplace';
const REPO = 'command-ask';
const PR_NUMBER = '31';

async function ensureDir(dir: string) {
    try {
        await mkdir(dir, { recursive: true });
    } catch (error) {
        // Directory already exists
    }
}

async function writeJSON(path: string, data: unknown) {
    await writeFile(path, JSON.stringify(data, null, 2));
}

async function fetchPRData() {
    const headers = {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const baseUrl = 'https://api.github.com';

    try {
        // Fetch PR details
        const prResponse = await fetch(
            `${baseUrl}/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}`,
            { headers }
        );
        const prDetails = await prResponse.json();

        // Fetch PR comments
        const commentsResponse = await fetch(
            `${baseUrl}/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments`,
            { headers }
        );
        const prComments = await commentsResponse.json();

        // Fetch issue comments
        const issueCommentsResponse = await fetch(
            `${baseUrl}/repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments`,
            { headers }
        );
        const issueComments = await issueCommentsResponse.json();

        // Ensure data directory exists
        await ensureDir('data');

        // Write files
        await writeJSON(join('data', 'pr-details.json'), prDetails);
        await writeJSON(join('data', 'pr-comments.json'), prComments);
        await writeJSON(join('data', 'issue-comments.json'), issueComments);

        console.log('Successfully downloaded PR conversation history');

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error fetching PR data:', message);
        process.exit(1);
    }
}

// Run the script
fetchPRData().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', message);
    process.exit(1);
});

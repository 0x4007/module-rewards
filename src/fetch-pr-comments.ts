import fetch from 'node-fetch';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface PRParams {
    owner: string;
    repo: string;
    number: string;
}

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

function parseArgs(): PRParams {
    const args = process.argv.slice(2);
    const params = {
        owner: '',
        repo: '',
        number: ''
    };

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        if (key in params) {
            params[key as keyof PRParams] = value;
        }
    }

    if (!params.owner || !params.repo || !params.number) {
        console.error('Usage: bun fetch-pr-comments.ts --owner org --repo name --number pr_number');
        process.exit(1);
    }

    return params;
}

async function fetchPRData() {
    const { owner, repo, number } = parseArgs();

    if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const headers = {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    const baseUrl = 'https://api.github.com';

    try {
        // Fetch PR details
        const prResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/pulls/${number}`,
            { headers }
        );
        const prDetails = await prResponse.json();

        // Fetch PR comments
        const commentsResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/pulls/${number}/comments`,
            { headers }
        );
        const prComments = await commentsResponse.json();

        // Fetch issue comments
        const issueCommentsResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/issues/${number}/comments`,
            { headers }
        );
        const issueComments = await issueCommentsResponse.json();

        // Ensure data directory exists
        await ensureDir('./public/data');

        // Write files
        await writeJSON(join('./public/data', 'pr-details.json'), prDetails);
        await writeJSON(join('./public/data', 'pr-comments.json'), prComments);
        await writeJSON(join('./public/data', 'issue-comments.json'), issueComments);

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

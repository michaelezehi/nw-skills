#!/usr/bin/env node
/**
 * Collect automated review bot threads and review passes from a GitHub PR.
 * Usage: node pr-bot-findings.mjs <PR URL or number> [--repo owner/repo] [--json /tmp/pr-N-bot.json]
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = { pr: null, repo: null, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo' && argv[i + 1]) {
      args.repo = argv[++i];
    } else if (a === '--json' && argv[i + 1]) {
      args.json = argv[++i];
    } else if (!a.startsWith('-') && !args.pr) {
      args.pr = a;
    }
  }
  return args;
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function resolvePr(prArg, repoArg) {
  if (!prArg) {
    console.error('Usage: node pr-bot-findings.mjs <PR URL or number> [--repo owner/repo] [--json out.json]');
    process.exit(2);
  }
  const urlMatch = prArg.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], number: Number(urlMatch[3]) };
  }
  const num = Number(prArg.replace(/^#/, ''));
  if (!Number.isInteger(num) || num <= 0) {
    console.error(`Invalid PR identifier: ${prArg}`);
    process.exit(2);
  }
  let repoFull = repoArg;
  if (!repoFull) {
    repoFull = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  }
  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) {
    console.error(`Could not determine owner/repo (got "${repoFull}"). Pass --repo owner/repo.`);
    process.exit(2);
  }
  return { owner, repo, number: num };
}

function isBotAuthor(author) {
  if (!author) return false;
  if (author.__typename === 'Bot') return true;
  const login = (author.login || '').toLowerCase();
  return (
    login.endsWith('[bot]') ||
    login.includes('copilot') ||
    login === 'github-actions' ||
    login.endsWith('-bot')
  );
}

const QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      title
      url
      headRefOid
      baseRefName
      author { login }
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          originalLine
          comments(first: 50) {
            nodes {
              id
              databaseId
              url
              body
              createdAt
              commit { oid }
              author { __typename login }
            }
          }
        }
      }
      reviews(first: 100) {
        nodes {
          id
          state
          body
          submittedAt
          url
          commit { oid }
          author { __typename login }
        }
      }
    }
  }
}
`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { owner, repo, number } = resolvePr(args.pr, args.repo);

  let cursor = null;
  let prMeta = null;
  const allThreads = [];
  let reviews = [];

  while (true) {
    const ghArgs = [
      'api',
      'graphql',
      '-f', `query=${QUERY}`,
      '-f', `owner=${owner}`,
      '-f', `repo=${repo}`,
      '-F', `number=${number}`,
    ];
    if (cursor) ghArgs.push('-f', `cursor=${cursor}`);
    const res = JSON.parse(gh(ghArgs));
    const pr = res?.data?.repository?.pullRequest;
    if (!pr) {
      console.error(`PR #${number} not found in ${owner}/${repo}`);
      process.exit(1);
    }
    if (!prMeta) {
      prMeta = {
        pr: pr.number,
        repo: `${owner}/${repo}`,
        title: pr.title,
        url: pr.url,
        head: pr.headRefOid,
        base: pr.baseRefName,
        author: pr.author?.login || 'unknown',
      };
      reviews = pr.reviews?.nodes || [];
    }
    const threadsPage = pr.reviewThreads;
    allThreads.push(...(threadsPage?.nodes || []));
    if (!threadsPage?.pageInfo?.hasNextPage) break;
    cursor = threadsPage.pageInfo.endCursor;
  }

  const openThreads = allThreads.filter((t) => !t.isResolved && !t.isOutdated);

  const botThreads = [];
  for (const t of allThreads) {
    const comments = t.comments?.nodes || [];
    if (comments.length === 0) continue;
    const first = comments[0];
    if (!isBotAuthor(first.author)) continue;
    const status = t.isResolved ? 'resolved' : t.isOutdated ? 'outdated' : 'open';
    botThreads.push({
      id: first.databaseId || t.id,
      threadId: t.id,
      bot: first.author?.login || 'bot',
      path: t.path,
      line: t.line ?? t.originalLine ?? null,
      startLine: t.startLine ?? null,
      status,
      isResolved: t.isResolved,
      isOutdated: t.isOutdated,
      commit: first.commit?.oid || null,
      url: first.url,
      body: first.body,
      createdAt: first.createdAt,
      replies: comments.slice(1).map((c) => ({
        author: c.author?.login || 'unknown',
        isBot: isBotAuthor(c.author),
        body: c.body,
        createdAt: c.createdAt,
        url: c.url,
      })),
    });
  }

  const botPasses = reviews
    .filter((r) => isBotAuthor(r.author))
    .map((r) => ({
      bot: r.author?.login || 'bot',
      state: r.state,
      commit: r.commit?.oid || null,
      submittedAt: r.submittedAt,
      url: r.url,
      body: r.body,
    }));

  const output = {
    ...prMeta,
    totalThreads: allThreads.length,
    openThreadsCount: openThreads.length,
    canApprove: openThreads.length === 0,
    botThreadsCount: botThreads.length,
    botThreads,
    botPasses,
  };

  const json = JSON.stringify(output, null, 2) + '\n';
  if (args.json) {
    writeFileSync(args.json, json, 'utf8');
    console.log(`Wrote ${botThreads.length} bot threads (${openThreads.length} total open threads) to ${args.json}`);
  } else {
    process.stdout.write(json);
  }
}

main();

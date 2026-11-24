#!/usr/bin/env node
/**
 * Validate diff anchors and post an approved GitHub PR review from /tmp/pr-<n>-review.json.
 * Usage:
 *   node post-review.mjs <PR URL or number> /tmp/pr-N-review.json --only F1,F2 --dry-run
 *   node post-review.mjs <PR URL or number> /tmp/pr-N-review.json --only F1,F2
 *   node post-review.mjs <PR URL or number> /tmp/pr-N-review.json --approve
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = { pr: null, file: null, only: null, dryRun: false, approve: false, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only' && argv[i + 1]) {
      args.only = argv[++i]
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--approve') {
      args.approve = true;
    } else if (a === '--repo' && argv[i + 1]) {
      args.repo = argv[++i];
    } else if (!a.startsWith('-')) {
      if (!args.pr) args.pr = a;
      else if (!args.file) args.file = a;
    }
  }
  return args;
}

function gh(args, input) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function resolvePr(prArg, repoArg) {
  const urlMatch = prArg.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], number: Number(urlMatch[3]) };
  }
  const num = Number(prArg.replace(/^#/, ''));
  let repoFull = repoArg;
  if (!repoFull) {
    repoFull = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  }
  const [owner, repo] = repoFull.split('/');
  return { owner, repo, number: num };
}

function parseChangedRightLines(patch) {
  const lines = new Set();
  if (!patch) return lines;
  let rightLine = 0;
  for (const row of patch.split('\n')) {
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      rightLine = Number(hunk[1]);
      continue;
    }
    if (row.startsWith('+') && !row.startsWith('+++')) {
      lines.add(rightLine);
      rightLine++;
    } else if (row.startsWith(' ')) {
      lines.add(rightLine);
      rightLine++;
    }
  }
  return lines;
}

function getOpenThreadsCount(owner, repo, number) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          headRefOid
          reviewThreads(first: 100) {
            nodes { isResolved isOutdated }
          }
        }
      }
    }
  `;
  const res = JSON.parse(
    gh([
      'api', 'graphql',
      '-f', `query=${query}`,
      '-f', `owner=${owner}`,
      '-f', `repo=${repo}`,
      '-F', `number=${number}`,
    ])
  );
  const pr = res?.data?.repository?.pullRequest;
  const open = (pr?.reviewThreads?.nodes || []).filter((t) => !t.isResolved && !t.isOutdated);
  return { headRefOid: pr?.headRefOid || null, openCount: open.length };
}

function formatBody(comment) {
  let body = (comment.body || '').trim();
  if (typeof comment.suggestion === 'string') {
    body += `\n\n\`\`\`suggestion\n${comment.suggestion}\n\`\`\``;
  }
  return body;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.pr || !args.file) {
    console.error('Usage: node post-review.mjs <PR> <findings.json> [--only F1,F2] [--dry-run] [--approve]');
    process.exit(2);
  }

  const data = JSON.parse(readFileSync(args.file, 'utf8'));
  const { owner, repo, number } = resolvePr(args.pr, args.repo || data.repo);
  const viewer = JSON.parse(gh(['api', 'user'])).login;
  const { headRefOid, openCount } = getOpenThreadsCount(owner, repo, number);

  if (data.head && headRefOid && data.head !== headRefOid) {
    console.warn(`WARNING: PR head moved since review (${data.head.slice(0, 9)} -> ${headRefOid.slice(0, 9)}). Re-verify changed lines before posting.`);
  }

  const allComments = Array.isArray(data.comments) ? data.comments : [];
  let selected = [];
  if (args.only) {
    const wanted = new Set(args.only);
    selected = allComments.filter((c) => wanted.has(c.id));
    const foundIds = new Set(selected.map((c) => c.id));
    const missing = [...wanted].filter((id) => !foundIds.has(id));
    if (missing.length) {
      console.error(`Unknown finding IDs: ${missing.join(', ')}`);
      process.exit(1);
    }
  } else if (!args.approve) {
    selected = allComments.filter((c) => (c.scope || 'in') === 'in');
  }

  const files = JSON.parse(gh(['api', `repos/${owner}/${repo}/pulls/${number}/files`, '--paginate']));
  const diffLinesByPath = new Map();
  for (const f of files) {
    diffLinesByPath.set(f.filename, parseChangedRightLines(f.patch));
  }

  const rejected = [];
  const inlineComments = [];
  for (const c of selected) {
    if (!c.path || !c.line) {
      rejected.push(`${c.id}: missing path or line`);
      continue;
    }
    const validLines = diffLinesByPath.get(c.path);
    if (!validLines) {
      rejected.push(`${c.id}: ${c.path} is not in the PR diff (add to summary instead if out of scope)`);
      continue;
    }
    const line = Number(c.line);
    const startLine = c.startLine ? Number(c.startLine) : null;
    if (!validLines.has(line)) {
      rejected.push(`${c.id}: ${c.path}:${line} is not on a changed diff line`);
      continue;
    }
    if (startLine && !validLines.has(startLine)) {
      rejected.push(`${c.id}: ${c.path}:${startLine} (startLine) is not on a changed diff line`);
      continue;
    }
    const item = {
      path: c.path,
      line,
      side: 'RIGHT',
      body: formatBody(c),
    };
    if (startLine && startLine !== line) {
      item.start_line = startLine;
      item.start_side = 'RIGHT';
    }
    inlineComments.push(item);
  }

  if (rejected.length) {
    console.error('Anchor check failed:');
    for (const r of rejected) console.error(`  - ${r}`);
    process.exit(1);
  }

  let event = 'COMMENT';
  if (args.approve) {
    if (inlineComments.length > 0) {
      console.error('Refusing to APPROVE when inline findings are selected.');
      process.exit(1);
    }
    if (openCount > 0) {
      console.error(`Refusing to APPROVE: ${openCount} review thread(s) are still unresolved and not outdated.`);
      process.exit(1);
    }
    event = 'APPROVE';
  }

  const summary = (data.summary || (inlineComments.length === 0 ? 'LGTM 👍' : 'See inline.')).trim();
  const payload = {
    commit_id: headRefOid || data.head,
    body: summary,
    event,
    comments: inlineComments,
  };

  if (args.dryRun) {
    console.log(`Dry run OK, would post ${event} as @${viewer} on ${owner}/${repo}#${number}`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const posted = JSON.parse(
    gh(
      ['api', `repos/${owner}/${repo}/pulls/${number}/reviews`, '--method', 'POST', '--input', '-'],
      JSON.stringify(payload)
    )
  );
  console.log(`Posted ${event} as @${viewer}: ${posted.html_url}`);

  if (inlineComments.length === 0 && summary.includes('LGTM')) {
    try {
      gh(['api', `repos/${owner}/${repo}/issues/${number}/reactions`, '--method', 'POST', '-f', 'content=+1']);
      console.log('Added 👍 reaction to PR.');
    } catch {
      // Non-fatal if reaction already exists or lacks permission.
    }
  }
}

main();

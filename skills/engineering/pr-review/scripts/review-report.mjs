#!/usr/bin/env node
/**
 * Render /tmp/pr-<n>-review.json into a self-contained HTML report and open it.
 * Usage: node review-report.mjs /tmp/pr-N-review.json [--worktree ../wt-pr-N] [--out /tmp/pr-N-review.html] [--no-open]
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

function parseArgs(argv) {
  const args = { input: null, worktree: null, out: null, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--worktree' && argv[i + 1]) {
      args.worktree = argv[++i];
    } else if (a === '--out' && argv[i + 1]) {
      args.out = argv[++i];
    } else if (a === '--no-open') {
      args.open = false;
    } else if (!a.startsWith('-') && !args.input) {
      args.input = a;
    }
  }
  return args;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readSourceLines(filePath, worktree, headSha) {
  if (!filePath) return null;
  if (worktree) {
    const full = resolve(worktree, filePath);
    if (existsSync(full)) {
      return readFileSync(full, 'utf8').split('\n');
    }
  }
  if (headSha) {
    try {
      const content = execFileSync('git', ['show', `${headSha}:${filePath}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return content.split('\n');
    } catch {
      return null;
    }
  }
  return null;
}

function renderCodeBlock(comment, worktree, headSha) {
  if (!comment.path || !comment.line) return '';
  const lines = readSourceLines(comment.path, worktree, headSha);
  if (!lines) {
    return `<div class="code-missing">Source unavailable for <code>${esc(comment.path)}:${esc(comment.line)}</code></div>`;
  }
  const end = Number(comment.line);
  const start = Number(comment.startLine || end);
  const from = Math.max(1, start - 4);
  const to = Math.min(lines.length, end + 4);

  const rows = [];
  for (let ln = from; ln <= to; ln++) {
    const hl = ln >= start && ln <= end ? ' hl' : '';
    rows.push(
      `<tr class="${hl}"><td class="ln">${ln}</td><td class="src"><code>${esc(lines[ln - 1] ?? '')}</code></td></tr>`
    );
  }

  let diffHtml = '';
  if (typeof comment.suggestion === 'string') {
    const oldLines = lines.slice(start - 1, end);
    const newLines = comment.suggestion.split('\n');
    const diffRows = [
      ...oldLines.map((l) => `<div class="diff-del">- ${esc(l)}</div>`),
      ...newLines.map((l) => `<div class="diff-add">+ ${esc(l)}</div>`),
    ];
    diffHtml = `<div class="diff"><div class="diff-label">Suggested change (lines ${start}-${end})</div>${diffRows.join('')}</div>`;
  }

  return `<div class="code-wrap"><div class="code-path">${esc(comment.path)}:${start === end ? end : `${start}-${end}`}</div><table class="code"><tbody>${rows.join('')}</tbody></table>${diffHtml}</div>`;
}

function renderScreenshot(shot) {
  let imgHtml = `<div class="shot-missing">File not found: <code>${esc(shot.path)}</code></div>`;
  if (shot.path && existsSync(shot.path)) {
    const ext = extname(shot.path).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    const b64 = readFileSync(shot.path).toString('base64');
    imgHtml = `<img src="data:${mime};base64,${b64}" alt="${esc(shot.label)}" />`;
  }
  return `<figure class="shot">
    <figcaption><strong>${esc(shot.label)}</strong> · ${esc(shot.width || '')}px · <code>${esc(shot.url || '')}</code><div class="shot-note">${esc(shot.note || '')}</div></figcaption>
    ${imgHtml}
  </figure>`;
}

function renderCommentCard(c, worktree, headSha) {
  const sev = (c.severity || 'Gap').toLowerCase();
  const reason = c.reason ? `<div class="meta-row"><strong>Reason:</strong> ${esc(c.reason)}</div>` : '';
  const proof = c.proof ? `<div class="meta-row"><strong>Proof:</strong> <code>${esc(c.proof)}</code></div>` : '';
  return `<article class="card">
    <header class="card-head">
      <span class="id">${esc(c.id)}</span>
      <span class="badge sev-${esc(sev)}">${esc(c.severity || 'Gap')}</span>
      <span class="title">${esc(c.title || '')}</span>
    </header>
    ${renderCodeBlock(c, worktree, headSha)}
    <div class="comment-body">${esc(c.body || '')}</div>
    ${proof}
    ${reason}
  </article>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: node review-report.mjs /tmp/pr-N-review.json [--worktree dir] [--out file.html] [--no-open]');
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(args.input, 'utf8'));
  const outPath = args.out || args.input.replace(/\.json$/i, '.html');

  const comments = Array.isArray(data.comments) ? data.comments : [];
  const inScope = comments.filter((c) => (c.scope || 'in') === 'in');
  const outScope = comments.filter((c) => c.scope === 'out');
  const dismissed = Array.isArray(data.dismissed) ? data.dismissed : [];
  const botRows = Array.isArray(data.bot) ? data.bot : Array.isArray(data.copilot) ? data.copilot : [];
  const disagreements = Array.isArray(data.disagreements) ? data.disagreements : [];
  const tested = Array.isArray(data.tested) ? data.tested : [];
  const screenshots = Array.isArray(data.screenshots) ? data.screenshots : [];

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>PR #${esc(data.pr)} · ${esc(data.title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #0f1115; --card: #161922; --border: #262b38; --text: #e6e9ef; --muted: #9aa3b2; --hl: rgba(245, 194, 17, 0.16); --red: #ef4444; --amber: #f59e0b; --green: #22c55e; --blue: #60a5fa; }
  @media (prefers-color-scheme: light) {
    :root { --bg: #f7f8fa; --card: #ffffff; --border: #e2e6ee; --text: #111827; --muted: #525d70; --hl: #fef3c7; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 24px 80px; background: var(--bg); color: var(--text); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { max-width: 1040px; margin: 0 auto; }
  h1 { margin: 0 0 6px; font-size: 22px; }
  h2 { margin: 32px 0 12px; font-size: 16px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  .sub { color: var(--muted); margin-bottom: 24px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  table.grid { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  table.grid th, table.grid td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
  table.grid tr:last-child td { border-bottom: none; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
  .card-head { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
  .id { font-weight: 700; font-family: ui-monospace, monospace; }
  .badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; }
  .sev-blocker { background: rgba(239,68,68,.18); color: var(--red); }
  .sev-gap { background: rgba(245,158,11,.18); color: var(--amber); }
  .sev-nit { background: rgba(96,165,250,.18); color: var(--blue); }
  .title { font-weight: 600; }
  .code-wrap { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin: 10px 0; }
  .code-path { background: rgba(127,127,127,.08); padding: 6px 10px; font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--border); }
  table.code { width: 100%; border-collapse: collapse; font-family: ui-monospace, monospace; font-size: 12px; }
  table.code td { padding: 1px 10px; white-space: pre-wrap; word-break: break-word; }
  table.code td.ln { width: 48px; text-align: right; color: var(--muted); user-select: none; border-right: 1px solid var(--border); }
  table.code tr.hl { background: var(--hl); }
  .diff { border-top: 1px solid var(--border); padding: 8px 10px; font-family: ui-monospace, monospace; font-size: 12px; }
  .diff-label { color: var(--muted); margin-bottom: 4px; font-size: 11px; }
  .diff-del { background: rgba(239,68,68,.14); color: var(--red); padding: 1px 6px; white-space: pre-wrap; }
  .diff-add { background: rgba(34,197,94,.14); color: var(--green); padding: 1px 6px; white-space: pre-wrap; }
  .comment-body { margin: 10px 0 6px; white-space: pre-wrap; }
  .meta-row { font-size: 12.5px; color: var(--muted); margin-top: 4px; }
  .shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; margin-top: 12px; }
  .shot { margin: 0; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
  .shot img { width: 100%; height: auto; border-radius: 4px; margin-top: 8px; border: 1px solid var(--border); }
  .shot-note { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .empty { color: var(--muted); font-style: italic; }
  a { color: var(--blue); }
</style>
</head>
<body>
<main>
  <h1>PR #${esc(data.pr)} · ${esc(data.title)}</h1>
  <div class="sub">${esc(data.repo || '')} · ${esc(data.author || '')} · head <code>${esc((data.head || '').slice(0, 9))}</code> · ${inScope.length} to comment on · ${outScope.length} out of scope · ${dismissed.length} dismissed</div>

  <h2>Tested</h2>
  ${tested.length ? `<table class="grid"><thead><tr><th>Check</th><th>Result</th><th>Proof</th></tr></thead><tbody>${tested.map((t) => `<tr><td>${esc(t.check)}</td><td>${esc(t.result)}</td><td><code>${esc(t.proof)}</code></td></tr>`).join('')}</tbody></table>` : '<p class="empty">No tested items recorded.</p>'}
  ${screenshots.length ? `<div class="shots">${screenshots.map(renderScreenshot).join('')}</div>` : ''}

  <h2>To comment on (${inScope.length})</h2>
  ${inScope.length ? inScope.map((c) => renderCommentCard(c, args.worktree, data.head)).join('') : '<p class="empty">None.</p>'}

  <h2>Out of scope (${outScope.length})</h2>
  ${outScope.length ? outScope.map((c) => renderCommentCard(c, args.worktree, data.head)).join('') : '<p class="empty">None.</p>'}

  <h2>Dismissed (${dismissed.length})</h2>
  ${dismissed.length ? `<table class="grid"><thead><tr><th>ID</th><th>Title</th><th>Reason</th></tr></thead><tbody>${dismissed.map((d) => `<tr><td><code>${esc(d.id)}</code></td><td>${esc(d.title)}</td><td>${esc(d.reason)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">None.</p>'}

  <h2>Bot already covered (${botRows.length})</h2>
  ${botRows.length ? `<table class="grid"><thead><tr><th></th><th>Threads</th><th>Point</th><th>Status</th><th>Note</th></tr></thead><tbody>${botRows.map((b) => `<tr><td>${esc(b.mark || '·')}</td><td>${b.url ? `<a href="${esc(b.url)}">${esc(b.threads)}</a>` : esc(b.threads)}</td><td>${esc(b.point)}</td><td>${esc(b.status || '')}</td><td>${esc(b.note || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">None.</p>'}

  <h2>Disagreements with bot (${disagreements.length})</h2>
  ${disagreements.length ? `<table class="grid"><thead><tr><th>Threads</th><th>Path</th><th>Point</th><th>Note</th></tr></thead><tbody>${disagreements.map((d) => `<tr><td>${d.url ? `<a href="${esc(d.url)}">${esc(d.threads)}</a>` : esc(d.threads)}</td><td><code>${esc(d.path || '')}</code></td><td>${esc(d.point)}</td><td>${esc(d.note || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">None.</p>'}
</main>
</body>
</html>
`;

  writeFileSync(outPath, html, 'utf8');
  console.log(`Wrote ${outPath}`);

  if (args.open) {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawnSync(opener, [outPath], { stdio: 'ignore' });
  }
}

main();

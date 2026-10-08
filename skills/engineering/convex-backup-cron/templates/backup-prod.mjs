#!/usr/bin/env node
/**
 * <project> — Production Backup
 * Snapshots Convex prod data + critical droplet state to DO Spaces every cron tick.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const ts = () => new Date().toISOString();
const log = (msg) => console.log(`[${ts()}] ${msg}`);
const die = (msg) => { log(`ERROR: ${msg}`); process.exit(1); };

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return 0;
  let count = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) { process.env[k] = v; count += 1; }
  }
  return count;
}
function loadEnv() {
  const deployDir = process.env.BACKUP_DEPLOY_DIR ?? '/opt/<APP>';
  // ADJUST: match the project's env-file convention. First match wins.
  for (const f of [`${deployDir}/.env.do`, `${deployDir}/.env.production`, `${rootDir}/.env.do`, `${rootDir}/.env.production`]) {
    const n = loadEnvFile(f);
    if (n > 0) log(`loaded ${n} vars from ${f}`);
  }
}
function parseEndpoint(raw) {
  const c = raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const p = c.split('.');
  if (p.length === 4 && p[2] === 'digitaloceanspaces') return { endpoint: `${p[1]}.digitaloceanspaces.com`, region: p[1], bucket: p[0] };
  if (p.length === 3 && p[1] === 'digitaloceanspaces') return { endpoint: c, region: p[0], bucket: null };
  return { endpoint: c, region: 'lon1', bucket: null };
}
async function runStep(label, fn) {
  const start = Date.now();
  log(`▶ ${label}`);
  try { const out = await fn(); log(`✓ ${label} (${Date.now() - start}ms)`); return out; }
  catch (e) { log(`✗ ${label} failed: ${e.message}`); throw e; }
}

async function main() {
  loadEnv();
  for (const k of ['DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_ENDPOINT', 'CONVEX_DEPLOY_KEY']) {
    if (!process.env[k]) die(`missing env: ${k}`);
  }
  const deployDir = process.env.BACKUP_DEPLOY_DIR ?? '/opt/<APP>';
  const retention = Math.max(1, parseInt(process.env.BACKUP_RETENTION ?? '3', 10));
  const parsed = parseEndpoint(process.env.DO_SPACES_ENDPOINT);
  const bucket = process.env.BACKUP_BUCKET ?? parsed.bucket;
  if (!bucket) die('no bucket — set BACKUP_BUCKET or use bucket-scoped DO_SPACES_ENDPOINT');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = `backups/${stamp}/`;
  log(`bucket=${bucket} region=${parsed.region} retention=${retention}`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-'));
  const s3 = new S3Client({
    endpoint: `https://${parsed.endpoint}`,
    region: 'us-east-1',
    credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET },
  });

  // 1. Convex export (file storage included unless BACKUP_INCLUDE_FILES=false)
  const convexPath = path.join(work, 'convex.zip');
  const exportArgs = ['--yes', 'convex', 'export', '--path', convexPath];
  if (process.env.BACKUP_INCLUDE_FILES !== 'false') exportArgs.push('--include-file-storage');
  await runStep('convex export', () => {
    const r = spawnSync('npx', exportArgs,
      { cwd: path.join(deployDir, 'packages/convex'), env: process.env, stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) throw new Error(`convex export exited ${r.status}`);
  });

  // 2. Droplet tarball — paths stored relative to /
  const tarPath = path.join(work, 'droplet.tar.gz');
  await runStep('tar droplet state', () => {
    const candidates = [
      `${deployDir.replace(/^\//, '')}/.env.do`,
      `${deployDir.replace(/^\//, '')}/.env.production`,
      `${deployDir.replace(/^\//, '')}/docker/certbot`,
      'etc/letsencrypt',
    ];
    const includes = candidates.filter((rel) => {
      const full = `/${rel}`;
      if (!fs.existsSync(full)) return false;
      const st = fs.statSync(full);
      if (st.isDirectory()) { try { return fs.readdirSync(full).length > 0; } catch { return false; } }
      return st.size > 0;
    });
    if (!includes.length) throw new Error('no droplet paths to back up');
    const r = spawnSync('tar', ['-czf', tarPath, '-C', '/', ...includes], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) throw new Error(`tar exited ${r.status}`);
  });

  // 3. Upload (Buffers, never streams — DO Spaces rejects chunked transfer)
  const upload = (key, body, ct) => s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: body, ContentLength: body.length, ContentType: ct, ACL: 'private',
  }));
  await runStep('upload convex.zip', () => upload(`${prefix}convex.zip`, fs.readFileSync(convexPath), 'application/zip'));
  await runStep('upload droplet.tar.gz', () => upload(`${prefix}droplet.tar.gz`, fs.readFileSync(tarPath), 'application/gzip'));
  const manifest = Buffer.from(JSON.stringify({ timestamp: new Date().toISOString(), bucket, retention }, null, 2), 'utf8');
  await runStep('upload manifest.json', () => upload(`${prefix}manifest.json`, manifest, 'application/json'));

  // 4. Prune
  await runStep(`prune (keep ${retention})`, async () => {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'backups/', Delimiter: '/' }));
    const folders = (list.CommonPrefixes ?? []).map((p) => p.Prefix).filter(Boolean).sort().reverse();
    const stale = folders.slice(retention);
    for (const folder of stale) {
      const objs = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: folder }));
      const keys = (objs.Contents ?? []).map((o) => ({ Key: o.Key }));
      if (keys.length) await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
      log(`pruned ${folder}`);
    }
  });

  fs.rmSync(work, { recursive: true, force: true });
  log(`backup complete: s3://${bucket}/${prefix}`);
}
main().catch((e) => { log(`FATAL: ${e.stack ?? e.message}`); process.exit(1); });

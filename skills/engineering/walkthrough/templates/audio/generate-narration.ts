#!/usr/bin/env tsx
/**
 * Walkthrough narration audio. Generates one `lead.mp3` and one `detail.mp3`
 * per narrated step from `step.narration`, through ElevenLabs, and keeps
 * `<out>/manifest.json` so an unchanged clip is never paid for twice.
 *
 * Usage (from the app's root, so `.env.local` is found):
 *   npx tsx scripts/audio/generate-narration.ts \
 *     --stories src/components/walkthrough/stories.ts \
 *     --out public/audio/walkthrough [--dry-run] [--full] [--story founder]
 *
 * `--stories` is a module whose default export, or a named `STORIES` or
 * `stories` export, is the stories: a record keyed by story key, an array,
 * or a function with no arguments that returns either. tsx follows the
 * tsconfig `paths`, so the module may use the app's import aliases.
 * `--out` must be the public folder the player reads (`NARRATION_BASE`).
 *
 * A clip is skipped when the manifest hash matches its text and the file
 * exists. `--full` regenerates every clip in scope. Exits 1 on any failure.
 *
 * Environment: ELEVENLABS_API_KEY (not needed for a dry run),
 * ELEVENLABS_VOICE_ID, ELEVENLABS_TTS_MODEL (default eleven_turbo_v2_5).
 */

import { existsSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { clipKey, clipRelPath, narrationClips, resolveStories, type NarrationClip } from './narration-clips';

/** `mp3_44100_128` is constant bitrate, so size gives the real duration. */
const MP3_BITS_PER_SECOND = 128_000;
const OUTPUT_FORMAT = 'mp3_44100_128';
const DEFAULT_MODEL = 'eleven_turbo_v2_5';
const VOICE_SETTINGS = {
  stability: 0.55,
  similarity_boost: 0.78,
  style: 0.18,
  speed: 1.0,
  use_speaker_boost: true,
};

interface ManifestClip {
  textHash: string;
  durationMs: number;
  sizeBytes: number;
}

interface Manifest {
  schemaVersion: 1;
  generatedAt: string;
  clips: Record<string, ManifestClip>;
}

interface Args {
  stories: string;
  out: string;
  dryRun: boolean;
  full: boolean;
  story: string | null;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let stories: string | null = null;
  let out: string | null = null;
  const args = { dryRun: false, full: false, story: null as string | null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--full') args.full = true;
    else if (arg === '--stories') stories = argv[++i] ?? null;
    else if (arg === '--out') out = argv[++i] ?? null;
    else if (arg === '--story') args.story = argv[++i] ?? null;
    else fail(`Unknown argument "${arg}"`);
  }
  if (!stories) fail('Missing --stories <module path exporting the stories>');
  if (!out) fail('Missing --out <public dir>/audio/walkthrough');
  return { ...args, stories: path.resolve(stories), out: path.resolve(out) };
}

/** Reads `.env.local` from the working folder, without a dependency. Never overrides a set value. */
function loadEnvLocal(): void {
  const file = path.resolve('.env.local');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, name, rest] = match as unknown as [string, string, string];
    let value = rest.trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

async function readManifest(file: string): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as Partial<Manifest>;
    return {
      schemaVersion: 1,
      generatedAt: parsed.generatedAt ?? new Date(0).toISOString(),
      clips: parsed.clips ?? {},
    };
  } catch {
    return { schemaVersion: 1, generatedAt: new Date(0).toISOString(), clips: {} };
  }
}

async function writeManifest(file: string, manifest: Manifest): Promise<void> {
  const clips = Object.fromEntries(Object.entries(manifest.clips).sort(([a], [b]) => a.localeCompare(b)));
  const body: Manifest = { ...manifest, generatedAt: new Date().toISOString(), clips };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(body, null, 2)}\n`);
}

const keyOf = (clip: NarrationClip) => clipKey(clip.story, clip.stepId, clip.part);

async function textToSpeech(text: string, apiKey: string, voiceId: string, model: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: model, voice_settings: VOICE_SETTINGS }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`ElevenLabs returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const args = parseArgs();
  loadEnvLocal();

  const mod = (await import(pathToFileURL(args.stories).href)) as Record<string, unknown>;
  const stories = resolveStories(mod);
  if (!stories) fail(`${args.stories} exports no stories (default, STORIES or stories)`);
  if (args.story && !stories.some((s) => s.key === args.story)) {
    fail(`Unknown story "${args.story}". Use one of: ${stories.map((s) => s.key).join(', ')}`);
  }

  const all = narrationClips(stories);
  const inScope = all.filter((c) => !args.story || c.story === args.story);
  const manifestPath = path.join(args.out, 'manifest.json');
  const manifest = await readManifest(manifestPath);
  const fileOf = (clip: NarrationClip) => path.join(args.out, clipRelPath(clip.story, clip.stepId, clip.part));

  const todo = inScope.filter((clip) => {
    if (args.full) return true;
    const entry = manifest.clips[keyOf(clip)];
    return !entry || entry.textHash !== clip.textHash || !existsSync(fileOf(clip));
  });

  console.log(`Walkthrough narration: ${inScope.length} clips in scope${args.story ? ` (${args.story})` : ''}`);
  for (const clip of todo) console.log(`  ${keyOf(clip)}  "${clip.text.replace(/\s+/g, ' ').slice(0, 70)}"`);

  if (args.dryRun) {
    console.log(`DRY RUN: ${todo.length} to generate, ${inScope.length - todo.length} up to date`);
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const model = process.env.ELEVENLABS_TTS_MODEL || DEFAULT_MODEL;
  if (todo.length > 0) {
    if (!apiKey) fail('Missing ELEVENLABS_API_KEY (set it in .env.local)');
    if (!voiceId) fail('Missing ELEVENLABS_VOICE_ID (set it in .env.local)');
  }

  let failed = 0;
  for (const clip of todo) {
    const key = keyOf(clip);
    process.stdout.write(`Generating ${key}...`);
    try {
      const buffer = await textToSpeech(clip.text, apiKey!, voiceId!, model);
      const file = fileOf(clip);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, buffer);
      manifest.clips[key] = {
        textHash: clip.textHash,
        durationMs: Math.round((buffer.length * 8 * 1000) / MP3_BITS_PER_SECOND),
        sizeBytes: buffer.length,
      };
      // Saved after every clip, so an interrupted run keeps what it made.
      await writeManifest(manifestPath, manifest);
      console.log(` ok (${(buffer.length / 1024).toFixed(1)} KB)`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      failed++;
      console.log(` failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Drop entries for steps that no longer exist or lost their narration.
  const live = new Set(all.map(keyOf));
  for (const key of Object.keys(manifest.clips)) {
    if (!live.has(key)) delete manifest.clips[key];
  }
  await writeManifest(manifestPath, manifest);

  console.log(`Done: ${todo.length - failed} generated, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error('Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});

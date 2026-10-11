/**
 * Put text on the clipboard without a shell. macOS: pbcopy. Linux: wl-copy, then xclip.
 * When no tool works, OSC 52 goes to the terminal itself, which most modern terminals
 * honour (capped at 100KB). Never throws; the result says which route took the text.
 */
import { spawn as nodeSpawn } from 'node:child_process';

export type CopyResult = 'pbcopy' | 'wl-copy' | 'xclip' | 'osc52' | 'failed';

/** The slice of a child process the copier needs; tests inject a fake. */
export interface SpawnedLike {
  stdin: { write(chunk: string): unknown; end(): unknown; on?(event: 'error', cb: (err: Error) => void): unknown };
  on(event: 'error', cb: (err: Error) => void): unknown;
  on(event: 'close', cb: (code: number | null) => void): unknown;
}

export type Spawner = (command: string, args: string[]) => SpawnedLike;

export interface CopyDeps {
  platform?: NodeJS.Platform;
  spawn?: Spawner;
  /** Where the OSC 52 sequence goes; the real terminal by default. */
  write?: (data: string) => unknown;
}

/** OSC 52 payloads beyond this are cut; terminals cap the sequence anyway. */
export const OSC52_MAX_BYTES = 100 * 1024;

const defaultSpawn: Spawner = (command, args) => nodeSpawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });

const TOOLS: Record<string, Array<{ name: CopyResult; command: string; args: string[] }>> = {
  darwin: [{ name: 'pbcopy', command: 'pbcopy', args: [] }],
  linux: [
    { name: 'wl-copy', command: 'wl-copy', args: [] },
    { name: 'xclip', command: 'xclip', args: ['-selection', 'clipboard'] },
  ],
};

/** Run one clipboard tool with `text` on its stdin; true when it exited 0. */
function runTool(spawn: Spawner, command: string, args: string[], text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const child = spawn(command, args);
      child.on('error', () => done(false));
      child.on('close', (code) => done(code === 0));
      child.stdin.on?.('error', () => done(false));
      child.stdin.write(text);
      child.stdin.end();
    } catch {
      done(false);
    }
  });
}

/** The OSC 52 sequence that asks the terminal to set its clipboard to `text`. */
export function osc52(text: string): string {
  const bytes = Buffer.from(text, 'utf8').subarray(0, OSC52_MAX_BYTES);
  return `\u001b]52;c;${bytes.toString('base64')}\u0007`;
}

export async function copyText(text: string, deps: CopyDeps = {}): Promise<CopyResult> {
  if (text.length === 0) return 'failed';
  const platform = deps.platform ?? process.platform;
  const spawn = deps.spawn ?? defaultSpawn;
  for (const tool of TOOLS[platform] ?? []) {
    if (await runTool(spawn, tool.command, tool.args, text)) return tool.name;
  }
  const write = deps.write ?? ((data: string) => process.stdout.write(data));
  try {
    write(osc52(text));
    return 'osc52';
  } catch {
    return 'failed';
  }
}

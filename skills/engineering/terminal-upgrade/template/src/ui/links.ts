/**
 * Terminal hyperlinks for `file:line:col` references. An OSC 8 sequence wraps the text, so
 * iTerm2, Ghostty, WezTerm, kitty and the VS Code terminal open the file on Cmd-click with
 * no mouse tracking, which would break native text selection. The escapes are zero width
 * to Ink, so callers truncate the plain text first and link it after.
 */
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export const FILE_REF = /((?:[\w@.-]+\/)*[\w.-]+\.(?:tsx?|jsx?|mjs|cjs|mts|cts|css|scss|json|md|html)(?::\d+(?::\d+)?)?)/g;

const OSC = '\u001b]8;;';
const ST = '\u001b\\';

/** `text` as an OSC 8 hyperlink to `url`. */
export function osc8(url: string, text: string): string {
  return `${OSC}${url}${ST}${text}${OSC}${ST}`;
}

/** `file://` URL for an absolute path, with the few characters terminals trip on escaped. */
export function fileUrl(absolutePath: string): string {
  return `file://${encodeURI(absolutePath).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

const exists = new Map<string, boolean>();

function fileExists(path: string): boolean {
  let known = exists.get(path);
  if (known === undefined) {
    known = existsSync(path);
    exists.set(path, known);
  }
  return known;
}

/**
 * Absolute path for a reference printed by a service. Relative paths resolve against the
 * service directory first (that is where Next and tsc run), then the repo root; when
 * neither exists on disk, the service directory wins.
 */
export function resolveRef(ref: string, root: string, dir: string | undefined): string {
  const path = ref.replace(/(?::\d+)+$/, '').replace(/^\.\//, '');
  if (isAbsolute(path)) return path;
  const fromRoot = join(root, path);
  if (!dir) return fromRoot;
  // A path that already starts with the service directory was printed repo-relative.
  const candidates = path.startsWith(`${dir}/`) ? [fromRoot, join(root, dir, path)] : [join(root, dir, path), fromRoot];
  return candidates.find(fileExists) ?? candidates[0]!;
}

/** Every file reference in `text` wrapped in a hyperlink. The visible text is unchanged. */
export function linkRefs(text: string, root: string, dir: string | undefined): string {
  return text.replace(FILE_REF, (ref) => osc8(fileUrl(resolveRef(ref, root, dir)), ref));
}

/** Forget what was looked up on disk; tests use it. */
export function resetLinkCache(): void {
  exists.clear();
}

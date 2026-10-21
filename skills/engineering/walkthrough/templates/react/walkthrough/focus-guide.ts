import { WALKTHROUGH_UI_ATTR } from './nav-guide';
import type { FocusSpec } from './story-types';

/**
 * Finding the controls a step talks about, so the focus pass can light them
 * up. A target is named by its label and matched against each control's
 * accessible name (its `aria-label`, an input's placeholder, else its text),
 * so host components need no markup for it. A host with a translation
 * catalog names targets by catalog key and passes a `resolveName` that turns
 * the key into the viewer's words. A control with no stable label is named
 * by a selector instead.
 */

/** How long the pass waits for a step's controls to render before giving up on them. */
export const FOCUS_FIND_MS = 2500;
const POLL_MS = 100;
/** How far up from a label `area` looks for the card or stat round it. */
const AREA_DEPTH = 5;
/** Under this height a rounded box is the pill round the text, not the section it sits in. */
const AREA_MIN_HEIGHT = 48;

const CONTROLS = 'button, a[href], [role="tab"], [role="button"], [role="link"], input[placeholder], [aria-label]';
const LABELS = 'h1, h2, h3, p';

export interface FocusTarget {
  element: HTMLElement;
  /** Click it once the highlight has shown (a tab the step is about). */
  click: boolean;
}

/** The default resolver: a spec's name is already the label the viewer reads. */
export const asShown = (name: string): string => name;

/** Lower case and single spaces. */
export function normalizeName(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function accessibleName(el: HTMLElement): string {
  const placeholder = el instanceof HTMLInputElement ? el.placeholder : '';
  return normalizeName(el.getAttribute('aria-label') || placeholder || el.textContent || '');
}

/**
 * The label, or the label followed by a count or a full stop: tabs carry
 * their count ("Not checked in 49", "Time off (4)") and some titles end on an
 * accent dot.
 */
export function nameMatches(name: string, wanted: string): boolean {
  if (!wanted || !name.startsWith(wanted)) return false;
  const rest = name.slice(wanted.length);
  // A count or a dot only: "Upcoming" must not light "Upcoming holidays".
  return rest === '' || /^\s*[(\d.·]/.test(rest);
}

/** A control still fading in (opacity 0 on it or a parent): ringing it would light an empty hole. */
function isFadedOut(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (Number.parseFloat(getComputedStyle(node).opacity) < 0.01) return true;
  }
  return false;
}

function isShown(el: HTMLElement): boolean {
  if (el.closest(`[${WALKTHROUGH_UI_ATTR}]`) || el.closest('[aria-hidden="true"]')) return false;
  if (isFadedOut(el)) return false;
  // Below the fold still counts: the focus pass scrolls the first control into view.
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * The card or stat cell round a label: the nearest rounded box that is more
 * than a pill, else the widest box below the screen-wide row. Never one most
 * of the screen wide.
 */
function areaOf(label: HTMLElement): HTMLElement {
  let widest: HTMLElement = label;
  let node = label.parentElement;
  for (let depth = 0; node && depth < AREA_DEPTH; depth++, node = node.parentElement) {
    const rect = node.getBoundingClientRect();
    if (rect.width > window.innerWidth * 0.7) break;
    // A zero height is an unmeasured box (no layout yet), not a small one.
    const pill = rect.height > 0 && rect.height < AREA_MIN_HEIGHT;
    if (pill) continue;
    if (Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) >= 8) return node;
    widest = node;
  }
  return widest;
}

function matchesFor(spec: FocusSpec, resolveName: (name: string) => string, root: ParentNode): HTMLElement[] {
  if ('selector' in spec) return Array.from(root.querySelectorAll<HTMLElement>(spec.selector));
  const wanted = normalizeName(resolveName(spec.name));
  const pool = spec.role ? `[role="${spec.role}"]` : spec.area ? `${CONTROLS}, ${LABELS}` : CONTROLS;
  const named = Array.from(root.querySelectorAll<HTMLElement>(pool)).filter(
    (el) => isShown(el) && nameMatches(accessibleName(el), wanted),
  );
  // The innermost match wins, so a card round a button is not ringed as well.
  const innermost = named.filter((el) => !named.some((other) => other !== el && el.contains(other)));
  return spec.area ? innermost.map(areaOf) : innermost;
}

/**
 * Every shown control each spec names, in spec order. A name can match more
 * than one control (a button in the top bar and a round one in the corner);
 * all of them light up.
 */
export function findFocusTargets(
  specs: readonly FocusSpec[],
  resolveName: (name: string) => string = asShown,
  root: ParentNode = document,
): FocusTarget[][] {
  const seen = new Set<HTMLElement>();
  return specs.map((spec) =>
    matchesFor(spec, resolveName, root)
      .filter((element) => isShown(element) && !seen.has(element) && seen.add(element))
      .map((element) => ({ element, click: spec.click === true })),
  );
}

/**
 * Waits for the step's controls to render: resolves with every target once
 * each spec has a match, or with whatever was found after `FOCUS_FIND_MS`.
 * `cancelled` stops the wait early with nothing.
 */
export function waitForFocusTargets(
  specs: readonly FocusSpec[],
  resolveName: (name: string) => string,
  cancelled: () => boolean,
): Promise<FocusTarget[]> {
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (cancelled()) {
        resolve([]);
        return;
      }
      const found = findFocusTargets(specs, resolveName);
      if (found.every((list) => list.length > 0) || Date.now() - started >= FOCUS_FIND_MS) resolve(found.flat());
      else setTimeout(check, POLL_MS);
    };
    check();
  });
}

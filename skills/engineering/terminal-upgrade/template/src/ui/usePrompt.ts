/**
 * Answering a command from the deck. While a service waits on a prompt the card's keys
 * come first: y and n, the arrows, typing into a field, Enter to send, Esc to hide the card.
 * `i` attaches the keyboard to the selected command for anything the card does not
 * recognise: every key goes to it as terminal bytes until Ctrl+] lets go.
 */
import { useState } from 'react';
import type { Key } from 'ink';
import type { DeckControls, Prompt, ServiceState } from '../types.ts';
import { choiceKeys } from '../prompt.ts';
import { initialSelection, type PromptInput } from './promptCard.ts';

export interface InputHint {
  key: string;
  word: string;
  active?: boolean;
}

export interface PromptControl {
  /** The service whose prompt the card shows, while it is not hidden. */
  service?: ServiceState;
  prompt?: Prompt;
  input: PromptInput;
  /** The label of the command the keyboard is attached to. */
  attached?: string;
  /** Runs the key; true when it was taken. */
  handleKey(input: string, key: Key): boolean;
  /** A click on a button or option of the card. */
  click(index: number): void;
  /** Footer hints while the card or the attachment has the keys. */
  hints?: InputHint[];
}

/** The bytes a terminal sends for this key press. */
export function keyBytes(input: string, key: Key): string {
  if (key.return) return '\r';
  if (key.escape) return '\u001b';
  if (key.tab) return key.shift ? '\u001b[Z' : '\t';
  if (key.backspace || key.delete) return '\u007f';
  if (key.upArrow) return '\u001b[A';
  if (key.downArrow) return '\u001b[B';
  if (key.rightArrow) return '\u001b[C';
  if (key.leftArrow) return '\u001b[D';
  if (key.pageUp) return '\u001b[5~';
  if (key.pageDown) return '\u001b[6~';
  if (key.ctrl && /^[a-z]$/i.test(input)) return String.fromCharCode(input.toLowerCase().charCodeAt(0) - 96);
  if (key.meta && input) return `\u001b${input}`;
  return input;
}

/** Ctrl+], the way telnet and docker attach let go. */
const isDetach = (input: string, key: Key): boolean => input === '\u001d' || (key.ctrl && input === ']');

/** Printable text from a key press or a paste; control characters dropped. */
const printable = (input: string, key: Key): string => (key.ctrl || key.meta ? '' : input.replace(/[\u0000-\u001f\u007f]/g, ''));

const identity = (service: ServiceState | undefined): string => (service?.prompt ? `${service.id} ${JSON.stringify(service.prompt)}` : '');

interface CardState {
  /** The prompt this state belongs to; a new prompt starts fresh. */
  of: string;
  typed: string;
  selected: number;
  hidden: boolean;
}

export function usePrompt(apps: readonly ServiceState[], selected: ServiceState | undefined, controls: DeckControls, notify: (text: string) => void): PromptControl {
  const waiting = apps.find((s) => s.prompt !== undefined);
  const key = identity(waiting);
  const [stored, setStored] = useState<CardState>({ of: '', typed: '', selected: 0, hidden: false });
  const [attachedId, setAttachedId] = useState<string | undefined>(undefined);
  const card: CardState = stored.of === key ? stored : { of: key, typed: '', selected: waiting?.prompt ? initialSelection(waiting.prompt) : 0, hidden: false };
  const update = (patch: Partial<CardState>) => setStored({ ...card, ...patch });
  const attached = apps.find((s) => s.id === attachedId);
  const shown = waiting?.prompt && !card.hidden ? waiting : undefined;
  const prompt = shown?.prompt;

  const send = (data: string, secret = false): void => {
    if (!shown) return;
    if (!controls.write(shown.id, data, secret)) notify(`${shown.label} is not taking input`);
    update({ typed: '' });
  };

  /** Answer with option or button `index`. */
  const choose = (index: number): void => {
    if (!prompt) return;
    if (prompt.kind === 'confirm') return send(`${index === 0 ? prompt.yes : prompt.no}\r`);
    if (prompt.kind === 'choice') return send(choiceKeys(prompt.current, index));
    if (prompt.kind === 'secret' || prompt.kind === 'text') return send(`${card.typed}\r`, prompt.kind === 'secret');
    send('\r');
  };

  const promptKey = (input: string, key: Key): boolean => {
    if (!prompt) return false;
    if (key.escape) {
      update({ hidden: true });
      return true;
    }
    if (key.return) {
      choose(card.selected);
      return true;
    }
    switch (prompt.kind) {
      case 'secret':
      case 'text': {
        if (key.backspace || key.delete) update({ typed: [...card.typed].slice(0, -1).join('') });
        else {
          const text = printable(input, key);
          if (text) update({ typed: card.typed + text });
        }
        // Everything typed belongs to the field, even q.
        return !(key.ctrl && input === 'c');
      }
      case 'confirm':
        if (input === 'y' || input === 'Y') return (choose(0), true);
        if (input === 'n' || input === 'N') return (choose(1), true);
        if (key.leftArrow || key.rightArrow || key.tab) return (update({ selected: 1 - card.selected }), true);
        return false;
      case 'choice': {
        const last = prompt.options.length - 1;
        if (key.upArrow) return (update({ selected: Math.max(0, card.selected - 1) }), true);
        if (key.downArrow) return (update({ selected: Math.min(last, card.selected + 1) }), true);
        const n = Number(input);
        if (Number.isInteger(n) && n >= 1 && n <= last + 1) return (choose(n - 1), true);
        return false;
      }
      default:
        return false;
    }
  };

  const handleKey = (input: string, key: Key): boolean => {
    if (attached) {
      if (isDetach(input, key)) {
        setAttachedId(undefined);
        return true;
      }
      if (!controls.write(attached.id, keyBytes(input, key))) {
        setAttachedId(undefined);
        notify(`${attached.label} is not taking input`);
      }
      return true;
    }
    if (promptKey(input, key)) return true;
    if (input === 'i' && !key.ctrl && !key.meta) {
      const target = shown ?? selected;
      if (!target || !controls.write(target.id, '')) {
        notify(target ? `${target.label} is not taking input` : 'no command to type into');
        return true;
      }
      setAttachedId(target.id);
      return true;
    }
    return false;
  };

  const hints = ((): InputHint[] | undefined => {
    if (attached) return [{ key: 'typing into', word: attached.label, active: true }, { key: 'ctrl+]', word: 'stop typing' }];
    if (!prompt) return undefined;
    const hide = { key: 'esc', word: 'hide' };
    if (prompt.kind === 'confirm') {
      const fallback = card.selected === 0 ? 'yes' : 'no';
      return [{ key: 'y', word: 'yes' }, { key: 'n', word: 'no' }, { key: 'enter', word: fallback }, hide];
    }
    if (prompt.kind === 'choice') return [{ key: '↑↓', word: 'pick' }, { key: 'enter', word: 'choose' }, hide];
    if (prompt.kind === 'continue') return [{ key: 'enter', word: 'continue' }, hide];
    return [{ key: 'enter', word: 'send' }, hide];
  })();

  return { service: shown, prompt, input: { typed: card.typed, selected: card.selected }, attached: attached?.label, handleKey, click: choose, hints };
}

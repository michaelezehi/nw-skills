// The narration player: one audio element for every clip, a token per clip so
// a late `ended` from a cut clip is dropped, and a failed clip reported so the
// story falls back to its silent timing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __setAudioFactoryForTests,
  getProgress,
  pause,
  play,
  resume,
  stop,
  subscribe,
  unlock,
} from '../narration-player';

class FakeAudio extends EventTarget {
  src = '';
  preload = '';
  playsInline = false;
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  attrs = new Map<string, string>();
  playResult: () => Promise<void> = () => Promise.resolve();
  play = vi.fn(() => {
    this.paused = false;
    return this.playResult();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
    this.attrs.delete(name);
  }
}

let made: FakeAudio[] = [];
const heard: Array<[number, string]> = [];

beforeEach(() => {
  made = [];
  heard.length = 0;
  __setAudioFactoryForTests(() => {
    const audio = new FakeAudio();
    made.push(audio);
    return audio as unknown as HTMLAudioElement;
  });
  subscribe((t, outcome) => heard.push([t, outcome]));
});

afterEach(() => {
  __setAudioFactoryForTests(null);
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('narration player', () => {
  it('uses one inline element across many plays', () => {
    play('/audio/walkthrough/founder/a/lead.mp3');
    play('/audio/walkthrough/founder/a/detail.mp3');
    play('/audio/walkthrough/founder/b/lead.mp3');
    expect(made).toHaveLength(1);
    expect(made[0].playsInline).toBe(true);
    expect(made[0].attrs.has('playsinline')).toBe(true);
    expect(made[0].preload).toBe('auto');
    expect(made[0].src).toBe('/audio/walkthrough/founder/b/lead.mp3');
  });

  it('reports a clip ending once, with its token', () => {
    const t = play('/a.mp3');
    made[0].dispatchEvent(new Event('ended'));
    made[0].dispatchEvent(new Event('ended'));
    expect(heard).toEqual([[t, 'ended']]);
  });

  it('drops a late ended after stop()', () => {
    play('/a.mp3');
    stop();
    made[0].dispatchEvent(new Event('ended'));
    made[0].dispatchEvent(new Event('error'));
    expect(heard).toEqual([]);
    expect(made[0].src).toBe('');
  });

  it('a newer play() owns the next ended, not the cut clip', () => {
    play('/a.mp3');
    const second = play('/b.mp3');
    made[0].dispatchEvent(new Event('ended'));
    expect(heard).toEqual([[second, 'ended']]);
  });

  it('reports an error event as a failed clip', () => {
    const t = play('/missing.mp3');
    made[0].dispatchEvent(new Event('error'));
    expect(heard).toEqual([[t, 'failed']]);
  });

  it('reports a rejected play() as failed, but not an abort', async () => {
    __setAudioFactoryForTests(() => {
      const audio = new FakeAudio();
      audio.playResult = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
      made.push(audio);
      return audio as unknown as HTMLAudioElement;
    });
    subscribe((t, outcome) => heard.push([t, outcome]));
    const t = play('/a.mp3');
    await settle();
    expect(heard).toEqual([[t, 'failed']]);

    made[0].playResult = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
    play('/b.mp3');
    await settle();
    expect(heard).toHaveLength(1);
  });

  it('pauses and resumes the clip, and resume does nothing when not held', () => {
    play('/a.mp3');
    const audio = made[0];
    expect(audio.play).toHaveBeenCalledTimes(1);
    resume();
    expect(audio.play).toHaveBeenCalledTimes(1);
    pause();
    expect(audio.pause).toHaveBeenCalledTimes(1);
    resume();
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('gives progress only while a clip with a known length plays', () => {
    expect(getProgress()).toBeNull();
    play('/a.mp3');
    made[0].duration = 20;
    made[0].currentTime = 5;
    expect(getProgress()).toEqual({ currentTime: 5, duration: 20 });
    stop();
    expect(getProgress()).toBeNull();
  });

  it('unlock plays a silent clip once and never disturbs a real one', async () => {
    unlock();
    const audio = made[0];
    expect(audio.src.startsWith('data:audio/wav')).toBe(true);
    await settle();
    expect(audio.src).toBe('');
    unlock();
    expect(audio.play).toHaveBeenCalledTimes(1);
    play('/a.mp3');
    unlock();
    expect(audio.src).toBe('/a.mp3');
  });
});

import type { LineParser, ServiceKind } from '../types.ts';
import { createConvexParser } from './convex.ts';
import { createNextParser } from './next.ts';
import { createNodeParser } from './node.ts';
import { createTscParser } from './tsc.ts';
import { createViteParser } from './vite.ts';

export { parseConvexJsonl } from './convex.ts';

const ANSI_RE = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '').replace(/\r$/, '');
}

export function createParser(kind: ServiceKind): LineParser {
  switch (kind) {
    case 'next':
      return createNextParser();
    case 'convex':
      return createConvexParser();
    case 'node':
      return createNodeParser();
    case 'watch':
      return createTscParser();
    case 'vite':
      return createViteParser();
  }
}

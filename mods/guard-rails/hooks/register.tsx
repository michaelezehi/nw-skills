import type { Register } from 'claude-code'

// Other agents share the branch: anything that sweeps or discards the whole
// working tree can take their in-progress work with it.
const RULES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bgit\s+add\s+(-A\b|--all\b|-u\b|--update\b|\.(\s|$))/, reason: 'stage by path, not the whole tree' },
  { pattern: /\bgit\s+commit\s+(-[a-zA-Z]*a[a-zA-Z]*\b|--all\b)/, reason: 'commit by path: git commit -m "..." -- <paths>' },
  { pattern: /\bgit\s+(stash|reset|clean|restore)\b/, reason: 'never stash, reset, clean or restore' },
  { pattern: /\bgit\s+checkout\s+(?!-b\b|-B\b)/, reason: 'never checkout files; use git switch for branches' },
]

const DASHES = /[—–]/
const WRITES_PROSE = /\bgit\s+commit\b|\bgh\s+(pr|issue)\s+(create|edit|comment)\b/

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const hit = RULES.find(rule => rule.pattern.test(e.command))

    if (hit) {
      return { deny: `guard-rails: ${hit.reason}.` }
    }

    if (WRITES_PROSE.test(e.command) && DASHES.test(e.command)) {
      return { deny: 'guard-rails: the message holds an em or en dash. Use a period or a comma.' }
    }

    return next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'guard-rails: its check failed.' },
  )
}

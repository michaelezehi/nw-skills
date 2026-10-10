import { expect, test } from 'claude-code/testing'

const bash = (command: string) => ({ tool: 'Bash' as const, command })

test('blocks commands that sweep the tree, lets path-scoped ones run', async ($, on) => {
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: { stdout: 'ran', stderr: '', interrupted: false }, text: 'ran' }
  })

  for (const command of ['git add -A', 'git add .', 'git commit -am "x"', 'git stash', 'git reset --hard', 'git checkout -- a.ts', 'git commit -m "a — b" -- a.ts']) {
    const result = await $.tool.call(bash(command))
    expect(JSON.stringify(result)).toContain('guard-rails')
  }
  expect(ran).toBe(0)

  for (const command of ['git add apps/a.ts', 'git commit -m "fix: a, b" -- a.ts', 'git checkout -b feat/x', 'git status', 'ls -a']) {
    const result = await $.tool.call(bash(command))
    expect(JSON.stringify(result)).not.toContain('guard-rails')
  }
  expect(ran).toBe(5)
})

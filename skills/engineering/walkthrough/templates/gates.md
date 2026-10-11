# Walkthrough install: gates

Owned paths: the walkthrough folder, `walkthrough.css`, the art adapter,
the story data, the entry point edits. Nothing else.

- [ ] G1 Investigation written with file paths for roles, homes, menu chrome, hidden screens
  CHECK: test -s INVESTIGATION.md && grep -c "src/" INVESTIGATION.md
  EXPECT: >=5
- [ ] G2 Every step route exists as a page
  CHECK: node ~/.claude/skills/walkthrough/scripts/check-routes.mjs src/walkthrough src/app
  EXPECT: 0 missing
- [ ] G3 No script words or dashes in walkthrough copy
  CHECK: grep -rniP "\bbeat\b|\bact [0-9]|\x{2014}|\x{2013}" src/components/walkthrough src/walkthrough-stories* | wc -l
  EXPECT: 0
- [ ] G4 Templates typecheck in the host
  CHECK: pnpm typecheck
  EXPECT: exit 0
- [ ] G5 Walkthrough tests pass
  CHECK: pnpm vitest run src/components/walkthrough
  EXPECT: exit 0
- [ ] G6 Tokens mapped to the host theme (not left at defaults unless --theme fa)
  CHECK: grep -c "var(--" src/styles/walkthrough.css
  EXPECT: >=1
- [ ] G7 Entry point present for every role story
  CHECK: grep -rn "startTour(" src | wc -l
  EXPECT: >=1

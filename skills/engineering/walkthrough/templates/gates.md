# Walkthrough install: gates

EXPECT is a literal substring or a /regex/; never write >=N, and pad-proof counts
(macOS wc pads with spaces). Never grep -P: BSD grep has no -P.

Owned paths: the walkthrough folder, `walkthrough.css`, the art adapter,
the story data, the entry point edits. Nothing else.

- [ ] G1 Investigation written with file paths for roles, homes, menu chrome, hidden screens
  CHECK: test -s INVESTIGATION.md && grep -c "src/" INVESTIGATION.md
  EXPECT: /^\s*([5-9]|[1-9][0-9]+)\s*$/m
- [ ] G2 Every step route exists as a page
  CHECK: node ~/.claude/skills/walkthrough/scripts/check-routes.mjs src/walkthrough src/app
  EXPECT: /^0 missing/m
- [ ] G3 No script words or dashes in walkthrough copy
  CHECK: grep -rniE "\bbeat\b|\bact [0-9]|—|–" src/components/walkthrough src/walkthrough-stories* | wc -l
  EXPECT: /^\s*0\s*$/m
- [ ] G4 Templates typecheck in the host
  CHECK: pnpm typecheck >/dev/null 2>&1; echo "exit $?"
  EXPECT: exit 0
- [ ] G5 Walkthrough tests pass
  CHECK: pnpm vitest run src/components/walkthrough >/dev/null 2>&1; echo "exit $?"
  EXPECT: exit 0
- [ ] G6 Tokens mapped to the host theme (not left at defaults unless --theme fa)
  CHECK: grep -c "var(--" src/styles/walkthrough.css
  EXPECT: /^\s*[1-9][0-9]*\s*$/m
- [ ] G7 Entry point present for every role story
  CHECK: grep -rn "startTour(" src | wc -l
  EXPECT: /^\s*[1-9][0-9]*\s*$/m

Narration gates (skip with --no-narration):

- [ ] G8 Every narrated step has both clips and the manifest matches the text
  CHECK: pnpm vitest run narration-drift >/dev/null 2>&1; echo "exit $?"
  EXPECT: exit 0
- [ ] G9 Nothing left to generate
  CHECK: npx tsx scripts/walkthrough/generate-narration.ts --stories src/walkthrough/stories.ts --out public/audio/walkthrough --dry-run 2>&1 | tail -1
  EXPECT: /\b0 to generate/
- [ ] G10 Sound preference persisted in localStorage
  CHECK: grep -c "wt-sound" src/components/walkthrough/walkthrough-store.ts
  EXPECT: /^\s*[1-9][0-9]*\s*$/m
- [ ] G11 Every story's spoken length reported from the manifest
  CHECK: node -e 'const m=require("./public/audio/walkthrough/manifest.json");const t={};for(const[k,v]of Object.entries(m.clips)){const s=k.split("/")[0];t[s]=(t[s]||0)+v.durationMs}console.log(Object.entries(t).map(([s,ms])=>s+" "+(ms/1000).toFixed(1)+"s").join(", "))'
  EXPECT: /\d+\.\ds/

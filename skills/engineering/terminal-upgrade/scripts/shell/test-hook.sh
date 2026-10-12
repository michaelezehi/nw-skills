#!/usr/bin/env bash
# Tests devdeck.sh in bash and zsh against a throwaway repo, a stub devdeck and stub package
# managers. The hook only acts in a terminal, so each case runs under `script`, which gives
# it one. Usage: bash test-hook.sh
set -u
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

home="$tmp/home"
repo="$tmp/repo"
bin="$tmp/bin"
mkdir -p "$home/.devdeck/bin" "$home/.devdeck/app/src" "$repo/apps/web" "$bin"
touch "$home/.devdeck/app/src/cli.tsx"
cat > "$home/.devdeck/bin/devdeck" <<'EOF'
#!/bin/sh
echo "deck $*" | sed "s#$DECK_REPO#R#g"
[ -n "${STUB_EXIT:-}" ] && exit "$STUB_EXIT"
exit 0
EOF
chmod +x "$home/.devdeck/bin/devdeck"
for pm in pnpm npm yarn bun; do
  printf '#!/bin/sh\necho "plain %s $*"\n' "$pm" > "$bin/$pm"
  chmod +x "$bin/$pm"
done
cat > "$repo/package.json" <<'EOF'
{ "name": "shop", "scripts": {
  "dev": "turbo run dev", "build": "next build", "ship": "./deploy.sh", "preview": "next start",
  "test": "vitest", "test:ci": "vitest run", "lint": "eslint .", "postinstall": "husky" } }
EOF
echo '{ "name": "web", "scripts": { "build": "next build" } }' > "$repo/apps/web/package.json"
git -C "$repo" init -q
repo=$(cd "$repo" && pwd -P)

pass=0
fail=0
# check <shell> <dir> <expected output> <command...>
check() {
  local shell=$1 dir=$2 want=$3 got
  shift 3
  # script echoes ^D and backspaces when its stdin closes; that is the harness, not the hook.
  got=$(env HOME="$home" DECK_REPO="$repo" STUB_EXIT="${STUB_EXIT:-}" PATH="$bin:/usr/bin:/bin:$(dirname "$(command -v node)")" \
    script -q /dev/null "$shell" -c ". '$here/devdeck.sh'; cd '$dir' && $*; echo \"status=\$?\"" < /dev/null 2>&1 | sed 's/^\^D//' | LC_ALL=C tr -d '\000-\011\013-\037' | grep -v '^$')
  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    printf 'FAIL [%s] %s\n  want: %s\n  got:  %s\n' "$shell" "$*" "$(echo "$want" | tr '\n' '|')" "$(echo "$got" | tr '\n' '|')"
  fi
}

for shell in bash zsh; do
  command -v "$shell" > /dev/null || continue
  check "$shell" "$repo" $'deck --root R\nstatus=0' pnpm dev
  check "$shell" "$repo" $'deck --root R\nstatus=0' npm run dev
  check "$shell" "$repo" $'deck --root R\nstatus=0' bun dev
  check "$shell" "$repo" $'deck --root R run pnpm build\nstatus=0' pnpm build
  check "$shell" "$repo" $'deck --root R run pnpm run ship --prod\nstatus=0' pnpm run ship --prod
  check "$shell" "$repo" $'deck --root R run pnpm preview\nstatus=0' pnpm preview
  check "$shell" "$repo" $'deck --root R run npm run lint\nstatus=0' npm run lint
  check "$shell" "$repo" $'deck --root R run yarn build\nstatus=0' yarn build
  check "$shell" "$repo" $'deck --root R run bun run build\nstatus=0' bun run build
  check "$shell" "$repo" $'deck --root R run pnpm test:ci\nstatus=0' pnpm test:ci
  # Built-ins, flags, unknown names, lifecycle and watch-mode tests stay plain.
  check "$shell" "$repo" $'plain bun build\nstatus=0' bun build
  check "$shell" "$repo" $'plain pnpm install\nstatus=0' pnpm install
  check "$shell" "$repo" $'plain pnpm add zod\nstatus=0' pnpm add zod
  check "$shell" "$repo" $'plain pnpm exec tsc\nstatus=0' pnpm exec tsc
  check "$shell" "$repo" $'plain pnpm -F web build\nstatus=0' pnpm -F web build
  check "$shell" "$repo" $'plain pnpm nope\nstatus=0' pnpm nope
  check "$shell" "$repo" $'plain pnpm run postinstall\nstatus=0' pnpm run postinstall
  check "$shell" "$repo" $'plain npm test\nstatus=0' npm test
  check "$shell" "$repo/apps/web" $'plain pnpm build\nstatus=0' pnpm build
  check "$shell" "$repo" $'plain pnpm build\nstatus=0' DEVDECK=0 pnpm build
  # The command's status comes back; 78 falls back to the plain command.
  STUB_EXIT=3 check "$shell" "$repo" $'deck --root R run pnpm build\nstatus=3' pnpm build
  STUB_EXIT=78 check "$shell" "$repo" $'deck --root R run pnpm build\ndevdeck: running pnpm build as usual\nplain pnpm build\nstatus=0' pnpm build
done

if [ "$fail" -eq 0 ]; then
  echo "all hook cases pass ($pass)"
else
  echo "$fail of $((pass + fail)) hook cases failed"
  exit 1
fi

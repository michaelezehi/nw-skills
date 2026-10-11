# Devdeck shell hook, installed by /terminal-upgrade. Works in zsh and bash.
# `pnpm dev`, `pnpm run dev`, `npm run dev`, `yarn dev`, `bun dev` at a repo root open the
# Devdeck dashboard instead of the raw output. Skip it once with `DEVDECK=0 pnpm dev`, or with
# `command pnpm dev`. When Devdeck cannot run in a repo (exit 78) the original command runs.
# Remove it with `/terminal-upgrade uninstall`.

case ":$PATH:" in *":$HOME/.devdeck/bin:"*) ;; *) PATH="$HOME/.devdeck/bin:$PATH"; export PATH ;; esac

# An alias with the same name would make the function definitions below a parse error.
unalias pnpm npm yarn bun 2>/dev/null

# Sets _devdeck_dir in the caller's scope (both shells scope locals dynamically).
_devdeck_wants() {
  local top script
  [ "${DEVDECK:-1}" = 0 ] && return 1
  # Only in a real terminal: CI, pipes and agent shells keep the plain output.
  [ -t 0 ] && [ -t 1 ] || return 1
  case "$*" in
    "pnpm dev"|"pnpm run dev"|"npm run dev"|"yarn dev"|"yarn run dev"|"bun dev"|"bun run dev") ;;
    *) return 1 ;;
  esac
  [ -x "$HOME/.devdeck/bin/devdeck" ] && [ -f "$HOME/.devdeck/app/src/cli.tsx" ] || return 1
  # The package manager runs the nearest package.json. Only take over at the repo root:
  # `pnpm dev` inside apps/web should still start just that app.
  _devdeck_dir=$(pwd -P)
  while [ "$_devdeck_dir" != "/" ] && [ ! -f "$_devdeck_dir/package.json" ]; do
    _devdeck_dir=$(dirname "$_devdeck_dir")
  done
  [ -f "$_devdeck_dir/package.json" ] || return 1
  top=$(command git -C "$_devdeck_dir" rev-parse --show-toplevel 2>/dev/null) || top=$_devdeck_dir
  top=$(cd "$top" 2>/dev/null && pwd -P) || return 1
  [ "$_devdeck_dir" = "$top" ] || return 1
  # A repo that ships its own Devdeck, or has no dev script, runs as usual.
  script=$(command node -e 'try{const s=require(process.argv[1]).scripts||{};process.stdout.write(s.dev||"")}catch{}' "$_devdeck_dir/package.json" 2>/dev/null)
  [ -n "$script" ] || return 1
  case "$script" in *devdeck*) return 1 ;; esac
  return 0
}

# Run Devdeck; on exit 78 (it cannot run in this repo) fall back to the original command.
_devdeck_run() {
  local pm=$1 rc
  shift
  "$HOME/.devdeck/bin/devdeck" --root "$_devdeck_dir"
  rc=$?
  [ "$rc" -eq 78 ] || return "$rc"
  printf 'devdeck: running %s %s as usual\n' "$pm" "$*" >&2
  command "$pm" "$@"
}

function pnpm { local _devdeck_dir; if _devdeck_wants pnpm "$@"; then _devdeck_run pnpm "$@"; else command pnpm "$@"; fi; }
function npm { local _devdeck_dir; if _devdeck_wants npm "$@"; then _devdeck_run npm "$@"; else command npm "$@"; fi; }
function yarn { local _devdeck_dir; if _devdeck_wants yarn "$@"; then _devdeck_run yarn "$@"; else command yarn "$@"; fi; }
function bun { local _devdeck_dir; if _devdeck_wants bun "$@"; then _devdeck_run bun "$@"; else command bun "$@"; fi; }

# Devdeck shell hook, installed by /terminal-upgrade. Works in zsh and bash.
# At a repo root, `pnpm dev` (and `npm run dev`, `yarn dev`, `bun dev`) opens the Devdeck
# dashboard, and every other package script (`pnpm build`, `npm run ship`, `yarn test`) opens
# a run deck: progress, memory, and prompts you answer from a card. Skip it once with
# `DEVDECK=0 pnpm build`, or with `command pnpm build`. When Devdeck cannot run in a repo
# (exit 78) the original command runs. Remove it with `/terminal-upgrade uninstall`.

case ":$PATH:" in *":$HOME/.devdeck/bin:"*) ;; *) PATH="$HOME/.devdeck/bin:$PATH"; export PATH ;; esac

# An alias with the same name would make the function definitions below a parse error.
unalias pnpm npm yarn bun 2>/dev/null

# The script a command runs, or nothing when it is not a package script. `pnpm <name>` and
# `yarn <name>` run a script unless the name is one of their own commands.
_devdeck_script() {
  local pm=$1
  shift
  case "$1" in
    run|run-script) printf '%s' "$2"; return ;;
    ""|-*) return ;;
  esac
  case "$pm" in
    npm)
      case "$1" in test|t) printf test ;; start|stop|restart) printf '%s' "$1" ;; esac ;;
    bun)
      [ "$1" = dev ] && printf dev ;;
    pnpm|yarn)
      case "$1" in
        add|audit|bin|cache|config|create|dedupe|deploy|dlx|env|exec|fetch|help|i|import|info|init|install|install-test|it|link|licenses|list|login|logout|ls|outdated|pack|patch|patch-commit|plugin|prune|publish|rebuild|remove|rm|root|self-update|set|setup|store|un|uninstall|unlink|up|update|upgrade|version|view|why|whoami|workspace|workspaces) ;;
        *) printf '%s' "$1" ;;
      esac ;;
  esac
}

# Sets _devdeck_dir and _devdeck_mode (dev or run) in the caller's scope (both shells scope
# locals dynamically).
_devdeck_wants() {
  local pm=$1 top script name
  [ "${DEVDECK:-1}" = 0 ] && return 1
  # Only in a real terminal: CI, pipes and agent shells keep the plain output.
  [ -t 0 ] && [ -t 1 ] || return 1
  name=$(_devdeck_script "$@")
  [ -n "$name" ] || return 1
  # Lifecycle scripts run as part of something else; leave them plain.
  case "$name" in
    install|preinstall|postinstall|prepare|prepublish|prepublishOnly|prepack|postpack|preversion|version|postversion) return 1 ;;
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
  script=$(command node -e 'try{const s=require(process.argv[1]).scripts||{};process.stdout.write(s[process.argv[2]]||"")}catch{}' "$_devdeck_dir/package.json" "$name" 2>/dev/null)
  [ -n "$script" ] || return 1
  # A repo that ships its own Devdeck runs as usual.
  case "$script" in *devdeck*) return 1 ;; esac
  if [ "$name" = dev ]; then
    _devdeck_mode=dev
    return 0
  fi
  # Test runners in watch mode read single keys of their own; they keep the plain terminal.
  case "$script" in
    *vitest*) case "$script" in *"vitest run"*|*--run*) ;; *) return 1 ;; esac ;;
  esac
  case "$script" in *jest*--watch*|*--watchAll*|*"node --test"*--watch*) return 1 ;; esac
  _devdeck_mode=run
  return 0
}

# Run Devdeck; on exit 78 (it cannot run in this repo) fall back to the original command.
_devdeck_run() {
  local pm=$1 rc
  shift
  if [ "$_devdeck_mode" = dev ]; then
    "$HOME/.devdeck/bin/devdeck" --root "$_devdeck_dir"
  else
    "$HOME/.devdeck/bin/devdeck" --root "$_devdeck_dir" run "$pm" "$@"
  fi
  rc=$?
  [ "$rc" -eq 78 ] || return "$rc"
  printf 'devdeck: running %s %s as usual\n' "$pm" "$*" >&2
  command "$pm" "$@"
}

function pnpm { local _devdeck_dir _devdeck_mode; if _devdeck_wants pnpm "$@"; then _devdeck_run pnpm "$@"; else command pnpm "$@"; fi; }
function npm { local _devdeck_dir _devdeck_mode; if _devdeck_wants npm "$@"; then _devdeck_run npm "$@"; else command npm "$@"; fi; }
function yarn { local _devdeck_dir _devdeck_mode; if _devdeck_wants yarn "$@"; then _devdeck_run yarn "$@"; else command yarn "$@"; fi; }
function bun { local _devdeck_dir _devdeck_mode; if _devdeck_wants bun "$@"; then _devdeck_run bun "$@"; else command bun "$@"; fi; }

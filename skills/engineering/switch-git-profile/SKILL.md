---
name: switch-git-profile
description: List the GitHub CLI accounts this machine is logged in to and switch the active one. Use when the user runs /switch-git-profile, asks to switch git or GitHub profile or account, or when gh fails with "Could not resolve to a Repository" because the wrong account is active. The same script runs in the terminal as `switch-git-profile` or `sgp`.
---

# Switch git profile

One script does the work: `~/.claude/skills/switch-git-profile/scripts/switch-git-profile`,
linked into `~/.local/bin` as `switch-git-profile` and `sgp`. In a terminal, `sgp` with no
arguments shows a numbered list and asks which account to switch to.

From Claude, never run it without arguments (it waits for keyboard input). Use:

1. `switch-git-profile list` prints one account per line: `<n> <host> <login> <active|->`.
   If it exits with an error, show the error. The usual one is an old `gh` (needs 2.40 or
   later), fixed with `brew install gh`.
2. Ask which account to switch to with AskUserQuestion. One option per account, the
   active one labelled "(active)". Add "Log in to another account" when there is room.
   With one account and nothing to switch to, say so and offer to log in to another.
3. Run `switch-git-profile <login>`. It switches with `gh auth switch` and prints the
   commit email and origin of the current repo, so the user can see both match.
4. "Log in to another account" is interactive. Tell the user to type `! gh auth login`
   in the prompt. Never ask for or handle a token.

What it changes: only the active `gh` account (API calls, `gh pr`, and git over HTTPS when
gh is the credential helper). It leaves `git config user.*` and SSH keys alone. Those
usually follow the folder through `includeIf` and SSH host aliases. If the printed commit
email looks wrong for the repo, point that out.

## Install the terminal command

```sh
ln -sf ~/.claude/skills/switch-git-profile/scripts/switch-git-profile ~/.local/bin/switch-git-profile
ln -sf ~/.claude/skills/switch-git-profile/scripts/switch-git-profile ~/.local/bin/sgp
```

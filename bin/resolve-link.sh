#!/usr/bin/env bash

# Bash twin of bin/resolve-link.js -- see that file for the full rationale.
#
# Resolve a path to the file that actually holds its contents, following a
# symlink chain to its end, INCLUDING a dangling tail. Without this, `mv -f`
# over a symlinked /etc/environment replaces the LINK with a regular file (the
# old `cat >` wrote through it), severing whatever manages that link.
#
# Deliberately avoids `readlink -f` / `realpath`: neither is available on macOS
# bash 3.2, which this script must support, and -f fails on a dangling tail.
#
# Contract (shared with the JS twin):
#   realpath(dirname(end-of-chain)) + "/" + basename(end-of-chain)
# The directory is canonicalized so a caller can write its temp file beside the
# real target for an atomic rename; the final component is left verbatim because
# it is allowed not to exist.
#
# The two implementations are pinned to the same behavior by
# test/fixtures/link-cases.txt -- change one, change both.
#
# Usage:  resolve_link_target <path>   -> prints resolved path, returns 0
#                                      -> returns 1 on a symlink cycle
#
# NOTE: this file must stay sourceable and side-effect free; bin/nvx sources it
# and test/spec/resolve-link.spec.js sources it directly to test it.

RESOLVE_LINK_MAX_DEPTH=40 # same order as the kernel's SYMLOOP_MAX

resolve_link_target() {
  local current="$1"
  local depth=0
  local target dir base resolved_dir

  while [ "$depth" -lt "$RESOLVE_LINK_MAX_DEPTH" ]; do
    # -L tests the link itself, so a dangling link is still a symlink here and a
    # path that does not exist at all is simply not one -- matching the JS
    # lstat/ENOENT split.
    if [ ! -L "$current" ]; then
      break
    fi

    target="$(readlink "$current")" || return 1

    case "$target" in
      /*) current="$target" ;;
      # A relative link resolves against the directory holding the link, not cwd.
      *)
        dir="$(dirname "$current")"
        current="$dir/$target"
        ;;
    esac

    depth=$((depth + 1))
  done

  if [ "$depth" -ge "$RESOLVE_LINK_MAX_DEPTH" ]; then
    echo "resolve_link_target: too many levels of symbolic links resolving $1" >&2
    return 1
  fi

  dir="$(dirname "$current")"
  base="$(basename "$current")"
  # `cd && pwd -P` is the bash-3.2-safe canonicalizer. If the directory cannot be
  # entered, fall back to the unresolved path and let the caller's write surface
  # the real error.
  if resolved_dir="$(cd "$dir" 2>/dev/null && pwd -P)"; then
    printf '%s\n' "$resolved_dir/$base"
  else
    printf '%s\n' "$current"
  fi

  return 0
}

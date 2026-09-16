#!/bin/sh
# Run every shell-semantics probe under every shell the platform offers; write one TSV.
#
#   sh collector/shells/probe-shells.sh <platform>
#
# Output: out/<platform>/_shells.tsv with one row per shell per probe:
#   platform  shell  kind  version  probe  exit  stdout1  stderr1
# `kind` is what the binary says it is (bash, zsh, ksh, dash, busybox) and `version` is asked of
# the binary itself, so a row can never be attributed to the wrong interpreter. The shells tried
# are the ones a shebang or `sh` invocation would actually reach on that platform.
#
# Every probe runs with the shell's own startup files disabled, so a row is the shell as shipped
# and not somebody's configuration: zsh gets `-d -f` (NO_GLOBAL_RCS, NO_RCS), and $ENV and
# $BASH_ENV are removed from the environment for every shell. `/etc/zshenv` is read by zsh no
# matter what the flags say, so its presence is recorded in out/<platform>/_shellfiles.tsv
# alongside the other startup files, and that file is part of the evidence.
set -u
PLATFORM=$1
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="out/$PLATFORM/_shells.tsv"
mkdir -p "out/$PLATFORM"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

case "$PLATFORM" in
  ubuntu) SHELLS="/bin/bash /bin/sh /bin/dash /bin/zsh /bin/ksh" ;;
  macos)  SHELLS="/bin/bash /bin/sh /bin/zsh /bin/ksh" ;;
  alpine) SHELLS="/bin/sh /bin/ash /bin/bash /bin/zsh /usr/bin/dash" ;;
  *) echo "unknown platform $PLATFORM" >&2; exit 2 ;;
esac

flat() { tr '\t\r' '  ' | head -n 1 | cut -c1-240; }

kind_of() {
  k=$(env -u ENV -u BASH_ENV "$1" -c 'if [ -n "${BASH_VERSION:-}" ]; then echo bash; elif [ -n "${ZSH_VERSION:-}" ]; then echo zsh; elif [ -n "${KSH_VERSION:-}" ]; then echo ksh; else echo other; fi' 2>/dev/null </dev/null)
  if [ "$k" = "other" ]; then
    if "$1" --help 2>&1 </dev/null | head -n 3 | grep -qi busybox; then k=busybox
    elif [ "$(basename "$(readlink -f "$1" 2>/dev/null || echo "$1")")" = "dash" ]; then k=dash
    else k=$(basename "$(readlink -f "$1" 2>/dev/null || echo "$1")"); fi
  fi
  printf '%s' "$k"
}

version_of() {
  case "$2" in
    bash) "$1" -c 'printf "%s" "$BASH_VERSION"' ;;
    zsh)  "$1" -d -f -c 'printf "%s" "$ZSH_VERSION"' ;;
    ksh)  "$1" -c 'printf "%s" "$KSH_VERSION"' ;;
    busybox) "$1" --help 2>&1 </dev/null | head -n 1 | sed 's/^BusyBox //; s/ multi-call.*//' ;;
    dash)
      if command -v dpkg-query >/dev/null 2>&1; then dpkg-query -W -f '${Version}' dash 2>/dev/null
      elif command -v apk >/dev/null 2>&1; then apk info -v dash 2>/dev/null | head -n 1 | sed 's/^dash-//'
      else echo unknown; fi ;;
    *) "$1" --version 2>&1 </dev/null | head -n 1 ;;
  esac | flat
}

# Docker exports HOSTNAME into the Alpine container; with it inherited, dash would look as if it set the variable itself
unset HOSTNAME
# $ENV is read by dash, BusyBox ash and ksh; $BASH_ENV by non-interactive bash. Out of the way.
unset ENV BASH_ENV

# Which startup files existed while this recording was made; a reader can then judge for themselves
# whether a row could have been influenced by one. zsh reads /etc/zshenv even with -d -f.
FILES="out/$PLATFORM/_shellfiles.tsv"
printf 'platform\tfile\texists\tbytes\n' > "$FILES"
for f in /etc/zshenv /etc/zsh/zshenv "$HOME/.zshenv" "${ZDOTDIR:-}/.zshenv" /etc/zshrc /etc/zsh/zshrc "$HOME/.zshrc" \
         /etc/profile "$HOME/.profile" /etc/bash.bashrc "$HOME/.bashrc" "$HOME/.bash_profile" /etc/ksh.kshrc; do
  [ "$f" = "/.zshenv" ] && continue   # $ZDOTDIR is unset, so this entry is not a real path
  if [ -f "$f" ]; then printf '%s\t%s\tyes\t%s\n' "$PLATFORM" "$f" "$(wc -c < "$f" | tr -d ' ')" >> "$FILES"
  else printf '%s\t%s\tno\t0\n' "$PLATFORM" "$f" >> "$FILES"; fi
done
echo "== startup files present: $(grep -c '\tyes\t' "$FILES") of $(($(wc -l < "$FILES") - 1))" >&2

# zsh is the only shell here that reads a per-user file in a non-interactive shell ($ZDOTDIR/.zshenv),
# and the only one with a flag to stop it.
rcflags_for() { case "$1" in zsh) printf '%s' '-d -f' ;; *) printf '' ;; esac; }

printf 'platform\tshell\tkind\tversion\tprobe\texit\tstdout1\tstderr1\n' > "$OUT"
for SH in $SHELLS; do
  if [ ! -x "$SH" ]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$PLATFORM" "$SH" "missing" "" "-" "-" "" "shell not present" >> "$OUT"
    continue
  fi
  KIND=$(kind_of "$SH"); VER=$(version_of "$SH" "$KIND")
  RCFLAGS=$(rcflags_for "$KIND")
  echo "== $PLATFORM $SH: $KIND $VER ${RCFLAGS:+($RCFLAGS)}" >&2
  grep -v '^#' "$HERE/probes.txt" | grep -v '^[[:space:]]*$' | while IFS='	' read -r ID LABEL SNIPPET; do
    [ -n "$SNIPPET" ] || { echo "probes.txt: $ID has no snippet (missing TAB?)" >&2; exit 1; }
    [ -n "$ID" ] || continue
    rm -rf "$T/w"; mkdir -p "$T/w"
    # shellcheck disable=SC2086  # RCFLAGS is a deliberate word list
    ( cd "$T/w" && "$SH" $RCFLAGS -c "$SNIPPET" </dev/null >"$T/.o" 2>"$T/.e" ); CODE=$?
    O=$(flat < "$T/.o"); E=$(flat < "$T/.e")
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$PLATFORM" "$SH" "$KIND" "$VER" "$ID" "$CODE" "$O" "$E" >> "$OUT"
  done
done
echo "wrote $OUT ($(($(wc -l < "$OUT") - 1)) rows)" >&2

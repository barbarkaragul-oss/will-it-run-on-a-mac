#!/bin/sh
# Run every shell-semantics probe under every shell the platform offers; write one TSV.
#
#   sh collector/shells/probe-shells.sh <platform>
#
# Output: out/<platform>/_shells.tsv with one row per shell per probe:
#   platform  shell  kind  version  probe  exit  stdout1  stderr1
#
# zsh is recorded more than once: plain, and again under each compatibility knob a script author
# reaches for when a zsh has to run bash-ish code (`-o shwordsplit`, `--emulate sh`, ...). Those
# rows carry a shell name of "<path>+<knob>", so the database can answer "and if my zsh sets
# shwordsplit?" instead of only describing a default zsh.
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

# The compatibility knobs, as a script author would spell them. --emulate has to come before the
# other options (Invocation: "may be passed to the shell ... following options are honoured").
# Every one of these is off in a native zsh, so the plain rows stay the baseline.
zsh_variants() {
  cat <<VARIANTS
shwordsplit	-o shwordsplit
ksharrays	-o ksharrays
nonomatch	-o nonomatch
octalzeroes	-o octalzeroes
bashrematch	-o bashrematch
bashish	-o shwordsplit -o ksharrays -o nonomatch -o octalzeroes -o bashrematch
emulate-sh	--emulate sh
emulate-ksh	--emulate ksh
VARIANTS
}

# Docker exports HOSTNAME into the Alpine container; with it inherited, dash would look as if it set the variable itself
unset HOSTNAME
# $ENV is read by dash, BusyBox ash and ksh; $BASH_ENV by non-interactive bash. Out of the way.
unset ENV BASH_ENV

# Which startup files existed while this recording was made; a reader can then judge for themselves
# whether a row could have been influenced by one. zsh reads /etc/zshenv even with -d -f.
FILES="out/$PLATFORM/_shellfiles.tsv"
printf 'platform\tfile\texists\tbytes\tsetopt_lines\n' > "$FILES"
for f in /etc/zshenv /etc/zsh/zshenv "$HOME/.zshenv" "${ZDOTDIR:-}/.zshenv" /etc/zshrc /etc/zsh/zshrc "$HOME/.zshrc" \
         /etc/profile "$HOME/.profile" /etc/bash.bashrc "$HOME/.bashrc" "$HOME/.bash_profile" /etc/ksh.kshrc; do
  [ "$f" = "/.zshenv" ] && continue   # $ZDOTDIR is unset, so this entry is not a real path
  if [ -f "$f" ]; then
    # only a line that turns an option on or off can change what a probe prints; PATH setup cannot
    n=$(grep -cE '^[[:space:]]*(setopt|unsetopt|emulate|set -[ko])' "$f" 2>/dev/null || true)
    printf '%s\t%s\tyes\t%s\t%s\n' "$PLATFORM" "$f" "$(wc -c < "$f" | tr -d ' ')" "${n:-0}" >> "$FILES"
  else printf '%s\t%s\tno\t0\t0\n' "$PLATFORM" "$f" >> "$FILES"; fi
done
# awk, not grep: a POSIX grep does not read \t as a tab, and the count came out zero on Ubuntu
echo "== startup files present: $(awk -F'\t' 'NR>1 && $3=="yes"' "$FILES" | wc -l | tr -d ' ') of $(($(wc -l < "$FILES") - 1)), option-setting lines in them: $(awk -F'\t' 'NR>1 {n+=$5} END {print n+0}' "$FILES")" >&2

# zsh is the only shell here that reads a per-user file in a non-interactive shell ($ZDOTDIR/.zshenv),
# and the only one with a flag to stop it.
# the long spellings: `emulate sh` turns on SH_OPTION_LETTERS, and a following -d -f is then read
# the way ksh would read it and rejected
rcflags_for() { case "$1" in zsh) printf '%s' '--no-globalrcs --no-rcs' ;; *) printf '' ;; esac; }

# bin, name for the shell column, kind, version, rc flags, extra arguments
run_probes() {
  _bin=$1; _col=$2; _kind=$3; _ver=$4; _rc=$5; _extra=$6
  # shellcheck disable=SC2086  # _extra and _rc are deliberate word lists
  if ! "$_bin" $_extra $_rc -c ':' >"$T/.c" 2>&1; then
    _why=$(flat < "$T/.c")
    echo "!! $PLATFORM $_col: the shell rejects $_extra: $_why" >&2
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$PLATFORM" "$_col" "$_kind" "$_ver" "-" "-" "" "rejected $_extra: $_why" >> "$OUT"
    return 0
  fi
  echo "== $PLATFORM $_col: $_kind $_ver ${_extra:+[$_extra]}${_rc:+ ($_rc)}" >&2
  grep -v '^#' "$HERE/probes.txt" | grep -v '^[[:space:]]*$' | while IFS='	' read -r ID LABEL SNIPPET; do
    [ -n "$SNIPPET" ] || { echo "probes.txt: $ID has no snippet (missing TAB?)" >&2; exit 1; }
    [ -n "$ID" ] || continue
    rm -rf "$T/w"; mkdir -p "$T/w"
    # shellcheck disable=SC2086
    ( cd "$T/w" && "$_bin" $_extra $_rc -c "$SNIPPET" </dev/null >"$T/.o" 2>"$T/.e" ); CODE=$?
    O=$(flat < "$T/.o"); E=$(flat < "$T/.e")
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$PLATFORM" "$_col" "$_kind" "$_ver" "$ID" "$CODE" "$O" "$E" >> "$OUT"
  done
}

printf 'platform\tshell\tkind\tversion\tprobe\texit\tstdout1\tstderr1\n' > "$OUT"
for SH in $SHELLS; do
  if [ ! -x "$SH" ]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$PLATFORM" "$SH" "missing" "" "-" "-" "" "shell not present" >> "$OUT"
    continue
  fi
  KIND=$(kind_of "$SH"); VER=$(version_of "$SH" "$KIND")
  RCFLAGS=$(rcflags_for "$KIND")
  run_probes "$SH" "$SH" "$KIND" "$VER" "$RCFLAGS" ""
  [ "$KIND" = "zsh" ] || continue
  zsh_variants | while IFS='	' read -r VLABEL VARGS; do
    [ -n "$VLABEL" ] || continue
    run_probes "$SH" "$SH+$VLABEL" "$KIND" "$VER" "$RCFLAGS" "$VARGS"
  done
done
echo "wrote $OUT ($(($(wc -l < "$OUT") - 1)) rows)" >&2

#!/bin/sh
# Records, for every tool in collector/tools.txt, what THIS platform's binary says about itself:
# path, --help (stdout+stderr, exit code), --version, and the man page (rendered text and source).
# POSIX sh: it runs under macOS /bin/sh, Ubuntu dash and BusyBox ash.
#   sh collector/collect.sh <platform>      -> out/<platform>/<tool>/...
set -u
P="$1"
OUT="out/$P"
mkdir -p "$OUT"

# Run a command with a time limit, whatever this platform has.
run_to() {
  if command -v timeout >/dev/null 2>&1; then timeout 8 "$@"
  elif command -v perl >/dev/null 2>&1; then perl -e 'alarm 8; exec @ARGV' -- "$@"
  else "$@"
  fi
}

{
  echo "platform=$P"
  echo "recorded_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  uname -a
  [ -f /etc/os-release ] && head -3 /etc/os-release
  command -v sw_vers >/dev/null 2>&1 && sw_vers
  command -v busybox >/dev/null 2>&1 && busybox 2>&1 | head -1
  ls --version 2>/dev/null | head -1
  echo "sh=$(command -v sh) $(sh --version 2>/dev/null | head -1)"
  echo "bash=$(command -v bash) $(bash --version 2>/dev/null | head -1)"
  echo "man=$(command -v man || echo none)"
  echo "PATH=$PATH"
} > "$OUT/_platform.txt" 2>&1

while IFS= read -r tool; do
  case "$tool" in ''|'#'*) continue ;; esac
  d="$OUT/$tool"
  mkdir -p "$d"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo MISSING > "$d/path.txt"
    continue
  fi
  command -v "$tool" > "$d/path.txt" 2>&1
  # BSD tools usually reject --help with "illegal option" and print their usage line: that is data too.
  # Every output is capped: a BSD tool given --help may echo it forever (yes does), page, or wait.
  run_to "$tool" --help < /dev/null > "$d/help.raw" 2>&1; echo $? > "$d/help.code"
  head -c 200000 "$d/help.raw" > "$d/help.txt"; rm -f "$d/help.raw"
  run_to "$tool" --version < /dev/null > "$d/version.raw" 2>&1; echo $? > "$d/version.code"
  head -c 20000 "$d/version.raw" > "$d/version.txt"; rm -f "$d/version.raw"
  if command -v man >/dev/null 2>&1; then
    man -w "$tool" > "$d/man.path" 2>/dev/null || true
    (MANWIDTH=200 COLUMNS=200 run_to man "$tool" 2>/dev/null | col -b | head -c 400000) > "$d/man.txt" 2>/dev/null || true
    mp=$(head -1 "$d/man.path" 2>/dev/null || true)
    if [ -n "$mp" ] && [ -f "$mp" ]; then
      case "$mp" in
        *.gz) gzip -dc "$mp" > "$d/man.src" 2>/dev/null || true ;;
        *) cat "$mp" > "$d/man.src" 2>/dev/null || true ;;
      esac
    fi
  fi
done < collector/tools.txt
echo "collected $(ls "$OUT" | wc -l) entries for $P"

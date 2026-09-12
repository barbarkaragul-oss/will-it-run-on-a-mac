#!/bin/sh
# Execution ground truth: runs each probe from collector/probes.txt in a fresh temp directory on THIS
# platform and records the exit code and the first line of stderr. A flag's verdict on the page is
# backed by this, not only by what the man page says.
#   sh collector/probe.sh <platform>   -> out/<platform>/_probes.tsv
set -u
P="$1"
OUT="out/$P"
mkdir -p "$OUT"
TSV="$OUT/_probes.tsv"
printf 'id\tcode\tstderr1\tstdout1\tcommand\n' > "$TSV"

run_to() {
  if command -v timeout >/dev/null 2>&1; then timeout 20 "$@"
  elif command -v perl >/dev/null 2>&1; then perl -e 'alarm 20; exec @ARGV' -- "$@"
  else "$@"
  fi
}

ROOT=$(pwd)
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue ;; esac
  id=${line%%	*}
  cmd=${line#*	}
  T=$(mktemp -d 2>/dev/null || mktemp -d -t wiroam)
  printf 'b\na\na\nc\n' > "$T/f"
  cp "$T/f" "$T/g"
  mkdir -p "$T/d"; printf 'x\n' > "$T/d/x.txt"
  ( cd "$T" && run_to sh -c "$cmd" < /dev/null > out.txt 2> err.txt; echo $? > code.txt )
  code=$(cat "$T/code.txt" 2>/dev/null || echo '?')
  err1=$(head -1 "$T/err.txt" 2>/dev/null | tr '\t' ' ' | cut -c1-200)
  out1=$(head -1 "$T/out.txt" 2>/dev/null | tr '\t' ' ' | cut -c1-120)
  printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$code" "$err1" "$out1" "$cmd" >> "$TSV"
  cd "$ROOT"
  rm -rf "$T"
done < collector/probes.txt
echo "probed $(($(wc -l < "$TSV") - 1)) commands on $P"

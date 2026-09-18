#!/bin/sh
# Portable on purpose: every tool that is missing somewhere is only used where it was found, or as a fallback.
run_to() {
  if command -v timeout >/dev/null 2>&1; then timeout 8 "$@"
  elif command -v perl >/dev/null 2>&1; then perl -e 'alarm 8; exec @ARGV' -- "$@"
  else "$@"
  fi
}
T=$(mktemp -d 2>/dev/null || mktemp -d -t wiroam)
command -v tac >/dev/null && tac log.txt
head -n 1 log.txt

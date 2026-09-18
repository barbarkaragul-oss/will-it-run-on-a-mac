#!/bin/bash
# A release script written on a Linux laptop: the CI dogfood run and tests/action-core.test.ts check it.
set -eu
ls -la
sed -i 's/a/b/' version.txt
date -d yesterday +%F
timeout 5 sleep 1
find . -printf '%p\n'
uniq -D names.txt
mapfile -t lines < names.txt
$OPTS

/** Sample scripts: the kind of thing that works on the author's Linux box and breaks in a macOS or Alpine CI job. */
export interface Sample { id: string; title: string; blurb: string; script: string }

export const SAMPLES: Sample[] = [
  {
    id: 'release',
    title: 'A release script from a Linux laptop',
    blurb: 'sed -i without a suffix, date -d, readlink -f, sort -V, grep -P: the usual suspects. Some of them are fine on macOS 26, some are not, and one is fine on macOS but not on BusyBox.',
    script: `#!/usr/bin/env bash
set -euo pipefail

ROOT=$(readlink -f "$(dirname "$0")/..")
VERSION=$(git tag --list 'v*' | sort -V | tail -n 1)
STAMP=$(date -d yesterday +%Y-%m-%d)

sed -i "s/^version = .*/version = \\"$VERSION\\"/" "$ROOT/Cargo.toml"
grep -P '^\\d+\\.\\d+' "$ROOT/CHANGELOG.md" | head -n 3

find "$ROOT/dist" -name '*.tar.gz' -printf '%f\\n' | xargs -d '\\n' -r sha256sum > "$ROOT/dist/SHA256SUMS"
tar -czf "release-$VERSION.tgz" --wildcards 'dist/*.tar.gz'
cp --reflink=auto "release-$VERSION.tgz" /tmp/
stat -c %s "release-$VERSION.tgz"
`,
  },
  {
    id: 'entrypoint',
    title: 'A Docker entrypoint that runs on Alpine',
    blurb: 'BusyBox has fewer flags than macOS in some places and more in others: uniq -D, split -d, ls -G, mktemp -t, base64 -b.',
    script: `#!/bin/sh
set -e
TMP=$(mktemp -t app)
uniq -D /etc/hosts > "$TMP"
split -d -l 100 "$TMP" chunk.
ls -G /app
base64 -w0 /app/config.json > /tmp/config.b64
timeout 5 wget -q http://localhost:8080/health
exec nginx -g 'daemon off;'
`,
  },
  {
    id: 'portable',
    title: 'The same job, written to survive all three',
    blurb: 'sed -i.bak, readlink -f is fine on macOS 12.3 and later, sort -V exists on macOS, date -u +%s instead of date -d, find -exec instead of -printf.',
    script: `#!/bin/sh
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=$(git tag --list 'v*' | sort -V | tail -n 1)
STAMP=$(date -u +%Y-%m-%d)
sed -i.bak "s/^version = .*/version = \\"$VERSION\\"/" "$ROOT/Cargo.toml" && rm -f "$ROOT/Cargo.toml.bak"
grep -E '^[0-9]+\\.[0-9]+' "$ROOT/CHANGELOG.md" | head -n 3
find "$ROOT/dist" -name '*.tar.gz' -exec shasum -a 256 {} + > "$ROOT/dist/SHA256SUMS"
tar -czf "release-$VERSION.tgz" dist/
wc -c < "release-$VERSION.tgz"
`,
  },
  {
    id: 'dynamic',
    title: 'What it refuses to guess',
    blurb: 'Dynamic command names and arguments are reported, not judged; builtins depend on the shell; old-style tar options are noted.',
    script: `#!/bin/bash
OPTS="-la"
ls $OPTS
$SED_BIN -i 's/a/b/' file
echo -e "tab\\there"
tar xvf archive.tar
sudo -E env FOO=1 xargs -0 rm -rf < list0
sh -c 'du -b file'
`,
  },
];

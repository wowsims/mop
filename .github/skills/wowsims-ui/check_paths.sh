#!/bin/sh
# Verifies that this skill still describes a tree that exists.
#
#   .github/skills/wowsims-ui/check_paths.sh        (from anywhere in the repo)
#
# Checks three things:
#   1. every repo path this skill names in backticks still exists
#   2. every references/*.md is routed to from SKILL.md, and every file SKILL.md
#      routes to exists
#   3. the frontmatter `name:` still matches the directory name
#
# A path is only checked when it is unambiguous: it must start with a real
# top-level directory or be a known root file, and contain no glob or
# placeholder character (* < { … space). A trailing `:<line>` is stripped, so a
# `file.ts:123` citation is checked as the file. Generated and build output is
# skipped because it is absent in a clean checkout by design — that covers
# ui/generated, dist, tmp, binary_dist, node_modules and every *_auto_gen.ts.
# Anything this skill deliberately names as *not* existing, or as present only
# through .git/info/exclude, goes in ABSENT_BY_DESIGN below.

set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo=$(CDPATH= cd -- "$here/../../.." && pwd)
cd "$repo"

# Paths this skill names precisely because they are gone or uncommitted.
ABSENT_BY_DESIGN="tools/browser-perf/
tools/react-migration/
tools/react-migration/README.md
tools/restructure/move.mjs
ui/index.ts
ui/worker/highs.js"

fail=0

# --- 1. paths -------------------------------------------------------------
paths=$(cat "$here"/SKILL.md "$here"/references/*.md |
	grep -o '`[^`]*`' |
	tr -d '`' |
	grep -E '^(ui|tools|assets|schemas|proto|sim|cmd|docs)/|^\.github/|^(package\.json|tsconfig\.json|makefile|test-locales\.mjs|vite\.[a-z.-]*mts|vitest\.config\.mts|\.oxlintrc\.json|\.oxfmtrc\.json|STATE_UI_SEPARATION_PLAN\.md)$' |
	grep -Ev '[*<{ ]|…' |
	grep -Ev '^(ui/generated|dist|tmp|binary_dist|node_modules)/|_auto_gen\.ts$' |
	sed -E 's/:[0-9]+$//' |
	sort -u)

for p in $paths; do
	case "$ABSENT_BY_DESIGN" in
	*"$p"*) continue ;;
	esac
	# Strip a trailing slash so a directory reference checks the directory.
	if [ ! -e "${p%/}" ]; then
		echo "MISSING PATH  $p"
		fail=1
	fi
done

# --- 2. routing -----------------------------------------------------------
for f in "$here"/references/*.md; do
	name="references/$(basename "$f")"
	grep -qF "$name" "$here/SKILL.md" || {
		echo "UNROUTED      $name is not mentioned in SKILL.md"
		fail=1
	}
done
for name in $(grep -o 'references/[a-z-]*\.md' "$here/SKILL.md" | sort -u); do
	[ -f "$here/$name" ] || {
		echo "DANGLING      SKILL.md routes to $name, which does not exist"
		fail=1
	}
done

# --- 3. frontmatter -------------------------------------------------------
declared=$(sed -n '2s/^name: *//p' "$here/SKILL.md")
[ "$declared" = "$(basename "$here")" ] || {
	echo "BAD NAME      frontmatter name '$declared' != directory '$(basename "$here")'"
	fail=1
}

[ "$fail" = 0 ] && echo "wowsims-ui: OK ($(echo "$paths" | wc -l | tr -d ' ') paths checked)"
exit "$fail"

// Golden snapshot check for the state/UI separation refactor.
//
//   node tools/state-snapshots/check.mjs          — compare against golden.json
//   node tools/state-snapshots/check.mjs --update — regenerate golden.json
//
// Builds the harness bundle (vite.harness.mts), runs it under happy-dom via
// run.mjs, and diffs the output against the committed golden. Any diff means
// serialization behavior changed — investigate before updating the golden.
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const goldenPath = path.join(here, 'golden.json');
const update = process.argv.includes('--update');

console.error('[snapshots] building harness bundle...');
execFileSync(path.join(repoRoot, 'node_modules/.bin/vite'), ['build', '-c', 'vite.harness.mts'], {
	cwd: repoRoot,
	env: { ...process.env, HARNESS_ENTRY: 'tools/state-snapshots/snapshot.ts' },
	stdio: ['ignore', 'ignore', 'inherit'],
});

console.error('[snapshots] generating snapshots...');
const output = execFileSync(process.execPath, [path.join(here, 'run.mjs')], {
	cwd: repoRoot,
	env: { ...process.env, HARNESS_BUNDLE: 'snapshot.js' },
	maxBuffer: 256 * 1024 * 1024,
}).toString();

const parsed = JSON.parse(output);
const unstable = Object.entries(parsed).filter(([, v]) => !v.roundTripStable);
if (unstable.length) {
	console.error('[snapshots] FAIL: fromProto(toProto) round trip not stable for:', unstable.map(([k]) => k).join(', '));
	process.exit(1);
}

if (update) {
	writeFileSync(goldenPath, output);
	console.error(`[snapshots] golden.json updated (${Object.keys(parsed).length} specs).`);
	process.exit(0);
}

const golden = readFileSync(goldenPath, 'utf8');
if (golden === output) {
	console.error(`[snapshots] OK: ${Object.keys(parsed).length} specs match golden.`);
	process.exit(0);
}

// Report which specs differ.
const goldenParsed = JSON.parse(golden);
const specs = new Set([...Object.keys(parsed), ...Object.keys(goldenParsed)]);
const changed = [...specs].filter(s => JSON.stringify(parsed[s]) !== JSON.stringify(goldenParsed[s]));
console.error('[snapshots] FAIL: snapshot diverges from golden for:', changed.join(', '));
console.error('[snapshots] run with --update ONLY if the change is intended.');
process.exit(1);

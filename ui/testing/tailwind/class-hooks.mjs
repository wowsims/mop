#!/usr/bin/env node
// Finds retired-style class hooks (non-Tailwind, non-ui-*, non-allowlisted class tokens) in
// production ui/**/*.{ts,tsx}, plus any [data-testid] styling hook in ui/**/*.css or TSX
// arbitrary variants. Reuses canonical-classes.mjs's token collector.
//
// Usage:
//   node ui/testing/tailwind/class-hooks.mjs [--css <path>] [--json] [root]

import fs from 'node:fs';
import path from 'node:path';

import { collectTokens, findDefaultCss, loadDesignSystemCached } from './canonical-classes.mjs';

function loadAllowlist(root) {
	const file = path.join(root, 'ui/class_hook_allowlist.json');
	const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
	return entries.map(e => (e.pattern ? { ...e, re: new RegExp(e.pattern) } : e));
}

function isAllowlisted(token, allowlist) {
	for (const entry of allowlist) {
		if (entry.token && entry.token === token) return true;
		if (entry.re && entry.re.test(token)) return true;
	}
	return false;
}

function stripVariants(token) {
	const parts = token.replace(/^!/, '').split(':');
	return parts[parts.length - 1].replace(/!$/, '');
}

function isTestFile(relPath) {
	return /\.test\.tsx?$/.test(relPath);
}

export async function findClassHooks(root, opts = {}) {
	const allowlist = opts.allowlist || loadAllowlist(root);
	const cssPath = opts.css || findDefaultCss(root);
	const designSystem = await loadDesignSystemCached(cssPath);

	const occurrences = collectTokens(root)
		.filter(occ => occ.file.endsWith('.ts') || occ.file.endsWith('.tsx'))
		.filter(occ => !isTestFile(occ.file));

	const hooks = [];
	for (const occ of occurrences) {
		const bare = stripVariants(occ.token);
		if (bare.startsWith('-') || bare.endsWith('-')) continue; // head/tail fragment of a dynamic template composition, not a complete token
		if (designSystem.candidatesToCss([occ.token])[0]) continue;
		if (bare.startsWith('ui-')) continue;
		if (isAllowlisted(occ.token, allowlist) || isAllowlisted(bare, allowlist)) continue;
		hooks.push({ token: occ.token, file: occ.file, line: occ.line });
	}
	hooks.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
	return hooks;
}

export async function findRetiredClassNames(root, retired, opts = {}) {
	const allowlist = opts.allowlist || loadAllowlist(root);
	const cssPath = opts.css || findDefaultCss(root);
	const designSystem = await loadDesignSystemCached(cssPath);
	const retiredSet = new Set(retired);

	const occurrences = collectTokens(root).filter(occ => !isTestFile(occ.file));

	const hits = [];
	for (const occ of occurrences) {
		const bare = stripVariants(occ.token);
		if (!retiredSet.has(bare)) continue;
		if (designSystem.candidatesToCss([occ.token])[0]) continue;
		if (isAllowlisted(occ.token, allowlist) || isAllowlisted(bare, allowlist)) continue;
		hits.push({ file: occ.file, line: occ.line, token: occ.token });
	}
	hits.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
	return hits;
}

const TESTID_VARIANT_RE = /\[[^[\]]*\[data-testid[^\]]*\][^[\]]*\]:/;

function walk(dir, exts, skipDirs) {
	const out = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (skipDirs.has(full)) continue;
			out.push(...walk(full, exts, skipDirs));
		} else if (exts.some(ext => entry.name.endsWith(ext))) {
			out.push(full);
		}
	}
	return out;
}

export function findTestidStyling(root) {
	const skipDirs = new Set([path.join(root, 'ui/generated'), path.join(root, 'node_modules')]);
	const hits = [];

	for (const file of walk(path.join(root, 'ui'), ['.css'], skipDirs)) {
		const relPath = path.relative(root, file);
		const text = fs.readFileSync(file, 'utf8');
		const lines = text.split('\n');
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes('[data-testid')) hits.push({ file: relPath, line: i + 1, match: lines[i].trim() });
		}
	}

	for (const file of walk(path.join(root, 'ui'), ['.tsx', '.ts'], skipDirs)) {
		const relPath = path.relative(root, file);
		const text = fs.readFileSync(file, 'utf8');
		const lines = text.split('\n');
		for (let i = 0; i < lines.length; i++) {
			if (TESTID_VARIANT_RE.test(lines[i])) hits.push({ file: relPath, line: i + 1, match: lines[i].trim() });
		}
	}

	hits.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
	return hits;
}

async function main() {
	const args = process.argv.slice(2);
	let cssArg;
	let json = false;
	let root = process.cwd();
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--css') cssArg = args[++i];
		else if (args[i] === '--json') json = true;
		else root = path.resolve(args[i]);
	}

	const hooks = await findClassHooks(root, { css: cssArg ? path.resolve(cssArg) : undefined });
	const testidHits = findTestidStyling(root);

	if (json) {
		console.log(JSON.stringify({ hooks, testidHits }, null, 2));
	} else {
		console.log(`\nClass hooks (${hooks.length})`);
		for (const h of hooks) console.log(`  ${h.file}:${h.line}  ${h.token}`);
		console.log(`\ntestid styling (${testidHits.length})`);
		for (const h of testidHits) console.log(`  ${h.file}:${h.line}  ${h.match}`);
	}

	if (hooks.length > 0 || testidHits.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

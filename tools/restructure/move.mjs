#!/usr/bin/env node
// Moves files/directories inside ui/ and repairs every import specifier that
// pointed at them, across ui/ and tools/.
//
//   node tools/restructure/move.mjs <moves-file> [--dry-run] [--verbose]
//
// The moves file is a list of `from -> to` pairs (one per line, `#` comments
// allowed) or the JSON equivalent (`[{"from":…,"to":…}]`). Either side may be a
// file or a whole directory; a directory move expands to its files.
//
// Specifiers are resolved against the pre-move tree, so relative imports in a
// file that itself moves still resolve. A specifier is rewritten only when the
// importer moved or its target moved — untouched pairs keep the exact text they
// had. Cross-layer results are emitted in alias form (`@domain/…`), everything
// else stays relative; `tools/` always gets relative specifiers.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const UI_ROOT = path.join(REPO_ROOT, 'ui');

// Top-level ui/ directory -> import alias. Directories missing from this table
// (shared/, types/, tracking/) are always relative.
const DIR_TO_ALIAS = {
	domain: '@domain',
	generated: '@generated',
	worker: '@worker',
	'ui-kit': '@ui-kit',
	features: '@features',
	app: '@app',
	sims: '@specs',
	i18n: '@i18n',
	core: '@core',
};
const ALIAS_TO_DIR = Object.fromEntries(Object.entries(DIR_TO_ALIAS).map(([dir, alias]) => [alias, dir]));

const CODE_EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'binary_dist', '.git', '.history', 'tmp']);
// Tried in order when a specifier carries no extension.
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

const toPosix = p => p.split(path.sep).join('/');
const rel = p => toPosix(path.relative(REPO_ROOT, p));

// ---------------------------------------------------------------- moves file

const parseMoves = text => {
	const trimmed = text.trim();
	if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
		const parsed = JSON.parse(trimmed);
		const list = Array.isArray(parsed) ? parsed : (parsed.moves ?? Object.entries(parsed).map(([from, to]) => ({ from, to })));
		return list.map(({ from, to }) => ({ from, to }));
	}
	return trimmed
		.split('\n')
		.map(line => line.replace(/#.*$/, '').trim())
		.filter(Boolean)
		.map(line => {
			const [from, to] = line.split('->').map(s => s.trim());
			if (!from || !to) throw new Error(`Bad move line: ${line}`);
			return { from, to };
		});
};

const walk = (dir, out = []) => {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else out.push(full);
	}
	return out;
};

// Expands directory moves and returns absolute old -> absolute new.
const buildMoveMap = pairs => {
	const map = new Map();
	for (const { from, to } of pairs) {
		const absFrom = path.resolve(REPO_ROOT, from);
		const absTo = path.resolve(REPO_ROOT, to);
		if (!fs.existsSync(absFrom)) throw new Error(`Move source does not exist: ${from}`);
		if (fs.statSync(absFrom).isDirectory()) {
			for (const file of walk(absFrom)) map.set(file, path.join(absTo, path.relative(absFrom, file)));
		} else {
			const dest = fs.existsSync(absTo) && fs.statSync(absTo).isDirectory() ? path.join(absTo, path.basename(absFrom)) : absTo;
			map.set(absFrom, dest);
		}
	}
	for (const [from, to] of map) {
		if (fs.existsSync(to) && !map.has(to)) throw new Error(`Move destination already exists: ${rel(to)} (from ${rel(from)})`);
	}
	return map;
};

// ------------------------------------------------------------- specifier work

const layerOf = absPath => {
	const r = path.relative(UI_ROOT, absPath);
	if (r.startsWith('..') || path.isAbsolute(r)) return null;
	return toPosix(r).split('/')[0];
};

// Absolute path a specifier points at, before resolution to a concrete file.
const specifierTarget = (spec, importerOldAbs) => {
	if (spec.startsWith('.')) return path.resolve(path.dirname(importerOldAbs), spec);
	const slash = spec.indexOf('/');
	const head = slash === -1 ? spec : spec.slice(0, slash);
	const dir = ALIAS_TO_DIR[head];
	if (!dir) return null;
	return slash === -1 ? path.join(UI_ROOT, dir) : path.join(UI_ROOT, dir, spec.slice(slash + 1));
};

// Resolves to { file, kind } where kind records how the specifier was written:
// 'exact' (extension present), 'implicit' (extension elided), 'dir' (directory
// index). The kind is reproduced on the way out so `.json` keeps its extension
// and `../player_specs` stays a directory import.
const resolveTarget = (base, exists) => {
	for (const suffix of RESOLVE_SUFFIXES) {
		const candidate = base + suffix;
		if (!exists(candidate)) continue;
		if (suffix === '') return { file: candidate, kind: 'exact' };
		if (suffix.startsWith('/index')) return { file: candidate, kind: 'dir' };
		return { file: candidate, kind: 'implicit' };
	}
	return null;
};

const emitSpecifier = (importerNewAbs, targetNewFile, kind) => {
	let target = targetNewFile;
	if (kind === 'dir') {
		const base = path.basename(targetNewFile);
		if (base === 'index.ts' || base === 'index.tsx' || base === 'index.js') target = path.dirname(targetNewFile);
		else target = targetNewFile.replace(/\.(ts|tsx|mts|mjs|js|jsx)$/, '');
	} else if (kind === 'implicit') {
		target = targetNewFile.replace(/\.(ts|tsx|mts|mjs|js|jsx)$/, '');
	}

	const importerLayer = layerOf(importerNewAbs);
	const targetLayer = layerOf(target);
	if (importerLayer && targetLayer && importerLayer !== targetLayer && DIR_TO_ALIAS[targetLayer]) {
		const inner = toPosix(path.relative(path.join(UI_ROOT, targetLayer), target));
		return inner ? `${DIR_TO_ALIAS[targetLayer]}/${inner}` : DIR_TO_ALIAS[targetLayer];
	}
	const relative = toPosix(path.relative(path.dirname(importerNewAbs), target));
	return relative.startsWith('.') ? relative : `./${relative}`;
};

// `from '…'`, `import('…')`, bare `import '…'`, `require('…')` — enough to cover
// static, re-export, dynamic and side-effect forms.
const SPECIFIER_PATTERNS = [
	/(\bfrom\s*)(['"])([^'"\n]+)\2/g,
	/(\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g,
	/(^[ \t]*import\s+)(['"])([^'"\n]+)\2/gm,
	/(\brequire\s*\(\s*)(['"])([^'"\n]+)\2/g,
];

const rewriteContent = (content, importerOldAbs, importerNewAbs, moveMap, exists, onRewrite) => {
	const edits = [];
	const seen = new Set();
	for (const pattern of SPECIFIER_PATTERNS) {
		pattern.lastIndex = 0;
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const specStart = match.index + match[1].length + 1;
			if (seen.has(specStart)) continue;
			const spec = match[3];
			const base = specifierTarget(spec, importerOldAbs);
			if (!base) continue;
			const resolved = resolveTarget(base, exists);
			if (!resolved) continue;
			const targetMoved = moveMap.has(resolved.file);
			if (!targetMoved && importerOldAbs === importerNewAbs) continue;
			const targetNewFile = moveMap.get(resolved.file) ?? resolved.file;
			const next = emitSpecifier(importerNewAbs, targetNewFile, resolved.kind);
			seen.add(specStart);
			if (next === spec) continue;
			edits.push({ start: specStart, end: specStart + spec.length, next });
			onRewrite?.(spec, next);
		}
	}
	if (!edits.length) return content;
	edits.sort((a, b) => a.start - b.start);
	let out = '';
	let cursor = 0;
	for (const edit of edits) {
		out += content.slice(cursor, edit.start) + edit.next;
		cursor = edit.end;
	}
	return out + content.slice(cursor);
};

// ------------------------------------------------------------------- scss

const SCSS_PATTERNS = [/(@(?:use|import|forward)\s+)(['"])([^'"\n]+)\2/g];

const scssReferencesMovedCode = (content, fileAbs, moveMap, exists) => {
	const hits = [];
	for (const pattern of SCSS_PATTERNS) {
		pattern.lastIndex = 0;
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const spec = match[3];
			if (!spec.startsWith('.')) continue;
			const base = path.resolve(path.dirname(fileAbs), spec);
			const resolved = resolveTarget(base, exists);
			if (resolved && moveMap.has(resolved.file)) hits.push(spec);
		}
	}
	return hits;
};

// ------------------------------------------------------------------- driver

const main = () => {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const verbose = args.includes('--verbose');
	const movesFile = args.find(a => !a.startsWith('--'));
	if (!movesFile) {
		console.error('usage: node tools/restructure/move.mjs <moves-file> [--dry-run] [--verbose]');
		process.exit(2);
	}

	const moveMap = buildMoveMap(parseMoves(fs.readFileSync(path.resolve(REPO_ROOT, movesFile), 'utf8')));

	// Resolution must see the pre-move tree even after the renames happen, so
	// snapshot every path that exists now and answer from the snapshot.
	const existingFiles = new Set();
	for (const dir of ['ui', 'tools']) {
		for (const file of walk(path.join(REPO_ROOT, dir))) existingFiles.add(file);
	}
	const exists = p => existingFiles.has(p);

	const sources = [...existingFiles].filter(f => CODE_EXTS.includes(path.extname(f))).sort();
	const scssFiles = [...existingFiles].filter(f => path.extname(f) === '.scss').sort();

	const rewrites = [];
	let specifierCount = 0;
	for (const oldAbs of sources) {
		const newAbs = moveMap.get(oldAbs) ?? oldAbs;
		const content = fs.readFileSync(oldAbs, 'utf8');
		let fileCount = 0;
		const next = rewriteContent(content, oldAbs, newAbs, moveMap, exists, (from, to) => {
			fileCount++;
			if (verbose) console.log(`    ${rel(newAbs)}: ${from} -> ${to}`);
		});
		if (next !== content) {
			rewrites.push({ path: newAbs, content: next, count: fileCount });
			specifierCount += fileCount;
		}
	}

	const scssHits = [];
	for (const file of scssFiles) {
		const hits = scssReferencesMovedCode(fs.readFileSync(file, 'utf8'), file, moveMap, exists);
		if (hits.length) scssHits.push({ file, hits });
	}

	console.log(`${dryRun ? '[dry-run] ' : ''}moves: ${moveMap.size} file(s)`);
	console.log(`${dryRun ? '[dry-run] ' : ''}import specifiers rewritten: ${specifierCount} in ${rewrites.length} file(s)`);
	if (scssHits.length) {
		console.log('scss references to moved code (update by hand):');
		for (const { file, hits } of scssHits) console.log(`  ${rel(file)}: ${hits.join(', ')}`);
	} else {
		console.log('scss references to moved code: none');
	}
	if (dryRun) {
		for (const [from, to] of moveMap) console.log(`  mv ${rel(from)} -> ${rel(to)}`);
		for (const { path: p, count } of rewrites) console.log(`  rewrite ${rel(p)} (${count})`);
		return;
	}

	const tracked = new Set(
		execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, maxBuffer: 1 << 28 })
			.toString()
			.split('\0')
			.filter(Boolean)
			.map(p => path.join(REPO_ROOT, p)),
	);

	const touchedDirs = new Set();
	for (const [from, to] of moveMap) {
		fs.mkdirSync(path.dirname(to), { recursive: true });
		if (tracked.has(from)) execFileSync('git', ['mv', rel(from), rel(to)], { cwd: REPO_ROOT });
		else fs.renameSync(from, to);
		touchedDirs.add(path.dirname(from));
	}
	for (const { path: p, content } of rewrites) fs.writeFileSync(p, content);

	// Drop directories the moves emptied out.
	for (const dir of [...touchedDirs].sort((a, b) => b.length - a.length)) {
		let current = dir;
		while (current.startsWith(UI_ROOT) && current !== UI_ROOT && fs.existsSync(current) && fs.readdirSync(current).length === 0) {
			fs.rmdirSync(current);
			current = path.dirname(current);
		}
	}
	console.log('done');
};

main();

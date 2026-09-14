#!/usr/bin/env node
// Finds Tailwind class tokens that are not written in their canonical form, using
// tailwindcss's own designSystem.canonicalizeCandidates() (the same API IntelliSense
// uses for "The class X can be written as Y").
//
// Usage:
//   node tools/tailwind/canonical-classes.mjs [--css <path>] [--write] [--json] [root]

import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import fs from 'node:fs';
import path from 'node:path';

const CLASS_ATTRS = [
	'className',
	'bodyClassName',
	'cellClassName',
	'clearClassName',
	'contentClassName',
	'iconClassName',
	'inputClassName',
	'labelClassName',
	'rowClassName',
	'selectClassName',
	'tabItemClassName',
	'triggerClassName',
];

function stripVariants(token) {
	const parts = token.replace(/^!/, '').split(':');
	return parts[parts.length - 1].replace(/!$/, '');
}

function classifyRewrite(from, to) {
	const bare = stripVariants(from);
	if (/^ease-\[/.test(bare)) return 'easing';
	if (/(^|:)(data|aria)-\[/.test(from)) return 'data-[x]→data-x';
	if (/\[-?[\d.]+px\]/.test(from)) return 'px→spacing step';
	if (/\[[^\]]+\]/.test(from)) return 'arbitrary→named';
	return 'other';
}

function findDefaultCss(root) {
	const style = path.join(root, 'ui/styles/style.css');
	const tailwind = path.join(root, 'ui/styles/tailwind.css');
	if (fs.existsSync(style)) return style;
	if (fs.existsSync(tailwind)) return tailwind;
	throw new Error('Could not find ui/styles/style.css or ui/styles/tailwind.css');
}

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

function lineAt(text, index) {
	let line = 1;
	for (let i = 0; i < index; i++) {
		if (text[i] === '\n') line++;
	}
	return line;
}

function splitClassString(str) {
	return str.split(/\s+/).filter(Boolean);
}

// Splits template-literal contents on ${...} interpolations, keeping only the static parts.
function staticPartsOfTemplate(raw) {
	const parts = [];
	let depth = 0;
	let cur = '';
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (ch === '$' && raw[i + 1] === '{') {
			parts.push(cur);
			cur = '';
			depth = 1;
			i++;
			while (i + 1 < raw.length && depth > 0) {
				i++;
				if (raw[i] === '{') depth++;
				else if (raw[i] === '}') depth--;
			}
			continue;
		}
		cur += ch;
	}
	parts.push(cur);
	return parts;
}

function isSpecsFile(relPath) {
	return relPath.startsWith('ui/specs/');
}

function isGeneratedFile(relPath) {
	return relPath.startsWith('ui/generated/') || relPath.endsWith('_auto_gen.ts');
}

// Collects {token, index} occurrences from TSX/TS source: className-style attributes,
// clsx(...) calls, and object properties named className / *ClassName / extraClassNames.
function collectFromScript(text, relPath) {
	const found = [];
	const skipDynamic = isSpecsFile(relPath);

	const attrPattern = new RegExp(`\\b(${CLASS_ATTRS.join('|')})\\s*=\\s*(\\{([^{}]|\\{[^{}]*\\})*\\}|"[^"]*"|'[^']*')`, 'g');
	let m;
	while ((m = attrPattern.exec(text))) {
		const raw = m[2];
		const index = m.index + m[0].indexOf(raw);
		if (raw.startsWith('"') || raw.startsWith("'")) {
			for (const token of splitClassString(raw.slice(1, -1))) found.push({ token, index });
			continue;
		}
		const inner = raw.slice(1, -1).trim();
		if (/^clsx\(/.test(inner)) continue; // handled by the clsx scanner below
		const strMatch = inner.match(/^(['"`])([\s\S]*)\1$/);
		if (strMatch) {
			const [, quote, body] = strMatch;
			if (quote === '`') {
				for (const part of staticPartsOfTemplate(body)) {
					for (const token of splitClassString(part)) found.push({ token, index });
				}
			} else {
				for (const token of splitClassString(body)) found.push({ token, index });
			}
		}
	}

	if (!isGeneratedFile(relPath) && !skipDynamic) {
		const clsxPattern = /\bclsx\(/g;
		while ((m = clsxPattern.exec(text))) {
			const argsStart = m.index + m[0].length;
			let depth = 1;
			let i = argsStart;
			while (i < text.length && depth > 0) {
				if (text[i] === '(') depth++;
				else if (text[i] === ')') depth--;
				i++;
			}
			const args = text.slice(argsStart, i - 1);
			collectStringLiteralsFrom(args, argsStart, found);
		}

		const propPattern = /\b(className|\w+ClassName|extraClassNames)\s*:\s*(\[[^\]]*\]|["'`][^"'`]*["'`])/g;
		while ((m = propPattern.exec(text))) {
			const raw = m[2];
			const index = m.index + m[0].indexOf(raw);
			if (raw.startsWith('[')) {
				collectStringLiteralsFrom(raw, index, found);
			} else {
				const body = raw.slice(1, -1);
				for (const token of splitClassString(body)) found.push({ token, index });
			}
		}
	}

	return found.map(({ token, index }) => ({ token, line: lineAt(text, index) }));
}

// Pulls plain string-literal and static template-literal tokens out of an arbitrary JS
// expression snippet (used for clsx(...) args and array literals). Skips identifiers,
// numbers and any template literal containing an interpolation as a whole class list --
// only the static text around ${...} is kept.
function collectStringLiteralsFrom(snippet, offset, found) {
	const strPattern = /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
	let m;
	while ((m = strPattern.exec(snippet))) {
		const [full, quote, body] = m;
		const index = offset + m.index;
		if (quote === '`') {
			for (const part of staticPartsOfTemplate(body)) {
				for (const token of splitClassString(part)) found.push({ token, index });
			}
		} else {
			for (const token of splitClassString(body)) found.push({ token, index });
		}
	}
}

function collectFromCss(text) {
	const found = [];
	const applyPattern = /@apply\s+([^;]+);/g;
	let m;
	while ((m = applyPattern.exec(text))) {
		const body = m[1];
		const index = m.index + m[0].indexOf(body);
		for (const token of splitClassString(body)) found.push({ token, index });
	}
	return found.map(({ token, index }) => ({ token, line: lineAt(text, index) }));
}

export function collectTokens(root) {
	const skipDirs = new Set([path.join(root, 'ui/generated'), path.join(root, 'node_modules')]);
	const scriptFiles = walk(path.join(root, 'ui'), ['.tsx', '.ts'], skipDirs);
	const cssFiles = walk(path.join(root, 'ui'), ['.css'], skipDirs);

	const occurrences = [];
	for (const file of scriptFiles) {
		const relPath = path.relative(root, file);
		if (isGeneratedFile(relPath)) continue;
		const text = fs.readFileSync(file, 'utf8');
		const onlyClassName = isSpecsFile(relPath);
		for (const { token, line } of collectFromScript(text, relPath)) {
			occurrences.push({ file: relPath, line, token, onlyClassNameSite: onlyClassName });
		}
	}
	for (const file of cssFiles) {
		const relPath = path.relative(root, file);
		const text = fs.readFileSync(file, 'utf8');
		for (const { token, line } of collectFromCss(text)) {
			occurrences.push({ file: relPath, line, token });
		}
	}
	return occurrences;
}

export async function findNonCanonical(root, opts = {}) {
	const cssPath = opts.css || findDefaultCss(root);
	const css = fs.readFileSync(cssPath, 'utf8');
	const designSystem = await __unstable__loadDesignSystem(css, { base: path.dirname(cssPath) });

	const occurrences = collectTokens(root);
	const results = [];
	for (const occ of occurrences) {
		const [canonical] = designSystem.canonicalizeCandidates([occ.token], { rem: 16 });
		if (!canonical) continue;
		if (canonical === occ.token) continue;
		results.push({ file: occ.file, line: occ.line, from: occ.token, to: canonical, kind: classifyRewrite(occ.token, canonical) });
	}
	results.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
	return results;
}

function applyWrite(root, results) {
	const byFile = new Map();
	for (const r of results) {
		if (!byFile.has(r.file)) byFile.set(r.file, []);
		byFile.get(r.file).push(r);
	}
	for (const [relFile, edits] of byFile) {
		const full = path.join(root, relFile);
		const lines = fs.readFileSync(full, 'utf8').split('\n');
		for (const edit of edits) {
			const idx = edit.line - 1;
			const lineText = lines[idx];
			const at = lineText.indexOf(edit.from);
			if (at === -1) continue;
			lines[idx] = lineText.slice(0, at) + edit.to + lineText.slice(at + edit.from.length);
		}
		fs.writeFileSync(full, lines.join('\n'));
	}
}

async function main() {
	const args = process.argv.slice(2);
	let cssArg;
	let write = false;
	let json = false;
	let root = process.cwd();
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--css') cssArg = args[++i];
		else if (args[i] === '--write') write = true;
		else if (args[i] === '--json') json = true;
		else root = path.resolve(args[i]);
	}

	const results = await findNonCanonical(root, { css: cssArg ? path.resolve(cssArg) : undefined });

	if (write) {
		applyWrite(root, results);
	}

	if (json) {
		console.log(JSON.stringify(results, null, 2));
	} else {
		const byKind = new Map();
		for (const r of results) {
			if (!byKind.has(r.kind)) byKind.set(r.kind, []);
			byKind.get(r.kind).push(r);
		}
		for (const [kind, rows] of byKind) {
			console.log(`\n${kind} (${rows.length})`);
			for (const r of rows) {
				console.log(`  ${r.file}:${r.line}  ${r.from} → ${r.to}`);
			}
		}
		console.log(`\nTotal: ${results.length}`);
	}

	if (results.length > 0 && !write) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

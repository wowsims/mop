#!/usr/bin/env node
// Finds Tailwind class tokens that are not written in their canonical form, using
// tailwindcss's own designSystem.canonicalizeCandidates() (the same API IntelliSense
// uses for "The class X can be written as Y").
//
// Usage:
//   node ui/testing/tailwind/canonical-classes.mjs [--css <path>] [--write] [--json] [root]

import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import fs from 'node:fs';
import path from 'node:path';

const CLASS_ATTR_RE = /\b([a-zA-Z]+ClassNames?)=/g;

// Both this module and class-hooks.mjs need the design system and the tree's token
// occurrences; a gate run loads both in the same process, so cache each by key instead of
// re-parsing the CSS or re-walking ui/ per call.
const designSystemCache = new Map();
export function loadDesignSystemCached(cssPath) {
	if (!designSystemCache.has(cssPath)) {
		const css = fs.readFileSync(cssPath, 'utf8');
		designSystemCache.set(cssPath, __unstable__loadDesignSystem(css, { base: path.dirname(cssPath) }));
	}
	return designSystemCache.get(cssPath);
}

const tokensCache = new Map();

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

export function findDefaultCss(root) {
	const style = path.join(root, 'ui/styles/style.css');
	if (fs.existsSync(style)) return style;
	throw new Error('Could not find ui/styles/style.css');
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

// Derives the JSX class-attribute name list from the tree itself, instead of a hardcoded
// list: any tight `wordClassName=`/`wordClassNames=` occurrence (JSX attributes and
// destructured prop defaults are written without spaces around `=`; a plain `const x = …`
// assignment has spaces and so is not matched), plus className itself.
// Tooltip/Popover pass a bare Tailwind class string through `width`/`maxWidth` props
// (see ui/ui-kit/Tooltip/Tooltip.tsx, ui/ui-kit/Popover/Popover.tsx); those names don't
// follow the `*ClassName(s)` convention CLASS_ATTR_RE derives, so they're listed explicitly.
const KNOWN_CLASS_PROPS = ['width', 'maxWidth'];

export function deriveClassAttrs(root) {
	const skipDirs = new Set([path.join(root, 'ui/generated'), path.join(root, 'node_modules')]);
	const scriptFiles = walk(path.join(root, 'ui'), ['.tsx', '.ts'], skipDirs);

	const attrs = new Set(['className', ...KNOWN_CLASS_PROPS]);
	for (const file of scriptFiles) {
		const relPath = path.relative(root, file);
		if (isGeneratedFile(relPath)) continue;
		const text = fs.readFileSync(file, 'utf8');
		let m;
		CLASS_ATTR_RE.lastIndex = 0;
		while ((m = CLASS_ATTR_RE.exec(text))) attrs.add(m[1]);
	}
	return [...attrs].sort();
}

// Collects {token, index} occurrences from TSX/TS source: className-style attributes,
// clsx(...) calls, object properties named className / *ClassName / extraClassNames, and
// *Class(es) declarations (see collectFromClassDecls).
function collectFromScript(text, relPath, classAttrs) {
	const found = [];
	const skipDynamic = isSpecsFile(relPath);

	const attrPattern = new RegExp(`\\b(${classAttrs.join('|')})\\s*=\\s*(\\{([^{}]|\\{[^{}]*\\})*\\}|"[^"]*"|'[^']*')`, 'g');
	let m;
	while ((m = attrPattern.exec(text))) {
		// A KNOWN_CLASS_PROPS name (width/maxWidth) also occurs as an ordinary destructured
		// parameter default (`{ ..., maxWidth = 'default', ... }`), which isn't a JSX attribute
		// at all; those are always preceded by `,` or `{`, which a real JSX attribute never is.
		if (KNOWN_CLASS_PROPS.includes(m[1])) {
			const before = text.slice(0, m.index).trimEnd();
			if (before.endsWith(',') || before.endsWith('{')) continue;
		}
		const raw = m[2];
		const index = m.index + m[0].indexOf(raw);
		if (raw.startsWith('"') || raw.startsWith("'")) {
			const body = raw.slice(1, -1);
			// `width` is also the native <img>/<video> pixel attribute (width="15"), which
			// isn't a Tailwind class at all; a plain integer is never a class token.
			if (KNOWN_CLASS_PROPS.includes(m[1]) && /^\d+$/.test(body)) continue;
			for (const token of splitClassString(body)) found.push({ token, index });
			continue;
		}
		const inner = raw.slice(1, -1).trim();
		if (/^clsx\(/.test(inner)) {
			// Outside ui/specs the clsx scanner below covers this; inside it that scanner is off,
			// so a className={clsx(...)} site would otherwise go unchecked entirely.
			if (skipDynamic) collectStringLiteralsFrom(raw, index, found);
			continue;
		}
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

		collectFromClassDecls(text, found);

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
		const before = snippet.slice(0, m.index);
		const after = snippet.slice(m.index + full.length);
		if (/(===|!==|==|!=)\s*$/.test(before)) continue; // comparison operand, not a rendered class
		if (/^\s*(===|!==|==|!=)/.test(after)) continue; // comparison operand, not a rendered class
		if (/^\s*\]/.test(after)) continue; // computed member/index literal, not a rendered class
		if (quote === '`') {
			for (const part of staticPartsOfTemplate(body)) {
				for (const token of splitClassString(part)) found.push({ token, index });
			}
		} else {
			for (const token of splitClassString(body)) found.push({ token, index });
		}
	}
}

// Collects string/template/object-literal tokens out of `const <name>Class(es) = …` and
// `const <NAME>_CLASSES = '…'` declarations (ROOT_CLASSES, tickClass, …): a widespread
// convention for module- or function-scoped Tailwind class strings that never reach a
// className attribute, a clsx() call, or a *ClassName object property directly. Deliberately
// limited to a plain string/template-literal RHS: a `{…}` object literal (e.g. WIDTH_CLASSES
// = { content: '', anchor: 'ui-menu-anchor-width' }) can't be told apart from an arbitrary,
// unrelated `*Class(es)`-named object or namespace (PlayerClasses, with methods and thrown
// errors) by name alone, and scanning its body wholesale pulls in every string literal in it.
function collectFromClassDecls(text, found) {
	const declPattern = /\b(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+)?=\s*/g;
	let m;
	while ((m = declPattern.exec(text))) {
		if (!/class(es)?$/i.test(m[1])) continue;
		const start = declPattern.lastIndex;
		const next = text[start];
		if (next !== "'" && next !== '"' && next !== '`') continue;
		let depth = 0;
		let i = start;
		for (; i < text.length; i++) {
			const ch = text[i];
			if (ch === '\\') {
				i++;
				continue;
			}
			if (ch === "'" || ch === '"' || ch === '`') {
				const quote = ch;
				i++;
				while (i < text.length && text[i] !== quote) {
					if (text[i] === '\\') i++;
					i++;
				}
				continue;
			}
			if (ch === '{' || ch === '[' || ch === '(') depth++;
			else if (ch === '}' || ch === ']' || ch === ')') depth--;
			else if (ch === ';' && depth <= 0) break;
		}
		collectStringLiteralsFrom(text.slice(start, i), start, found);
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
	if (tokensCache.has(root)) return tokensCache.get(root);

	const skipDirs = new Set([path.join(root, 'ui/generated'), path.join(root, 'node_modules')]);
	const scriptFiles = walk(path.join(root, 'ui'), ['.tsx', '.ts'], skipDirs);
	const cssFiles = walk(path.join(root, 'ui'), ['.css'], skipDirs);
	const classAttrs = deriveClassAttrs(root);

	const occurrences = [];
	for (const file of scriptFiles) {
		const relPath = path.relative(root, file);
		if (isGeneratedFile(relPath)) continue;
		const text = fs.readFileSync(file, 'utf8');
		for (const { token, line } of collectFromScript(text, relPath, classAttrs)) {
			occurrences.push({ file: relPath, line, token });
		}
	}
	for (const file of cssFiles) {
		const relPath = path.relative(root, file);
		const text = fs.readFileSync(file, 'utf8');
		for (const { token, line } of collectFromCss(text)) {
			occurrences.push({ file: relPath, line, token });
		}
	}
	tokensCache.set(root, occurrences);
	return occurrences;
}

export async function findNonCanonical(root, opts = {}) {
	const cssPath = opts.css || findDefaultCss(root);
	const designSystem = await loadDesignSystemCached(cssPath);

	const occurrences = collectTokens(root);
	// canonicalizeCandidates(candidates) drops an entry from its return array whenever two
	// distinct input candidates canonicalize to the same output (e.g. the already-canonical
	// 'data-popup-open:x' and the bracketed 'data-[popup-open]:x' elsewhere in the tree both
	// resolve to 'data-popup-open:x'), which silently shifts every later index in a shared
	// batch out of alignment with its input. So each unique token is canonicalized in its own
	// single-element call -- slower, but positionally safe regardless of what else is present.
	const uniqueTokens = [...new Set(occurrences.map(occ => occ.token))];
	const canonicalByToken = new Map();
	for (const token of uniqueTokens) {
		const [canonical] = designSystem.canonicalizeCandidates([token], { rem: 16 });
		canonicalByToken.set(token, canonical);
	}

	const results = [];
	for (const occ of occurrences) {
		const canonical = canonicalByToken.get(occ.token);
		if (!canonical) continue;
		if (canonical === occ.token) continue;
		results.push({ file: occ.file, line: occ.line, from: occ.token, to: canonical, kind: classifyRewrite(occ.token, canonical) });
	}
	results.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
	return results;
}

// A class token may never contain a literal var(...): a single var belongs in the util-(--x)
// paren shorthand, a compound of theme/runtime vars belongs in a named @theme inline token,
// and anything no utility can express belongs in a co-located ui-* class.
export function findVarInClass(root) {
	const occurrences = collectTokens(root);
	const results = occurrences.filter(occ => occ.token.includes('var(')).map(occ => ({ file: occ.file, line: occ.line, token: occ.token }));
	results.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
	return results;
}

// Edits are applied against the whole file text with a forward-only cursor, not per-line:
// a wrapped @apply/className spanning multiple lines can repeat the same "from" token more
// than once, and a line-scoped indexOf only ever finds the first occurrence.
function applyWrite(root, results) {
	const byFile = new Map();
	for (const r of results) {
		if (!byFile.has(r.file)) byFile.set(r.file, []);
		byFile.get(r.file).push(r);
	}
	for (const [relFile, edits] of byFile) {
		const full = path.join(root, relFile);
		let text = fs.readFileSync(full, 'utf8');
		let cursor = 0;
		for (const edit of edits) {
			let at = text.indexOf(edit.from, cursor);
			if (at === -1) at = text.indexOf(edit.from);
			if (at === -1) continue;
			text = text.slice(0, at) + edit.to + text.slice(at + edit.from.length);
			cursor = at + edit.to.length;
		}
		fs.writeFileSync(full, text);
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

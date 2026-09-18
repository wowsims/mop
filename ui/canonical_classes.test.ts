// @vitest-environment node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

// oxlint-disable-next-line import/extensions
import { findNonCanonical, findVarInClass } from './testing/tailwind/canonical-classes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function formatOffenders(rows: Awaited<ReturnType<typeof findNonCanonical>>): string {
	return rows.map(r => `${r.file}:${r.line} ${r.from} → ${r.to} -- run \`node ui/testing/tailwind/canonical-classes.mjs --write\``).join('\n');
}

function formatVarOffenders(rows: Array<{ file: string; line: number; token: string }>): string {
	return rows.map(r => `${r.file}:${r.line} ${r.token} -- use util-(--x), a named @theme inline token, or a ui-* class`).join('\n');
}

let offenders: Awaited<ReturnType<typeof findNonCanonical>>;
let varOffenders: ReturnType<typeof findVarInClass>;

beforeAll(async () => {
	offenders = await findNonCanonical(ROOT);
	varOffenders = findVarInClass(ROOT);
}, 40000);

describe('canonical Tailwind classes', () => {
	it('has no non-canonical Tailwind class tokens in ui/', () => {
		expect(offenders, formatOffenders(offenders)).toEqual([]);
	});

	it('has no var(...) inside a Tailwind class token in ui/', () => {
		expect(varOffenders, formatVarOffenders(varOffenders)).toEqual([]);
	});
});

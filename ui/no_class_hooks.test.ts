import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { findClassHooks, findTestidStyling } from '../tools/tailwind/class-hooks';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let hooks: Awaited<ReturnType<typeof findClassHooks>>;
let testidHits: ReturnType<typeof findTestidStyling>;
let retiredHits: { file: string; line: number; token: string }[];

beforeAll(async () => {
	hooks = await findClassHooks(ROOT);
	testidHits = findTestidStyling(ROOT);

	const retired: string[] = (await import('./retired_class_names.json', { with: { type: 'json' } })).default;
	const retiredSet = new Set(retired);
	const occurrences = (await import('../tools/tailwind/canonical-classes')).collectTokens(ROOT);
	retiredHits = occurrences.filter(occ => retiredSet.has(occ.token)).map(occ => ({ file: occ.file, line: occ.line, token: occ.token }));
}, 15000);

function formatHooks(rows: { file: string; line: number; token: string }[]): string {
	return rows.map(r => `${r.file}:${r.line} ${r.token} -- use a Tailwind utility, a ui-* class, data-testid, or a data-* state instead`).join('\n');
}

describe('class hooks', () => {
	it('has no class hooks in production ui/**/*.{ts,tsx}', () => {
		expect(hooks, formatHooks(hooks)).toEqual([]);
	});

	it('has no retired class names anywhere in ui/', () => {
		expect(retiredHits, formatHooks(retiredHits)).toEqual([]);
	});

	it('has no [data-testid] styling in css or tsx arbitrary variants', () => {
		const formatted = testidHits
			.map(h => `${h.file}:${h.line} ${h.match} -- style via a ui-* class, a prop/variant, or a real data-* state instead`)
			.join('\n');
		expect(testidHits, formatted).toEqual([]);
	});
});

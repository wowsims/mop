import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findNonCanonical } from '../tools/tailwind/canonical-classes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function formatOffenders(rows: Awaited<ReturnType<typeof findNonCanonical>>): string {
	return rows.map(r => `${r.file}:${r.line} ${r.from} → ${r.to} -- run \`node tools/tailwind/canonical-classes.mjs --write\``).join('\n');
}

describe('canonical Tailwind classes', () => {
	it('has no non-canonical Tailwind class tokens in ui/', async () => {
		const offenders = await findNonCanonical(ROOT);
		expect(offenders, formatOffenders(offenders)).toEqual([]);
	}, 15000);
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCES = ['value_kinds.ts', 'action_kinds.ts', 'field_descriptors.ts'];
const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

const bundle = (locale: string): unknown => JSON.parse(readFileSync(join(ROOT, 'assets', 'locales', locale, 'translation.json'), 'utf8'));

const resolve = (node: unknown, key: string): unknown =>
	key.split('.').reduce<unknown>((current, part) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined), node);

const requestedKeys = (): Array<string> => {
	const source = SOURCES.map(file => readFileSync(join(import.meta.dirname, file), 'utf8')).join('\n');
	return [...new Set([...source.matchAll(/i18n\.t\('([^']+)'/g)].map(match => match[1]))].sort();
};

describe('APL kind locale keys', () => {
	it('finds every requested key in both locales', () => {
		const en = bundle('en');
		const fr = bundle('fr');
		const unresolved = requestedKeys().filter(key => resolve(en, key) === undefined || resolve(fr, key) === undefined);

		expect(unresolved).toEqual([]);
	});

	it('requests a non-trivial number of keys, so a broken scan cannot pass', () => {
		expect(requestedKeys().length).toBeGreaterThan(300);
	});
});

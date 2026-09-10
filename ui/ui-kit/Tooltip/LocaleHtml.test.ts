import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = join(process.cwd(), 'assets/locales');
const HTML_TAG = /<[a-zA-Z/][^>]*>/;

// Keys that carry markup *and* interpolate. Every value spliced into these is a number the sim
// produced, so it cannot introduce markup. Anything else appearing here is a possible injection:
// i18next runs with `escapeValue: false`, so LocaleHtml would render the value as HTML.
const INTERPOLATING_HTML_KEYS = ['bulk_tab.progress.iterations_complete'];

const flatten = (value: unknown, path = ''): Array<[string, string]> =>
	typeof value === 'string'
		? [[path, value]]
		: value && typeof value === 'object'
			? Object.entries(value).flatMap(([key, child]) => flatten(child, path ? `${path}.${key}` : key))
			: [];

describe('locale markup', () => {
	const locales = readdirSync(LOCALES, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => entry.name);

	it.each(locales)('%s interpolates nothing into markup that is not already accounted for', locale => {
		const dir = join(LOCALES, locale);
		const offenders = readdirSync(dir)
			.filter(file => file.endsWith('.json'))
			.flatMap(file => flatten(JSON.parse(readFileSync(join(dir, file), 'utf-8'))))
			.filter(([, text]) => HTML_TAG.test(text) && text.includes('{{'))
			.map(([key]) => key)
			.filter(key => !INTERPOLATING_HTML_KEYS.includes(key));

		expect(offenders).toEqual([]);
	});
});

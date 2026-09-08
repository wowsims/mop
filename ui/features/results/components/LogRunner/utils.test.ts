import type { CombatLog } from '@sim/proto/combat_log';
import { describe, expect, it } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { EMPTY_SUGGESTIONS } from '../../view/log/search/indexes';
import { combinedLogText, keywordsOf, labelOf, selectedTargetNumber, sentenceCase, valueCandidates } from './utils';

const resultWith = (targets: number, selected: number) =>
	({
		result: {
			getTargets: (filter?: unknown) => Array.from({ length: filter ? selected : targets }, (_unused, index) => ({ index })),
		},
		filter: {},
	}) as unknown as SimResultData;

const logLine = (timestamp: number, raw: string) => ({ timestamp, raw }) as CombatLog;

describe('LogRunner utils', () => {
	describe('labelOf', () => {
		it('spells an outcome token the way the results line does', () => {
			expect(labelOf('outcome', 'critical-block')).toBe('Critical Block');
		});

		it('unhyphenates a type token and leaves everything else alone', () => {
			expect(labelOf('type', 'major-cooldown')).toBe('Major cooldown');
			expect(labelOf('spell', 'Mortal Strike')).toBe('Mortal Strike');
		});

		it('falls back to the raw value for an outcome it has no label for', () => {
			expect(labelOf('outcome', 'crush')).toBe('crush');
		});
	});

	it('sentence-cases without touching an empty string', () => {
		expect(sentenceCase('source')).toBe('Source');
		expect(sentenceCase('')).toBe('');
	});

	describe('keywordsOf', () => {
		it('splits on whitespace', () => {
			expect(keywordsOf('  mortal  strike ')).toEqual(['mortal', 'strike']);
		});

		it('keeps a quoted phrase whole, without its quotes', () => {
			expect(keywordsOf('"mortal strike" crit')).toEqual(['mortal strike', 'crit']);
		});

		it('is empty for an empty box', () => {
			expect(keywordsOf('')).toEqual([]);
		});
	});

	describe('selectedTargetNumber', () => {
		it('is null on a single-target encounter, where filtering by target is a no-op', () => {
			expect(selectedTargetNumber(resultWith(1, 1))).toBeNull();
		});

		it('is the 1-based target number when exactly one of several is selected', () => {
			expect(selectedTargetNumber(resultWith(3, 1))).toBe(1);
		});

		it('is null while more than one target is selected', () => {
			expect(selectedTargetNumber(resultWith(3, 2))).toBeNull();
		});
	});

	describe('valueCandidates', () => {
		it('offers every outcome the parser can emit', () => {
			expect(valueCandidates('outcome', EMPTY_SUGGESTIONS)).toContain('critical-block');
		});

		it('reads spells, units and schools off the index rather than a fixed list', () => {
			const suggestions = { ...EMPTY_SUGGESTIONS, spells: ['Cleave'], units: ['Target 1'], schools: ['Physical'] };
			expect(valueCandidates('spell', suggestions)).toEqual(['Cleave']);
			expect(valueCandidates('source', suggestions)).toEqual(['Target 1']);
			expect(valueCandidates('target', suggestions)).toEqual(['Target 1']);
			expect(valueCandidates('school', suggestions)).toEqual(['Physical']);
		});

		it('offers nothing for a field whose values are typed', () => {
			expect(valueCandidates('time', EMPTY_SUGGESTIONS)).toEqual([]);
			expect(valueCandidates('amount', EMPTY_SUGGESTIONS)).toEqual([]);
		});
	});

	// The export is the whole log, filters and all, with the timestamp re-attached in a stable format.
	it('joins every line with its own timestamp for the exporter', () => {
		expect(combinedLogText([logLine(1.5, '[1.50] First'), logLine(2, '[2.00] Second')])).toBe('00:01:500;First\n00:02:000;Second');
	});
});

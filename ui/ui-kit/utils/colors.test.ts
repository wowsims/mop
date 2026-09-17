import { describe, expect, it } from 'vitest';

import { CLASS_BG, CLASS_BORDER, CLASS_TEXT, DANGER_TEXT, FACTION_TEXT, QUALITY_TEXT, RESOURCE_TEXT, SPELL_SCHOOL_BG, SPELL_SCHOOL_TEXT } from './colors';

const allRecords = [CLASS_BG, CLASS_BORDER, CLASS_TEXT, FACTION_TEXT, QUALITY_TEXT, RESOURCE_TEXT, SPELL_SCHOOL_BG, SPELL_SCHOOL_TEXT];

describe('colors', () => {
	it('every value of every record is a non-empty string without interpolation', () => {
		for (const record of allRecords) {
			for (const value of Object.values(record)) {
				expect(typeof value).toBe('string');
				expect((value as string).length).toBeGreaterThan(0);
				expect(value).not.toContain('${');
			}
		}
	});

	it('has 8 single spell schools and 9 multi spell schools', () => {
		expect(Object.keys(SPELL_SCHOOL_TEXT)).toHaveLength(17);
		expect(Object.keys(SPELL_SCHOOL_BG)).toHaveLength(17);
	});

	it('has all 11 classes', () => {
		expect(Object.keys(CLASS_TEXT)).toHaveLength(11);
		expect(Object.keys(CLASS_BG)).toHaveLength(11);
		expect(Object.keys(CLASS_BORDER)).toHaveLength(11);
	});

	it('grades safe/warning/danger to match the current _global_old.scss rules', () => {
		expect(DANGER_TEXT.safe).toBe('text-success');
		expect(DANGER_TEXT.warning).toContain('text-damage-partial');
		expect(DANGER_TEXT.danger).toBe('text-danger');
	});
});

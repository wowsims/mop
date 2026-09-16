import { describe, expect, it } from 'vitest';

import { bonusStatClass, critCapClass } from './stat_display';

describe('bonusStatClass', () => {
	it('is neutral at zero and green above it', () => {
		expect(bonusStatClass(0)).toBe('text-white');
		expect(bonusStatClass(12)).toBe('text-success');
	});

	it('is red below zero', () => {
		expect(bonusStatClass(-12)).toBe('text-danger');
	});
});

describe('critCapClass', () => {
	it('reads the other way round: over the cap is bad', () => {
		expect(critCapClass(0)).toBe('text-white');
		expect(critCapClass(12)).toBe('text-danger');
		expect(critCapClass(-12)).toBe('text-success');
	});
});

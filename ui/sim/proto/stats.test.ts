import { PseudoStat } from '@generated/proto/common';
import { describe, expect, it, vi } from 'vitest';

// `stats.ts` only needs localization for display names, and `@i18n/localization` drags the whole
// i18next bootstrap in with it. Stubbing it keeps this file about the stat model.
vi.mock('@i18n/localization', () => ({
	translateStat: (stat: unknown) => String(stat),
	translatePseudoStat: (pseudoStat: unknown) => String(pseudoStat),
}));

import { UnitStat } from './stats';

describe('UnitStat.convertEpToRatingScale', () => {
	// Block has no rating representation in MoP, so convertRatingToPercent returns null for it.
	// convertEpToRatingScale declares `number` and asserted that null away with `!`, which only
	// blows up once a caller does arithmetic on it - the reforge soft-cap tooltip calls
	// .toFixed() on this value, so a spec listing such a stat in softCapBreakpoints would take
	// the sidebar down on hover. No MoP spec does today; this keeps it that way.
	it('falls back to the raw EP value when a stat has no percent conversion', () => {
		const unitStat = UnitStat.fromPseudoStat(PseudoStat.PseudoStatBlockPercent);
		expect(unitStat.convertRatingToPercent(1)).toBeNull();
		expect(unitStat.convertEpToRatingScale(12.5)).toBe(12.5);
		expect(() => unitStat.convertEpToRatingScale(0).toFixed(2)).not.toThrow();
	});
});

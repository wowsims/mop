import { PseudoStat, Stat } from '@generated/proto/common';

import * as Mechanics from '../constants/mechanics';
import { Stats } from '../proto_utils/stats';

// Melee hit + expertise "can't be dodged/parried" cap, used by the default `statCaps` of most
// melee DPS/tank specs. `expertiseCapPercent` is the expertise-side target (7.5% for DPS specs
// that only need to eliminate dodge, 15% for tank specs that also need to eliminate parry).
export const meleeHitExpertiseCaps = (expertiseCapPercent = 7.5): Stats => {
	const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, 7.5);
	const expCap = new Stats().withStat(Stat.StatExpertiseRating, expertiseCapPercent * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);

	return hitCap.add(expCap);
};

// Expertise-only cap (no melee hit), used by specs whose rotation doesn't care about avoiding
// misses but does care about avoiding dodges.
export const expertiseCap = (expertiseCapPercent = 7.5): Stats =>
	new Stats().withStat(Stat.StatExpertiseRating, expertiseCapPercent * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);

// Spell hit cap, used by the default `statCaps` of most caster specs.
export const spellHitCap = (spellHitCapPercent = 15): Stats => new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, spellHitCapPercent);

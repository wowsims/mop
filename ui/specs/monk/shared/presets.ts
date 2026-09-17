import { RaidBuffs } from '@generated/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@sim/proto/utils';

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	legacyOfTheEmperor: true,
	legacyOfTheWhiteTiger: true,
	darkIntent: true,
	trueshotAura: true,
	unleashedRage: true,
	moonkinAura: true,
	blessingOfMight: true,
	bloodlust: true,
});

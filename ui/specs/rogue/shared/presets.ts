import { RaidBuffs } from '@generated/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@sim/proto/utils';

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	blessingOfKings: true,
	trueshotAura: true,
	swiftbladesCunning: true,
	legacyOfTheWhiteTiger: true,
	blessingOfMight: true,
	bloodlust: true,
});

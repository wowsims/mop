import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';
import { RaidBuffs } from '@generated/proto/common';

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	blessingOfKings: true,
	trueshotAura: true,
	swiftbladesCunning: true,
	legacyOfTheWhiteTiger: true,
	blessingOfMight: true,
	bloodlust: true,
});

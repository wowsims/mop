import { RaidBuffs } from '@core/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	blessingOfKings: true,
	trueshotAura: true,
	swiftbladesCunning: true,
	legacyOfTheWhiteTiger: true,
	blessingOfMight: true,
	bloodlust: true,
});

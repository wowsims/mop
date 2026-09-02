import { RaidBuffs } from '@core/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

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

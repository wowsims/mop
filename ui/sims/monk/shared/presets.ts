import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';
import { RaidBuffs } from '@generated/proto/common';

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

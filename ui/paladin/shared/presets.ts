import { RaidBuffs } from '@core/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	arcaneBrilliance: true,
	blessingOfKings: true,
	blessingOfMight: true,
	bloodlust: true,
	elementalOath: true,
	powerWordFortitude: true,
	serpentsSwiftness: true,
	trueshotAura: true,
});

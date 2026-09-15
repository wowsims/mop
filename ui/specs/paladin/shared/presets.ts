import { RaidBuffs } from '@generated/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@sim/proto/utils';

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

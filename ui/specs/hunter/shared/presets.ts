import { RaidBuffs } from '@generated/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@sim/proto/utils';

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	blessingOfKings: true,
	trueshotAura: true,
	leaderOfThePack: true,
	blessingOfMight: true,
	commandingShout: true,
	unholyAura: true,
	bloodlust: true,
});

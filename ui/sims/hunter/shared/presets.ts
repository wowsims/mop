import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';
import { RaidBuffs } from '@generated/proto/common';

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

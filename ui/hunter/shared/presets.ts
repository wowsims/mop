import { RaidBuffs } from '@core/proto/common';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

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

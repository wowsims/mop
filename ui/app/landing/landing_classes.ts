import { Class } from '@generated/proto/common';
import { LaunchStatus } from '@sim/constants/other';
import type { PlayerClass } from '@sim/player/player_class';

export const LANDING_CLASS_ORDER: Class[] = [
	Class.ClassDeathKnight,
	Class.ClassPriest,
	Class.ClassDruid,
	Class.ClassRogue,
	Class.ClassHunter,
	Class.ClassShaman,
	Class.ClassMage,
	Class.ClassMonk,
	Class.ClassWarlock,
	Class.ClassPaladin,
	Class.ClassWarrior,
];

export const classLaunchStatus = (playerClass: PlayerClass<Class>): LaunchStatus => {
	const statuses = Object.values(playerClass.specs).map(spec => spec.launch.status);
	if (statuses.every(status => status === LaunchStatus.Launched)) return LaunchStatus.Launched;
	if (statuses.every(status => status === LaunchStatus.Unlaunched)) return LaunchStatus.Unlaunched;
	return LaunchStatus.Beta;
};

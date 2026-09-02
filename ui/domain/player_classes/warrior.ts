import { Class } from '@generated/proto/common';

import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { ArmsWarrior, FuryWarrior, ProtectionWarrior } from '../player_specs/warrior';
import { WarriorSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Warrior extends PlayerClass<Class.ClassWarrior> {
	static classID = Class.ClassWarrior as Class.ClassWarrior;
	static friendlyName = 'Warrior';
	static hexColor = '#c79c6e';
	static specs: Record<string, PlayerSpec<WarriorSpecs>> = {
		[ArmsWarrior.friendlyName]: ArmsWarrior,
		[FuryWarrior.friendlyName]: FuryWarrior,
		[ProtectionWarrior.friendlyName]: ProtectionWarrior,
	};
	static races = getClassRaces(Warrior.classID);
	static armorTypes = getClassArmorTypes(Warrior.classID);
	static weaponTypes = getClassWeaponTypes(Warrior.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Warrior.classID);

	readonly classID = Warrior.classID;
	readonly friendlyName = Warrior.name;
	readonly hexColor = Warrior.hexColor;
	readonly specs = Warrior.specs;
	readonly races = Warrior.races;
	readonly armorTypes = Warrior.armorTypes;
	readonly weaponTypes = Warrior.weaponTypes;
	readonly rangedWeaponTypes = Warrior.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_warrior.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Warrior.getIcon(size);
	};
}

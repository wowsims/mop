import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { AfflictionWarlock, DemonologyWarlock, DestructionWarlock } from '../player_specs/warlock';
import { Class } from '../proto/common';
import { WarlockSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Warlock extends PlayerClass<Class.ClassWarlock> {
	static classID = Class.ClassWarlock as Class.ClassWarlock;
	static friendlyName = 'Warlock';
	static hexColor = '#9482c9';
	static specs: Record<string, PlayerSpec<WarlockSpecs>> = {
		[AfflictionWarlock.friendlyName]: AfflictionWarlock,
		[DemonologyWarlock.friendlyName]: DemonologyWarlock,
		[DestructionWarlock.friendlyName]: DestructionWarlock,
	};
	static races = getClassRaces(Warlock.classID);
	static armorTypes = getClassArmorTypes(Warlock.classID);
	static weaponTypes = getClassWeaponTypes(Warlock.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Warlock.classID);

	readonly classID = Warlock.classID;
	readonly friendlyName = Warlock.name;
	readonly hexColor = Warlock.hexColor;
	readonly specs = Warlock.specs;
	readonly races = Warlock.races;
	readonly armorTypes = Warlock.armorTypes;
	readonly weaponTypes = Warlock.weaponTypes;
	readonly rangedWeaponTypes = Warlock.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_warlock.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Warlock.getIcon(size);
	};
}

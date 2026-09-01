import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { BeastMasteryHunter, MarksmanshipHunter, SurvivalHunter } from '../player_specs/hunter';
import { Class } from '../proto/common';
import { HunterSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Hunter extends PlayerClass<Class.ClassHunter> {
	static classID = Class.ClassHunter as Class.ClassHunter;
	static friendlyName = 'Hunter';
	static hexColor = '#abd473';
	static specs: Record<string, PlayerSpec<HunterSpecs>> = {
		[BeastMasteryHunter.friendlyName]: BeastMasteryHunter,
		[MarksmanshipHunter.friendlyName]: MarksmanshipHunter,
		[SurvivalHunter.friendlyName]: SurvivalHunter,
	};
	static races = getClassRaces(Hunter.classID);
	static armorTypes = getClassArmorTypes(Hunter.classID);
	static weaponTypes = getClassWeaponTypes(Hunter.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Hunter.classID);

	readonly classID = Hunter.classID;
	readonly friendlyName = Hunter.name;
	readonly hexColor = Hunter.hexColor;
	readonly specs = Hunter.specs;
	readonly races = Hunter.races;
	readonly armorTypes = Hunter.armorTypes;

	readonly weaponTypes = Hunter.weaponTypes;
	readonly rangedWeaponTypes = Hunter.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_hunter.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Hunter.getIcon(size);
	};
}

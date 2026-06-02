import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { DisciplinePriest, HolyPriest, ShadowPriest } from '../player_specs/priest';
import { Class } from '../proto/common';
import { PriestSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Priest extends PlayerClass<Class.ClassPriest> {
	static classID = Class.ClassPriest as Class.ClassPriest;
	static friendlyName = 'Priest';
	static hexColor = '#fff';
	static specs: Record<string, PlayerSpec<PriestSpecs>> = {
		[DisciplinePriest.friendlyName]: DisciplinePriest,
		[HolyPriest.friendlyName]: HolyPriest,
		[ShadowPriest.friendlyName]: ShadowPriest,
	};
	static races = getClassRaces(Priest.classID);
	static armorTypes = getClassArmorTypes(Priest.classID);
	static weaponTypes = getClassWeaponTypes(Priest.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Priest.classID);

	readonly classID = Priest.classID;
	readonly friendlyName = Priest.name;
	readonly hexColor = Priest.hexColor;
	readonly specs = Priest.specs;
	readonly races = Priest.races;
	readonly armorTypes = Priest.armorTypes;
	readonly weaponTypes = Priest.weaponTypes;
	readonly rangedWeaponTypes = Priest.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_priest.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Priest.getIcon(size);
	};
}

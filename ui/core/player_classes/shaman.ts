import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { ElementalShaman, EnhancementShaman, RestorationShaman } from '../player_specs/shaman';
import { Class } from '../proto/common';
import { ShamanSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Shaman extends PlayerClass<Class.ClassShaman> {
	static classID = Class.ClassShaman as Class.ClassShaman;
	static friendlyName = 'Shaman';
	static hexColor = '#2459ff';
	static specs: Record<string, PlayerSpec<ShamanSpecs>> = {
		[ElementalShaman.friendlyName]: ElementalShaman,
		[EnhancementShaman.friendlyName]: EnhancementShaman,
		[RestorationShaman.friendlyName]: RestorationShaman,
	};
	static races = getClassRaces(Shaman.classID);
	static armorTypes = getClassArmorTypes(Shaman.classID);
	static weaponTypes = getClassWeaponTypes(Shaman.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Shaman.classID);

	readonly classID = Shaman.classID;
	readonly friendlyName = Shaman.name;
	readonly hexColor = Shaman.hexColor;
	readonly specs = Shaman.specs;
	readonly races = Shaman.races;
	readonly armorTypes = Shaman.armorTypes;
	readonly weaponTypes = Shaman.weaponTypes;
	readonly rangedWeaponTypes = Shaman.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_shaman.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Shaman.getIcon(size);
	};
}

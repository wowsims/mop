import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { HolyPaladin, ProtectionPaladin, RetributionPaladin } from '../player_specs/paladin';
import { Class } from '../proto/common';
import { PaladinSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Paladin extends PlayerClass<Class.ClassPaladin> {
	static classID = Class.ClassPaladin as Class.ClassPaladin;
	static friendlyName = 'Paladin';
	static cssClass = 'paladin';
	static hexColor = '#f58cba';
	static specs: Record<string, PlayerSpec<PaladinSpecs>> = {
		[HolyPaladin.friendlyName]: HolyPaladin,
		[ProtectionPaladin.friendlyName]: ProtectionPaladin,
		[RetributionPaladin.friendlyName]: RetributionPaladin,
	};
	static races = getClassRaces(Paladin.classID);
	static armorTypes = getClassArmorTypes(Paladin.classID);
	static weaponTypes = getClassWeaponTypes(Paladin.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Paladin.classID);

	readonly classID = Paladin.classID;
	readonly friendlyName = Paladin.name;
	readonly cssClass = Paladin.cssClass;
	readonly hexColor = Paladin.hexColor;
	readonly specs = Paladin.specs;
	readonly races = Paladin.races;
	readonly armorTypes = Paladin.armorTypes;
	readonly weaponTypes = Paladin.weaponTypes;
	readonly rangedWeaponTypes = Paladin.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_paladin.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Paladin.getIcon(size);
	};
}

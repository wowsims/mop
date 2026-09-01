import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { ArcaneMage, FireMage, FrostMage } from '../player_specs/mage';
import { Class } from '../proto/common';
import { MageSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Mage extends PlayerClass<Class.ClassMage> {
	static classID = Class.ClassMage as Class.ClassMage;
	static friendlyName = 'Mage';
	static hexColor = '#69ccf0';
	static specs: Record<string, PlayerSpec<MageSpecs>> = {
		[ArcaneMage.friendlyName]: ArcaneMage,
		[FireMage.friendlyName]: FireMage,
		[FrostMage.friendlyName]: FrostMage,
	};
	static races = getClassRaces(Mage.classID);
	static armorTypes = getClassArmorTypes(Mage.classID);
	static weaponTypes = getClassWeaponTypes(Mage.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Mage.classID);

	readonly classID = Mage.classID;
	readonly friendlyName = Mage.name;
	readonly hexColor = Mage.hexColor;
	readonly specs = Mage.specs;
	readonly races = Mage.races;
	readonly armorTypes = Mage.armorTypes;
	readonly weaponTypes = Mage.weaponTypes;
	readonly rangedWeaponTypes = Mage.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_mage.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Mage.getIcon(size);
	};
}

import { Class } from '@generated/proto/common';

import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { BalanceDruid, FeralDruid, GuardianDruid, RestorationDruid } from '../player_specs/druid';
import type { DruidSpecs } from '../proto_utils/spec_types';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Druid extends PlayerClass<Class.ClassDruid> {
	static classID = Class.ClassDruid as Class.ClassDruid;
	static friendlyName = 'Druid';
	static hexColor = '#ff7d0a';
	static specs: Record<string, PlayerSpec<DruidSpecs>> = {
		[BalanceDruid.friendlyName]: BalanceDruid,
		[FeralDruid.friendlyName]: FeralDruid,
		[GuardianDruid.friendlyName]: GuardianDruid,
		[RestorationDruid.friendlyName]: RestorationDruid,
	};

	static races = getClassRaces(Druid.classID);
	static armorTypes = getClassArmorTypes(Druid.classID);
	static weaponTypes = getClassWeaponTypes(Druid.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Druid.classID);

	readonly classID = Druid.classID;
	readonly friendlyName = Druid.name;
	readonly hexColor = Druid.hexColor;
	readonly specs = Druid.specs;
	readonly races = Druid.races;
	readonly armorTypes = Druid.armorTypes;
	readonly weaponTypes = Druid.weaponTypes;
	readonly rangedWeaponTypes = Druid.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_druid.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Druid.getIcon(size);
	};
}

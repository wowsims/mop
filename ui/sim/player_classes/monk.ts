import { Class } from '@generated/proto/common';

import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { BrewmasterMonk, MistweaverMonk, WindwalkerMonk } from '../player_specs/monk';
import type { MonkSpecs } from '../proto_utils/spec_types';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Monk extends PlayerClass<Class.ClassMonk> {
	static classID = Class.ClassMonk as Class.ClassMonk;
	static friendlyName = 'Monk';
	static hexColor = '#00ff98';
	static specs: Record<string, PlayerSpec<MonkSpecs>> = {
		[BrewmasterMonk.friendlyName]: BrewmasterMonk,
		[MistweaverMonk.friendlyName]: MistweaverMonk,
		[WindwalkerMonk.friendlyName]: WindwalkerMonk,
	};
	static races = getClassRaces(Monk.classID);
	static armorTypes = getClassArmorTypes(Monk.classID);
	static weaponTypes = getClassWeaponTypes(Monk.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Monk.classID);

	readonly classID = Monk.classID;
	readonly friendlyName = Monk.name;
	readonly hexColor = Monk.hexColor;
	readonly specs = Monk.specs;
	readonly races = Monk.races;
	readonly armorTypes = Monk.armorTypes;
	readonly weaponTypes = Monk.weaponTypes;
	readonly rangedWeaponTypes = Monk.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_monk.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Monk.getIcon(size);
	};
}

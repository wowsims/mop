import { Class } from '@core/proto/common';

import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { BloodDeathKnight, FrostDeathKnight, UnholyDeathKnight } from '../player_specs/death_knight';
import { DeathKnightSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class DeathKnight extends PlayerClass<Class.ClassDeathKnight> {
	static classID = Class.ClassDeathKnight as Class.ClassDeathKnight;
	static friendlyName = 'Death Knight';
	static hexColor = '#c41e3a';
	static specs: Record<string, PlayerSpec<DeathKnightSpecs>> = {
		[BloodDeathKnight.friendlyName]: BloodDeathKnight,
		[FrostDeathKnight.friendlyName]: FrostDeathKnight,
		[UnholyDeathKnight.friendlyName]: UnholyDeathKnight,
	};
	static races = getClassRaces(DeathKnight.classID);
	static armorTypes = getClassArmorTypes(DeathKnight.classID);
	static weaponTypes = getClassWeaponTypes(DeathKnight.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(DeathKnight.classID);

	readonly classID = DeathKnight.classID;
	readonly friendlyName = DeathKnight.name;
	readonly hexColor = DeathKnight.hexColor;
	readonly specs = DeathKnight.specs;
	readonly races = DeathKnight.races;
	readonly armorTypes = DeathKnight.armorTypes;
	readonly weaponTypes = DeathKnight.weaponTypes;
	readonly rangedWeaponTypes = DeathKnight.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_deathknight.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return DeathKnight.getIcon(size);
	};
}

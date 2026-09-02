import { Class } from '@generated/proto/common';

import { IconSize, PlayerClass } from '../player_class';
import { PlayerSpec } from '../player_spec';
import { AssassinationRogue, CombatRogue, SubtletyRogue } from '../player_specs/rogue';
import { RogueSpecs } from '../proto_utils/utils';
import { getClassArmorTypes, getClassRaces, getClassRangedWeaponTypes, getClassWeaponTypes } from './capabilities';

export class Rogue extends PlayerClass<Class.ClassRogue> {
	static classID = Class.ClassRogue as Class.ClassRogue;
	static friendlyName = 'Rogue';
	static hexColor = '#fff569';
	static specs: Record<string, PlayerSpec<RogueSpecs>> = {
		[AssassinationRogue.friendlyName]: AssassinationRogue,
		[CombatRogue.friendlyName]: CombatRogue,
		[SubtletyRogue.friendlyName]: SubtletyRogue,
	};
	static races = getClassRaces(Rogue.classID);
	static armorTypes = getClassArmorTypes(Rogue.classID);
	static weaponTypes = getClassWeaponTypes(Rogue.classID);
	static rangedWeaponTypes = getClassRangedWeaponTypes(Rogue.classID);

	readonly classID = Rogue.classID;
	readonly friendlyName = Rogue.name;
	readonly hexColor = Rogue.hexColor;
	readonly specs = Rogue.specs;
	readonly races = Rogue.races;
	readonly armorTypes = Rogue.armorTypes;
	readonly weaponTypes = Rogue.weaponTypes;
	readonly rangedWeaponTypes = Rogue.rangedWeaponTypes;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/class_rogue.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return Rogue.getIcon(size);
	};
}

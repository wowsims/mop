import { ArmorType, Class, Race, RangedWeaponType, Spec } from '@core/proto/common';

import type { EligibleWeaponType } from '../player_class';
import { CLASS_ARMOR_TYPES, CLASS_RACES, CLASS_RANGED_WEAPON_TYPES, CLASS_WEAPON_TYPES, SPEC_CAN_DUAL_WIELD, SPEC_CAN_DUAL_WIELD_2H } from './capabilities_auto_gen';

const classArmorTypes = new Map<Class, ArmorType[]>(
	Object.entries(CLASS_ARMOR_TYPES).map(([classID, armorTypes]) => [Number(classID) as Class, armorTypes]),
);

const classWeaponTypes = new Map<Class, EligibleWeaponType[]>(
	Object.entries(CLASS_WEAPON_TYPES).map(([classID, weaponTypes]) => [
		Number(classID) as Class,
		weaponTypes.map(weaponType => ({
			weaponType: weaponType.weaponType,
			canUseTwoHand: weaponType.canUseTwoHand,
		})),
	]),
);

const classRangedWeaponTypes = new Map<Class, RangedWeaponType[]>(
	Object.entries(CLASS_RANGED_WEAPON_TYPES).map(([classID, rangedWeaponTypes]) => [Number(classID) as Class, rangedWeaponTypes]),
);

const classRaces = new Map<Class, Race[]>(Object.entries(CLASS_RACES).map(([classID, races]) => [Number(classID) as Class, races]));

const dualWieldSpecs = SPEC_CAN_DUAL_WIELD;

export const getClassArmorTypes = (classID: Class): ArmorType[] => classArmorTypes.get(classID) ?? [];

export const getClassWeaponTypes = (classID: Class): EligibleWeaponType[] => classWeaponTypes.get(classID) ?? [];

export const getClassRangedWeaponTypes = (classID: Class): RangedWeaponType[] => classRangedWeaponTypes.get(classID) ?? [];

export const getClassRaces = (classID: Class): Race[] => classRaces.get(classID) ?? [];

export const isSpecDualWieldCapable = (spec: Spec): boolean => dualWieldSpecs.has(spec);

export const isSpecDualWield2HCapable = (spec: Spec): boolean => SPEC_CAN_DUAL_WIELD_2H.has(spec);

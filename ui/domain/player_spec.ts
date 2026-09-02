import { ArmorType, Class, Race, RangedWeaponType, Spec } from '@core/proto/common';

import { LaunchStatus, Phase } from './constants/other';
import { EligibleWeaponType, IconSize } from './player_class';
import { SpecClasses } from './proto_utils/utils';

export type SimStatus = {
	phase: Phase;
	status: LaunchStatus;
};

export abstract class PlayerSpec<SpecType extends Spec> {
	static specID: Spec;
	static classID: Class;
	static friendlyName: string;
	static hexColor: string;
	static races: Race[] = [];
	static armorTypes: ArmorType[] = [];
	static weaponTypes: EligibleWeaponType[];
	static rangedWeaponTypes: RangedWeaponType[];
	static launch: SimStatus;

	abstract readonly specIndex: number;
	abstract readonly specID: SpecType;
	abstract readonly classID: SpecClasses<SpecType>;
	abstract readonly friendlyName: string;
	// Root-relative path of this spec's sim page (see getSpecSitePath).
	abstract readonly simLink: string;
	// Launch phase/status shown in the sim dropdown and on the landing page.
	abstract readonly launch: SimStatus;

	abstract readonly isTankSpec: boolean;
	abstract readonly isHealingSpec: boolean;
	abstract readonly isRangedDpsSpec: boolean;
	abstract readonly isMeleeDpsSpec: boolean;

	abstract readonly canDualWield: boolean;

	abstract getIcon(size: IconSize): string;
}

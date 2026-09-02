import { Class, Spec } from '@core/proto/common';

import { getSpecSitePath, LaunchStatus, Phase } from '../constants/other';
import { IconSize } from '../player_class';
import { PlayerSpec, SimStatus } from '../player_spec';

export class AfflictionWarlock extends PlayerSpec<Spec.SpecAfflictionWarlock> {
	static specIndex = 0;
	static specID = Spec.SpecAfflictionWarlock as Spec.SpecAfflictionWarlock;
	static classID = Class.ClassWarlock as Class.ClassWarlock;
	static friendlyName = 'Affliction';
	static simLink = getSpecSitePath('warlock', 'affliction');

	static isTankSpec = false;
	static isHealingSpec = false;
	static isRangedDpsSpec = true;
	static isMeleeDpsSpec = false;

	static canDualWield = false;

	static launch: SimStatus = {
		phase: Phase.Phase5,
		status: LaunchStatus.Launched,
	};

	readonly specIndex = AfflictionWarlock.specIndex;
	readonly specID = AfflictionWarlock.specID;
	readonly classID = AfflictionWarlock.classID;
	readonly friendlyName = AfflictionWarlock.friendlyName;
	readonly simLink = AfflictionWarlock.simLink;

	readonly isTankSpec = AfflictionWarlock.isTankSpec;
	readonly isHealingSpec = AfflictionWarlock.isHealingSpec;
	readonly isRangedDpsSpec = AfflictionWarlock.isRangedDpsSpec;
	readonly isMeleeDpsSpec = AfflictionWarlock.isMeleeDpsSpec;

	readonly canDualWield = AfflictionWarlock.canDualWield;

	readonly launch = AfflictionWarlock.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_shadow_deathcoil.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return AfflictionWarlock.getIcon(size);
	};
}

export class DemonologyWarlock extends PlayerSpec<Spec.SpecDemonologyWarlock> {
	static specIndex = 1;
	static specID = Spec.SpecDemonologyWarlock as Spec.SpecDemonologyWarlock;
	static classID = Class.ClassWarlock as Class.ClassWarlock;
	static friendlyName = 'Demonology';
	static simLink = getSpecSitePath('warlock', 'demonology');

	static isTankSpec = false;
	static isHealingSpec = false;
	static isRangedDpsSpec = true;
	static isMeleeDpsSpec = false;

	static canDualWield = false;

	static launch: SimStatus = {
		phase: Phase.Phase5,
		status: LaunchStatus.Launched,
	};

	readonly specIndex = DemonologyWarlock.specIndex;
	readonly specID = DemonologyWarlock.specID;
	readonly classID = DemonologyWarlock.classID;
	readonly friendlyName = DemonologyWarlock.friendlyName;
	readonly simLink = DemonologyWarlock.simLink;

	readonly isTankSpec = DemonologyWarlock.isTankSpec;
	readonly isHealingSpec = DemonologyWarlock.isHealingSpec;
	readonly isRangedDpsSpec = DemonologyWarlock.isRangedDpsSpec;
	readonly isMeleeDpsSpec = DemonologyWarlock.isMeleeDpsSpec;

	readonly canDualWield = DemonologyWarlock.canDualWield;

	readonly launch = DemonologyWarlock.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_shadow_metamorphosis.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return DemonologyWarlock.getIcon(size);
	};
}

export class DestructionWarlock extends PlayerSpec<Spec.SpecDestructionWarlock> {
	static specIndex = 2;
	static specID = Spec.SpecDestructionWarlock as Spec.SpecDestructionWarlock;
	static classID = Class.ClassWarlock as Class.ClassWarlock;
	static friendlyName = 'Destruction';
	static simLink = getSpecSitePath('warlock', 'destruction');

	static isTankSpec = false;
	static isHealingSpec = false;
	static isRangedDpsSpec = true;
	static isMeleeDpsSpec = false;

	static canDualWield = false;

	static launch: SimStatus = {
		phase: Phase.Phase5,
		status: LaunchStatus.Launched,
	};

	readonly specIndex = DestructionWarlock.specIndex;
	readonly specID = DestructionWarlock.specID;
	readonly classID = DestructionWarlock.classID;
	readonly friendlyName = DestructionWarlock.friendlyName;
	readonly simLink = DestructionWarlock.simLink;

	readonly isTankSpec = DestructionWarlock.isTankSpec;
	readonly isHealingSpec = DestructionWarlock.isHealingSpec;
	readonly isRangedDpsSpec = DestructionWarlock.isRangedDpsSpec;
	readonly isMeleeDpsSpec = DestructionWarlock.isMeleeDpsSpec;

	readonly canDualWield = DestructionWarlock.canDualWield;

	readonly launch = DestructionWarlock.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_shadow_rainoffire.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return DestructionWarlock.getIcon(size);
	};
}

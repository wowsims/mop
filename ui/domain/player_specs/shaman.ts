import { Class, Spec } from '@core/proto/common';

import { getSpecSitePath, LaunchStatus, Phase } from '../constants/other';
import { IconSize } from '../player_class';
import { PlayerSpec, SimStatus } from '../player_spec';

export class ElementalShaman extends PlayerSpec<Spec.SpecElementalShaman> {
	static specIndex = 0;
	static specID = Spec.SpecElementalShaman as Spec.SpecElementalShaman;
	static classID = Class.ClassShaman as Class.ClassShaman;
	static friendlyName = 'Elemental';
	static simLink = getSpecSitePath('shaman', 'elemental');

	static isTankSpec = false;
	static isHealingSpec = false;
	static isRangedDpsSpec = true;
	static isMeleeDpsSpec = false;

	static canDualWield = false;

	static launch: SimStatus = {
		phase: Phase.Phase5,
		status: LaunchStatus.Launched,
	};

	readonly specIndex = ElementalShaman.specIndex;
	readonly specID = ElementalShaman.specID;
	readonly classID = ElementalShaman.classID;
	readonly friendlyName = ElementalShaman.friendlyName;
	readonly simLink = ElementalShaman.simLink;

	readonly isTankSpec = ElementalShaman.isTankSpec;
	readonly isHealingSpec = ElementalShaman.isHealingSpec;
	readonly isRangedDpsSpec = ElementalShaman.isRangedDpsSpec;
	readonly isMeleeDpsSpec = ElementalShaman.isMeleeDpsSpec;

	readonly canDualWield = ElementalShaman.canDualWield;

	readonly launch = ElementalShaman.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_nature_lightning.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return ElementalShaman.getIcon(size);
	};
}

export class EnhancementShaman extends PlayerSpec<Spec.SpecEnhancementShaman> {
	static specIndex = 1;
	static specID = Spec.SpecEnhancementShaman as Spec.SpecEnhancementShaman;
	static classID = Class.ClassShaman as Class.ClassShaman;
	static friendlyName = 'Enhancement';
	static simLink = getSpecSitePath('shaman', 'enhancement');

	static isTankSpec = false;
	static isHealingSpec = false;
	static isRangedDpsSpec = false;
	static isMeleeDpsSpec = true;

	static canDualWield = true;

	static launch: SimStatus = {
		phase: Phase.Phase5,
		status: LaunchStatus.Launched,
	};

	readonly specIndex = EnhancementShaman.specIndex;
	readonly specID = EnhancementShaman.specID;
	readonly classID = EnhancementShaman.classID;
	readonly friendlyName = EnhancementShaman.friendlyName;
	readonly simLink = EnhancementShaman.simLink;

	readonly isTankSpec = EnhancementShaman.isTankSpec;
	readonly isHealingSpec = EnhancementShaman.isHealingSpec;
	readonly isRangedDpsSpec = EnhancementShaman.isRangedDpsSpec;
	readonly isMeleeDpsSpec = EnhancementShaman.isMeleeDpsSpec;

	readonly canDualWield = EnhancementShaman.canDualWield;

	readonly launch = EnhancementShaman.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_nature_lightningshield.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return EnhancementShaman.getIcon(size);
	};
}

export class RestorationShaman extends PlayerSpec<Spec.SpecRestorationShaman> {
	static specIndex = 2;
	static specID = Spec.SpecRestorationShaman as Spec.SpecRestorationShaman;
	static classID = Class.ClassShaman as Class.ClassShaman;
	static friendlyName = 'Restoration';
	static simLink = getSpecSitePath('shaman', 'restoration');

	static isTankSpec = false;
	static isHealingSpec = true;
	static isRangedDpsSpec = false;
	static isMeleeDpsSpec = false;

	static canDualWield = false;

	static launch: SimStatus = {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	};

	readonly specIndex = RestorationShaman.specIndex;
	readonly specID = RestorationShaman.specID;
	readonly classID = RestorationShaman.classID;
	readonly friendlyName = RestorationShaman.friendlyName;
	readonly simLink = RestorationShaman.simLink;

	readonly isTankSpec = RestorationShaman.isTankSpec;
	readonly isHealingSpec = RestorationShaman.isHealingSpec;
	readonly isRangedDpsSpec = RestorationShaman.isRangedDpsSpec;
	readonly isMeleeDpsSpec = RestorationShaman.isMeleeDpsSpec;

	readonly canDualWield = RestorationShaman.canDualWield;

	readonly launch = RestorationShaman.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_nature_magicimmunity.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return RestorationShaman.getIcon(size);
	};
}

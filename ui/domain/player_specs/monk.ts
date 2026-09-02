import { Class, Spec } from '@generated/proto/common';

import { getSpecSitePath, LaunchStatus, Phase } from '../constants/other';
import { IconSize } from '../player_class';
import { PlayerSpec, SimStatus } from '../player_spec';

export class BrewmasterMonk extends PlayerSpec<Spec.SpecBrewmasterMonk> {
	static specIndex = 0;
	static specID = Spec.SpecBrewmasterMonk as Spec.SpecBrewmasterMonk;
	static classID = Class.ClassMonk as Class.ClassMonk;
	static friendlyName = 'Brewmaster';
	static simLink = getSpecSitePath('monk', 'brewmaster');

	static isTankSpec = true;
	static isHealingSpec = false;
	static isRangedDpsSpec = false;
	static isMeleeDpsSpec = false;

	static canDualWield = true;

	static launch: SimStatus = {
		phase: Phase.Phase5,
		status: LaunchStatus.Launched,
	};

	readonly specIndex = BrewmasterMonk.specIndex;
	readonly specID = BrewmasterMonk.specID;
	readonly classID = BrewmasterMonk.classID;
	readonly friendlyName = BrewmasterMonk.friendlyName;
	readonly simLink = BrewmasterMonk.simLink;

	readonly isTankSpec = BrewmasterMonk.isTankSpec;
	readonly isHealingSpec = BrewmasterMonk.isHealingSpec;
	readonly isRangedDpsSpec = BrewmasterMonk.isRangedDpsSpec;
	readonly isMeleeDpsSpec = BrewmasterMonk.isMeleeDpsSpec;

	readonly canDualWield = BrewmasterMonk.canDualWield;

	readonly launch = BrewmasterMonk.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_monk_brewmaster_spec.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return BrewmasterMonk.getIcon(size);
	};
}

export class MistweaverMonk extends PlayerSpec<Spec.SpecMistweaverMonk> {
	static specIndex = 1;
	static specID = Spec.SpecMistweaverMonk as Spec.SpecMistweaverMonk;
	static classID = Class.ClassMonk as Class.ClassMonk;
	static friendlyName = 'Mistweaver';
	static simLink = getSpecSitePath('monk', 'mistweaver');

	static isTankSpec = false;
	static isHealingSpec = true;
	static isRangedDpsSpec = false;
	static isMeleeDpsSpec = false;

	static canDualWield = false;

	static launch: SimStatus = {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	};

	readonly specIndex = MistweaverMonk.specIndex;
	readonly specID = MistweaverMonk.specID;
	readonly classID = MistweaverMonk.classID;
	readonly friendlyName = MistweaverMonk.friendlyName;
	readonly simLink = MistweaverMonk.simLink;

	readonly isTankSpec = MistweaverMonk.isTankSpec;
	readonly isHealingSpec = MistweaverMonk.isHealingSpec;
	readonly isRangedDpsSpec = MistweaverMonk.isRangedDpsSpec;
	readonly isMeleeDpsSpec = MistweaverMonk.isMeleeDpsSpec;

	readonly canDualWield = MistweaverMonk.canDualWield;

	readonly launch = MistweaverMonk.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_monk_mistweaver_spec.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return MistweaverMonk.getIcon(size);
	};
}

export class WindwalkerMonk extends PlayerSpec<Spec.SpecWindwalkerMonk> {
	static specIndex = 2;
	static specID = Spec.SpecWindwalkerMonk as Spec.SpecWindwalkerMonk;
	static classID = Class.ClassMonk as Class.ClassMonk;
	static friendlyName = 'Windwalker';
	static simLink = getSpecSitePath('monk', 'windwalker');

	static isTankSpec = false;
	static isHealingSpec = false;
	static isRangedDpsSpec = false;
	static isMeleeDpsSpec = true;

	static canDualWield = true;

	static launch: SimStatus = {
		phase: Phase.Phase5,
		status: LaunchStatus.Launched,
	};

	readonly specIndex = WindwalkerMonk.specIndex;
	readonly specID = WindwalkerMonk.specID;
	readonly classID = WindwalkerMonk.classID;
	readonly friendlyName = WindwalkerMonk.friendlyName;
	readonly simLink = WindwalkerMonk.simLink;

	readonly isTankSpec = WindwalkerMonk.isTankSpec;
	readonly isHealingSpec = WindwalkerMonk.isHealingSpec;
	readonly isRangedDpsSpec = WindwalkerMonk.isRangedDpsSpec;
	readonly isMeleeDpsSpec = WindwalkerMonk.isMeleeDpsSpec;

	readonly canDualWield = WindwalkerMonk.canDualWield;

	readonly launch = WindwalkerMonk.launch;

	static getIcon = (size: IconSize): string => {
		return `https://wow.zamimg.com/images/wow/icons/${size}/spell_monk_windwalker_spec.jpg`;
	};

	getIcon = (size: IconSize): string => {
		return WindwalkerMonk.getIcon(size);
	};
}

import { IndividualLinkImporter } from './components/individual_sim_ui/importers';
import Toast, { ToastOptions } from './components/toast';
import * as Tooltips from './constants/tooltips.js';
import { Encounter } from './encounter';
import { Player } from './player';
import { Player as PlayerProto } from './proto/api.js';
import { APLRotation, APLRotation_Type as APLRotationType } from './proto/apl';
import {
	ConsumesSpec,
	Cooldowns,
	Debuffs,
	Encounter as EncounterProto,
	EquipmentSpec,
	Faction,
	HealingModel,
	IndividualBuffs,
	ItemSwap,
	PartyBuffs,
	Profession,
	Race,
	RaidBuffs,
	Spec,
	UnitReference,
} from './proto/common';
import { IndividualSimSettings, SavedRotation, SavedTalents } from './proto/ui';
import { Stats } from './proto_utils/stats';
import { SpecOptions, SpecRotation, specTypeFunctions } from './proto_utils/utils';

interface PresetBase {
	name: string;
	tooltip?: string;
	enableWhen?: (obj: Player<any>) => boolean;
	onLoad?: (player: Player<any>) => void;
}

interface PresetOptionsBase extends Pick<PresetBase, 'onLoad'> {
	customCondition?: (player: Player<any>) => boolean;
}

export interface PresetGear extends PresetBase {
	gear: EquipmentSpec;
}
export interface PresetGearOptions extends PresetOptionsBase, Pick<PresetBase, 'tooltip'> {
	faction?: Faction;
}

export interface PresetTalents {
	name: string;
	data: SavedTalents;
	enableWhen?: (obj: Player<any>) => boolean;
}

export interface PresetTalentsOptions {
	customCondition?: (player: Player<any>) => boolean;
}

export interface PresetRotation extends PresetBase {
	rotation: SavedRotation;
}
export interface PresetRotationOptions extends Pick<PresetOptionsBase, 'onLoad'> {
	talents?: number[];
}

export interface PresetEpWeights extends PresetBase {
	epWeights: Stats;
}
export interface PresetEpWeightsOptions extends PresetOptionsBase {}

export interface PresetItemSwap extends PresetBase {
	itemSwap: ItemSwap;
}

export interface PresetEncounter extends PresetBase {
	encounter?: EncounterProto;
	healingModel?: HealingModel;
	tanks?: UnitReference[];
	targetDummies?: number;
}
export interface PresetEncounterOptions extends PresetOptionsBase {}

type PresetPlayerOptions = Partial<Pick<PlayerProto, 'distanceFromTarget' | 'profession1' | 'profession2' | 'enableItemSwap' | 'itemSwap'>>;

export interface PresetSettings extends PresetBase {
	race?: Race;
	raidBuffs?: RaidBuffs;
	partyBuffs?: PartyBuffs;
	buffs?: IndividualBuffs;
	debuffs?: Debuffs;
	consumables?: ConsumesSpec;
	specOptions?: Partial<SpecOptions<any>>;
	playerOptions?: PresetPlayerOptions;
}

export interface PresetBuild {
	name: string;
	gear?: PresetGear;
	itemSwap?: PresetItemSwap;
	talents?: PresetTalents;
	rotation?: PresetRotation;
	rotationType?: APLRotationType;
	epWeights?: PresetEpWeights;
	encounter?: PresetEncounter;
	settings?: PresetSettings;
}

export interface PresetBuildOptions extends Omit<PresetBuild, 'name'> {}

export const makePresetGear = (name: string, gearJson: any, options?: PresetGearOptions): PresetGear => {
	const gear = EquipmentSpec.fromJson(gearJson);
	return makePresetGearHelper(name, gear, options || {});
};

const makePresetGearHelper = (name: string, gear: EquipmentSpec, options: PresetGearOptions): PresetGear => {
	const conditions: Array<(player: Player<any>) => boolean> = [];

	if (options.faction !== undefined) {
		conditions.push((player: Player<any>) => player.getFaction() == options.faction);
	}
	if (options.customCondition !== undefined) {
		conditions.push(options.customCondition);
	}

	return {
		name,
		tooltip: options.tooltip || Tooltips.BASIC_BIS_DISCLAIMER,
		gear,
		enableWhen: !!conditions.length ? (player: Player<any>) => conditions.every(cond => cond(player)) : undefined,
		onLoad: options?.onLoad,
	};
};

export const makePresetTalents = (name: string, data: SavedTalents, options?: PresetTalentsOptions): PresetTalents => {
	const conditions: Array<(player: Player<any>) => boolean> = [];
	if (options && options.customCondition) {
		conditions.push(options.customCondition);
	}

	return {
		name,
		data,
		enableWhen: conditions.length > 0 ? (player: Player<any>) => conditions.every(cond => cond(player)) : undefined,
	};
};

export const makePresetEpWeights = (name: string, epWeights: Stats, options?: PresetEpWeightsOptions): PresetEpWeights => {
	return makePresetEpWeightHelper(name, epWeights, options || {});
};

const makePresetEpWeightHelper = (name: string, epWeights: Stats, options?: PresetEpWeightsOptions): PresetEpWeights => {
	const conditions: Array<(player: Player<any>) => boolean> = [];
	if (options?.customCondition !== undefined) {
		conditions.push(options.customCondition);
	}

	return {
		name,
		epWeights,
		enableWhen: !!conditions.length ? (player: Player<any>) => conditions.every(cond => cond(player)) : undefined,
		onLoad: options?.onLoad,
	};
};

export const makePresetAPLRotation = (name: string, rotationJson: any, options?: PresetRotationOptions): PresetRotation => {
	const rotation = SavedRotation.create({
		rotation: APLRotation.fromJson(rotationJson),
	});

	return makePresetRotationHelper(name, rotation, options);
};

export const makePresetSimpleRotation = <SpecType extends Spec>(
	name: string,
	spec: SpecType,
	simpleRotation: SpecRotation<SpecType>,
	options?: PresetRotationOptions,
): PresetRotation => {
	const isTankSpec =
		spec == Spec.SpecBloodDeathKnight || spec == Spec.SpecGuardianDruid || spec == Spec.SpecProtectionPaladin || spec == Spec.SpecProtectionWarrior;
	const rotation = SavedRotation.create({
		rotation: {
			type: APLRotationType.TypeSimple,
			simple: {
				specRotationJson: JSON.stringify(specTypeFunctions[spec].rotationToJson(simpleRotation)),
				cooldowns: Cooldowns.create({
					hpPercentForDefensives: isTankSpec ? 0.4 : 0,
				}),
			},
		},
	});

	return makePresetRotationHelper(name, rotation, options);
};

const makePresetRotationHelper = (name: string, rotation: SavedRotation, options?: PresetRotationOptions): PresetRotation => {
	const conditions: Array<(player: Player<any>) => boolean> = [];
	if (options?.talents != undefined) {
		conditions.push((player: Player<any>) => (options.talents || []).join('') === player.getTalentTreePoints().join(''));
	}
	return {
		name,
		rotation,
		enableWhen: !!conditions.length ? (player: Player<any>) => conditions.every(cond => cond(player)) : undefined,
		onLoad: options?.onLoad,
	};
};

export const makePresetEncounter = (
	name: string,
	encounter?: EncounterProto,
	healingModel?: HealingModel,
	tanks?: UnitReference[],
	targetDummies?: number,
	options?: PresetEncounterOptions,
): PresetEncounter => {
	return {
		name,
		encounter,
		targetDummies,
		tanks,
		healingModel,
		...options,
	};
};

export const makePresetItemSwapGear = (name: string, itemSwapJson: any): PresetItemSwap => {
	const itemSwap = ItemSwap.fromJson(itemSwapJson);
	return makePresetItemSwapGearHelper(name, itemSwap);
};

export const makePresetItemSwapGearHelper = (name: string, itemSwap: ItemSwap): PresetItemSwap => {
	return {
		name,
		itemSwap,
	};
};

export const makePresetSettings = (name: string, spec: Spec, simSettings: IndividualSimSettings): PresetSettings => {
	return makePresetSettingsHelper(name, spec, simSettings);
};

const makePresetSettingsHelper = (name: string, spec: Spec, simSettings: IndividualSimSettings): PresetSettings => {
	const settings: PresetSettings = { name };

	if (simSettings.player?.race) {
		settings.race = simSettings.player.race;
	}

	if (simSettings.player) {
		settings.specOptions = specTypeFunctions[spec].optionsFromPlayer(simSettings.player);

		if (simSettings.player.buffs) {
			settings.buffs = simSettings.player.buffs;
		}

		if (simSettings.player.consumables) {
			settings.consumables = simSettings.player.consumables;
		}

		settings.playerOptions = {
			distanceFromTarget: simSettings.player.distanceFromTarget,
			enableItemSwap: simSettings.player.enableItemSwap,
		};
		if (!!simSettings.player.profession1) {
			settings.playerOptions.profession1 = simSettings.player.profession1;
		}

		if (!!simSettings.player.profession2) {
			settings.playerOptions.profession2 = simSettings.player.profession2;
		}

		if (simSettings.player.itemSwap) {
			settings.playerOptions.itemSwap = simSettings.player.itemSwap;
		}
	}

	if (simSettings.raidBuffs) {
		settings.raidBuffs = simSettings.raidBuffs;
	}

	if (simSettings.partyBuffs) {
		settings.partyBuffs = simSettings.partyBuffs;
	}

	if (simSettings.debuffs) {
		settings.debuffs = simSettings.debuffs;
	}

	return settings;
};

export const makePresetBuild = (name: string, options: PresetBuildOptions): PresetBuild => {
	return { name, ...options };
};

export const makePresetBuildFromJSON = (
	name: string,
	spec: Spec,
	json: any,
	{ settings: customSimSettings, ...customBuildOptions }: PresetBuildOptions = {},
	options?: PresetOptionsBase,
): PresetBuild => {
	const simSettings = IndividualSimSettings.fromJson(json);
	const buildConfig: PresetBuildOptions = {};

	if (simSettings.player) {
		if (simSettings.player.equipment) {
			buildConfig.gear = makePresetGear(name, simSettings.player.equipment, options);
		}

		if (simSettings.player?.talentsString) {
			buildConfig.talents = makePresetTalents(name, SavedTalents.create({ talentsString: simSettings.player.talentsString }), options);
		}

		if (simSettings.player?.rotation && simSettings.player?.rotation.type === APLRotationType.TypeAPL) {
			buildConfig.rotation = makePresetRotationHelper(name, SavedRotation.create({ rotation: simSettings.player.rotation }), options);
		}
	}

	if (simSettings.encounter) {
		buildConfig.encounter = makePresetEncounter(
			name,
			simSettings.encounter,
			simSettings.player?.healingModel,
			simSettings.tanks,
			simSettings.targetDummies,
			options,
		);
	}

	const settings = makePresetSettingsHelper(name, spec, simSettings);
	if (Object.keys(settings).length > 1 || customSimSettings) {
		buildConfig.settings = { ...settings, ...customSimSettings };
	}

	if (simSettings.epWeightsStats) {
		buildConfig.epWeights = makePresetEpWeightHelper(name, Stats.fromProto(simSettings.epWeightsStats), options);
	}

	return makePresetBuild(name, { ...buildConfig, ...customBuildOptions });
};

export type SpecCheckWarning = {
	condition: (player: Player<any>) => boolean;
	message: string;
};

export const makeSpecChangeWarningToast = (checks: SpecCheckWarning[], player: Player<any>, options?: Partial<ToastOptions>) => {
	const messages: string[] = checks.map(({ condition, message }) => condition(player) && message).filter((m): m is string => !!m);
	if (messages.length)
		new Toast({
			variant: 'warning',
			body: (
				<>
					{messages.map(message => (
						<p>{message}</p>
					))}
				</>
			),
			delay: 5000 * messages.length,
			...options,
		});
};

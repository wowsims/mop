import { APLRotation, APLRotation_Type as APLRotationType } from '@core/proto/apl';
import {
	Cooldowns,
	Encounter as EncounterProto,
	EquipmentSpec,
	Glyphs,
	HealingModel,
	ItemSwap,
	PseudoStat,
	Spec,
	Stat,
	UnitReference,
} from '@core/proto/common';
import { IndividualSimSettings, SavedRotation, SavedTalents } from '@core/proto/ui';
import { Player } from '@domain/player';
import type {
	PresetBuild,
	PresetBuildOptions,
	PresetEncounter,
	PresetEncounterOptions,
	PresetEpWeights,
	PresetEpWeightsOptions,
	PresetGear,
	PresetGearOptions,
	PresetItemSwap,
	PresetOptionsBase,
	PresetRotation,
	PresetRotationOptions,
	PresetSettings,
	PresetTalents,
	PresetTalentsOptions,
} from '@domain/presets/types';
import { Stats } from '@domain/proto_utils/stats';
import { SpecRotation, specTypeFunctions } from '@domain/proto_utils/utils';
import i18n from '@i18n/config';

export type {
	PresetBase,
	PresetBuild,
	PresetBuildOptions,
	PresetEncounter,
	PresetEncounterOptions,
	PresetEpWeights,
	PresetEpWeightsOptions,
	PresetGear,
	PresetGearOptions,
	PresetItemSwap,
	PresetOptionsBase,
	PresetRotation,
	PresetRotationOptions,
	PresetSettings,
	PresetTalents,
	PresetTalentsOptions,
} from '@domain/presets/types';

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
		tooltip: options.tooltip || i18n.t('sim.basic_bis_disclaimer'),
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

// JSON shape for presets/ep/*.ep.json. Enum keys are stored as names (e.g. "StatCritRating") so
// they stay stable across proto regenerations, rather than as the numeric enum values.
export type PresetEpWeightsJson = {
	name: string;
	stats?: Partial<Record<keyof typeof Stat, number>>;
	pseudoStats?: Partial<Record<keyof typeof PseudoStat, number>>;
};

export const makePresetEpWeightsFromJSON = (json: PresetEpWeightsJson, options?: PresetEpWeightsOptions): PresetEpWeights => {
	const statsMap: Partial<Record<Stat, number>> = {};
	Object.entries(json.stats ?? {}).forEach(([key, value]) => {
		statsMap[Stat[key as keyof typeof Stat]] = value;
	});

	const pseudoStatsMap: Partial<Record<PseudoStat, number>> = {};
	Object.entries(json.pseudoStats ?? {}).forEach(([key, value]) => {
		pseudoStatsMap[PseudoStat[key as keyof typeof PseudoStat]] = value;
	});

	return makePresetEpWeights(json.name, Stats.fromMap(statsMap, pseudoStatsMap), options);
};

// JSON shape for presets/talents/*.talents.json. Glyph values are stored as enum names (e.g.
// "GlyphOfBullRush") so they stay stable across proto regenerations.
export type PresetTalentsJson = {
	name: string;
	talentsString?: string;
	// A glyph value is normally the glyph enum's name (e.g. "GlyphOfBullRush"). A raw numeric spell
	// id is also accepted for glyphs that aren't represented in the enum.
	glyphs?: Partial<Record<keyof Glyphs, string | number>>;
};

export type PresetTalentsGlyphEnums = {
	major?: { [key: string]: number | string };
	minor?: { [key: string]: number | string };
};

export const makePresetTalentsFromJSON = (
	json: PresetTalentsJson,
	glyphEnums: PresetTalentsGlyphEnums,
	options?: PresetTalentsOptions,
): PresetTalents => {
	let glyphs: Glyphs | undefined;
	if (json.glyphs) {
		const glyphFields: Record<string, number> = {};
		Object.entries(json.glyphs).forEach(([slot, glyphValue]) => {
			if (typeof glyphValue === 'number') {
				glyphFields[slot] = glyphValue;
				return;
			}
			const enumTable = slot.startsWith('major') ? glyphEnums.major : glyphEnums.minor;
			glyphFields[slot] = Number(enumTable?.[glyphValue] ?? 0);
		});
		glyphs = Glyphs.create(glyphFields);
	}

	return makePresetTalents(json.name, SavedTalents.create({ talentsString: json.talentsString, glyphs }), options);
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
			reactionTimeMs: simSettings.player.reactionTimeMs,
			channelClipDelayMs: simSettings.player.channelClipDelayMs,
			inFrontOfTarget: simSettings.player.inFrontOfTarget,
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

		if (simSettings.player?.talentsString || simSettings.player?.glyphs) {
			buildConfig.talents = makePresetTalents(
				name,
				SavedTalents.create({ talentsString: simSettings.player?.talentsString, glyphs: simSettings.player?.glyphs }),
				options,
			);
		}

		if (simSettings.player?.rotation && simSettings.player?.rotation.type !== APLRotationType.TypeAuto) {
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

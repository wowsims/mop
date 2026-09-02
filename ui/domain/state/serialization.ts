// Serialization of the full individual-sim settings envelope
// (IndividualSimSettings), extracted from IndividualSimUI so the assembly and
// category filtering live in the UI-free state layer. IndividualSimUI.toProto /
// fromProto are thin wrappers over these functions.
import { ReforgeSettings as ReforgeSettingsProto } from '@core/proto/api';
import { Debuffs, Encounter as EncounterProto, PartyBuffs, RaidBuffs } from '@core/proto/common';
import { IndividualSimSettings } from '@core/proto/ui';

import { CURRENT_API_VERSION } from '../constants/other';
import { SimSettingCategories } from '../constants/sim_settings';
import type { Player } from '../player';
import { Stats } from '../proto_utils/stats';
import { migrateOldProto, ProtoConversionMap } from '../proto_utils/utils';
import type { ReforgeSettings } from '../reforge_settings';
import type { Sim } from '../sim';
import { batch, EventID } from './batch';
// The state surface the envelope serializes besides Player/Sim: the reforge
// settings model and the EP reference-stat selections owned by the sim UI.
export interface IndividualSimSerializationContext {
	player: Player<any>;
	sim: Sim;
	reforgeSettings?: ReforgeSettings;
	// Fallback EP weights applied when a loaded proto carries none.
	defaultEpWeights: Stats;
	// Mutable holder; loads write the ref stats back into it.
}

export function updateIndividualSimProtoVersion(settingsProto: IndividualSimSettings) {
	if (!(settingsProto.apiVersion < CURRENT_API_VERSION)) {
		return;
	}

	const conversionMap: ProtoConversionMap<IndividualSimSettings> = new Map([
		[
			2,
			(oldProto: IndividualSimSettings) => {
				oldProto.apiVersion = 2;

				oldProto.reforgeSettings = ReforgeSettingsProto.create({
					useCustomEpValues: oldProto.settings?.useCustomEpValues,
					useSoftCapBreakpoints: oldProto.settings?.useSoftCapBreakpoints,
					statCaps: oldProto.statCaps,
					breakpointLimits: oldProto.breakpointLimits,
				});

				return oldProto;
			},
		],
		[
			4,
			(oldProto: IndividualSimSettings) => {
				oldProto.apiVersion = 4;
				return oldProto;
			},
		],
	]);

	// Run the migration utility using the above map.
	migrateOldProto<IndividualSimSettings>(settingsProto, settingsProto.apiVersion, conversionMap);

	// Flag the version as up-to-date once all migrations are done.
	settingsProto.apiVersion = CURRENT_API_VERSION;
}

export function individualSimSettingsToProto(ctx: IndividualSimSerializationContext, exportCategories?: Array<SimSettingCategories>): IndividualSimSettings {
	const exportCategory = (cat: SimSettingCategories) => !exportCategories || exportCategories.length == 0 || exportCategories.includes(cat);

	const proto = IndividualSimSettings.create({
		player: ctx.player.toProto(true, false, exportCategories),
		apiVersion: CURRENT_API_VERSION,
	});

	if (exportCategory(SimSettingCategories.Miscellaneous)) {
		IndividualSimSettings.mergePartial(proto, {
			tanks: ctx.sim.raid.getTanks(),
		});
	}
	if (exportCategory(SimSettingCategories.Encounter)) {
		IndividualSimSettings.mergePartial(proto, {
			encounter: ctx.sim.encounter.toProto(),
		});
	}
	if (exportCategory(SimSettingCategories.External)) {
		IndividualSimSettings.mergePartial(proto, {
			partyBuffs: ctx.player.getParty()?.getBuffs() || PartyBuffs.create(),
			raidBuffs: ctx.sim.raid.getBuffs(),
			debuffs: ctx.sim.raid.getDebuffs(),
			targetDummies: ctx.sim.raid.getTargetDummies(),
		});
	}
	if (exportCategory(SimSettingCategories.UISettings)) {
		IndividualSimSettings.mergePartial(proto, {
			settings: ctx.sim.toProto(),
			epWeightsStats: ctx.player.getEpWeights().toProto(),
			epRatios: ctx.player.getEpRatios(),
			dpsRefStat: ctx.player.getRefStat('dpsRefStat'),
			healRefStat: ctx.player.getRefStat('healRefStat'),
			tankRefStat: ctx.player.getRefStat('tankRefStat'),
			reforgeSettings: ctx.reforgeSettings?.toProto(),
		});
	}

	return proto;
}

export function applyIndividualSimSettings(
	eventID: EventID,
	ctx: IndividualSimSerializationContext,
	settings: IndividualSimSettings,
	includeCategories?: Array<SimSettingCategories>,
) {
	const loadCategory = (cat: SimSettingCategories) => !includeCategories || includeCategories.length == 0 || includeCategories.includes(cat);

	const tankSpec = ctx.player.getPlayerSpec().isTankSpec;
	const healingSpec = ctx.player.getPlayerSpec().isHealingSpec;

	batch(() => {
		updateIndividualSimProtoVersion(settings);

		if (!settings.player) {
			return;
		}

		ctx.player.fromProto(eventID, settings.player, includeCategories);

		if (loadCategory(SimSettingCategories.Miscellaneous)) {
			ctx.sim.raid.setTanks(eventID, settings.tanks || []);
		}
		if (loadCategory(SimSettingCategories.External)) {
			ctx.sim.raid.setBuffs(eventID, settings.raidBuffs || RaidBuffs.create());
			ctx.sim.raid.setDebuffs(eventID, settings.debuffs || Debuffs.create());
			const party = ctx.player.getParty();
			if (party) {
				party.setBuffs(eventID, settings.partyBuffs || PartyBuffs.create());
			}
			ctx.sim.raid.setTargetDummies(eventID, settings.targetDummies);
		}
		if (loadCategory(SimSettingCategories.Encounter)) {
			ctx.sim.encounter.fromProto(eventID, settings.encounter || EncounterProto.create());
		}
		if (loadCategory(SimSettingCategories.UISettings)) {
			if (settings.epWeightsStats) {
				ctx.player.setEpWeights(eventID, Stats.fromProto(settings.epWeightsStats));
			} else {
				ctx.player.setEpWeights(eventID, ctx.defaultEpWeights);
			}

			const defaultRatios = ctx.player.getDefaultEpRatios(tankSpec, healingSpec);
			if (settings.epRatios) {
				const missingRatios = new Array<number>(defaultRatios.length - settings.epRatios.length).fill(0);
				ctx.player.setEpRatios(eventID, settings.epRatios.concat(missingRatios));
			} else {
				ctx.player.setEpRatios(eventID, defaultRatios);
			}

			if (settings.reforgeSettings && ctx.reforgeSettings) {
				ctx.reforgeSettings.fromProto(eventID, settings.reforgeSettings);
			}

			for (const kind of ['dpsRefStat', 'healRefStat', 'tankRefStat'] as const) {
				if (settings[kind]) ctx.player.setRefStat(eventID, kind, settings[kind]);
			}

			if (settings.settings) {
				ctx.sim.fromProto(eventID, settings.settings);
			} else {
				ctx.sim.applyDefaults(eventID, tankSpec, healingSpec);
			}
		}
	});
}

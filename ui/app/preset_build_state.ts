import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { isEqualAPLRotation } from '@sim/proto/apl_utils';
import type { IndividualSimHost } from '@sim/sim_host';
import { ConsumesSpec, Debuffs, Encounter, EquipmentSpec, HealingModel, IndividualBuffs, ItemSwap, RaidBuffs, Spec } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translatePresetConfigurationCategory } from '@i18n/localization';

import type { PresetBuild } from './preset_utils';

/** The categories a build touches, as the chip tooltip lists them: de-duplicated and sorted. */
export function buildCategories(build: PresetBuild): Array<string> {
	const categories: Array<string> = [];

	Object.keys(build).forEach(c => {
		if (!['name', 'encounter', 'settings', 'reforgeSettings', 'epWeights'].includes(c) && build[c as PresetConfigurationCategory]) {
			categories.push(translatePresetConfigurationCategory(c as PresetConfigurationCategory));
		}
	});

	if (build.encounter?.encounter) categories.push(translatePresetConfigurationCategory(PresetConfigurationCategory.Encounter));
	if (build.epWeights) categories.push(i18n.t('common.preset.stat_weights'));
	if (build.reforgeSettings) categories.push('Reforge Settings');

	if (build.settings) {
		Object.keys(build.settings).forEach(c => {
			if (['name', 'buffs', 'raidBuffs'].includes(c)) return;
			if (c === 'options') categories.push(i18n.t('common.preset.class_spec_options'));
			else if (c === 'consumes') categories.push(i18n.t('common.preset.consumables'));
			else categories.push(i18n.t('common.preset.other_settings'));
		});
	}

	if (build.settings?.buffs || build.settings?.raidBuffs) categories.push(i18n.t('common.preset.buffs'));

	return [...new Set(categories)].sort();
}

export function isBuildActive({ gear, rotation, rotationType, talents, epWeights, encounter, settings }: PresetBuild, simUI: IndividualSimHost<Spec>): boolean {
	const hasGear = gear ? EquipmentSpec.equals(gear.gear, simUI.player.getGear().asSpec()) : true;
	const hasTalents = talents
		? SavedTalents.equals(
				talents.data,
				SavedTalents.create({
					talentsString: simUI.player.getTalentsString(),
					glyphs: simUI.player.getGlyphs(),
				}),
			)
		: true;
	let hasRotation = true;
	if (rotationType) {
		hasRotation = rotationType === simUI.player.getRotationType();
	} else if (rotation?.rotation.rotation) {
		const activeRotation = simUI.player.getResolvedAplRotation();
		hasRotation = isEqualAPLRotation(simUI.player, activeRotation, rotation.rotation.rotation);
	}
	const hasEpWeights = epWeights ? simUI.player.getEpWeights().equals(epWeights.epWeights) : true;
	const hasEncounter = encounter?.encounter
		? Encounter.equals({ ...encounter.encounter, apiVersion: 0 }, { ...simUI.sim.encounter.toProto(), apiVersion: 0 })
		: true;
	const hasHealingModel = encounter?.healingModel ? HealingModel.equals(encounter.healingModel, simUI.player.getHealingModel()) : true;

	const hasRace = settings?.race ? simUI.player.getRace() === settings.race : true;
	const hasProfession1 = settings?.playerOptions?.profession1 === undefined || simUI.player.getProfession1() === settings.playerOptions.profession1;
	const hasProfession2 = settings?.playerOptions?.profession2 === undefined || simUI.player.getProfession2() === settings.playerOptions.profession2;
	const hasDistanceFromTarget =
		settings?.playerOptions?.distanceFromTarget === undefined || simUI.player.getDistanceFromTarget() === settings.playerOptions.distanceFromTarget;
	const hasEnableItemSwap =
		settings?.playerOptions?.enableItemSwap === undefined || simUI.player.itemSwapSettings.getEnableItemSwap() === settings.playerOptions.enableItemSwap;
	const hasItemSwap =
		settings?.playerOptions?.itemSwap === undefined ||
		ItemSwap.equals(stripItemSwapApiVersion(simUI.player.itemSwapSettings?.toProto()), stripItemSwapApiVersion(settings?.playerOptions?.itemSwap));
	const hasSpecOptions = settings?.specOptions ? JSON.stringify(simUI.player.getSpecOptions()) == JSON.stringify(settings.specOptions) : true;
	const hasConsumables = settings?.consumables ? ConsumesSpec.equals(simUI.player.getConsumes(), settings.consumables) : true;
	const hasRaidBuffs = settings?.raidBuffs ? RaidBuffs.equals(simUI.sim.raid.getBuffs(), settings.raidBuffs) : true;
	const hasBuffs = settings?.buffs ? IndividualBuffs.equals(simUI.player.getBuffs(), settings.buffs) : true;
	const hasDebuffs = settings?.debuffs ? Debuffs.equals(simUI.sim.raid.getDebuffs(), settings.debuffs) : true;

	return (
		hasGear &&
		hasTalents &&
		hasRotation &&
		hasEpWeights &&
		hasEncounter &&
		hasHealingModel &&
		hasRace &&
		hasProfession1 &&
		hasProfession2 &&
		hasDistanceFromTarget &&
		hasEnableItemSwap &&
		hasItemSwap &&
		hasSpecOptions &&
		hasConsumables &&
		hasRaidBuffs &&
		hasBuffs &&
		hasDebuffs
	);
}

/** Strips apiVersion from an ItemSwap and its nested UnitStats so preset comparisons aren't version-sensitive. */
function stripItemSwapApiVersion(swap: ItemSwap | undefined): ItemSwap | undefined {
	if (!swap) return swap;
	return {
		...swap,
		prepullBonusStats: swap.prepullBonusStats ? { ...swap.prepullBonusStats, apiVersion: 0 } : swap.prepullBonusStats,
	};
}

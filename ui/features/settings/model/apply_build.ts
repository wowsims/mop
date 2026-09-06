import type { PresetBuild } from '@domain/presets/types';
import { Stats } from '@domain/proto_utils/stats';
import { batch } from '@domain/state/batch';
import type { IndividualSimHost } from '@features/sim_host';

export const applyBuild = (
	{ gear, itemSwap, rotation, rotationType, talents, epWeights, encounter, settings, reforgeSettings }: PresetBuild,
	simUI: IndividualSimHost<any>,
): void => {
	batch(() => {
		if (gear) simUI.player.setGear(simUI.sim.db.lookupEquipmentSpec(gear.gear));
		if (itemSwap) {
			simUI.player.itemSwapSettings.setItemSwapSettings(
				true,
				simUI.sim.db.lookupItemSwap(itemSwap.itemSwap),
				Stats.fromProto(itemSwap.itemSwap.prepullBonusStats),
			);
		} else {
			simUI.player.itemSwapSettings.setEnableItemSwap(false);
		}
		if (talents) {
			simUI.player.setTalentsString(talents.data.talentsString);
			if (talents.data.glyphs) simUI.player.setGlyphs(talents.data.glyphs);
		}
		if (rotationType) {
			simUI.player.modifyAplRotation(aplRotation => {
				aplRotation.type = rotationType;
			});
		} else if (rotation?.rotation.rotation) {
			simUI.player.setAplRotation(rotation.rotation.rotation);
		}
		if (epWeights) simUI.player.setEpWeights(epWeights.epWeights);
		if (settings) {
			if (settings.race) simUI.player.setRace(settings.race);
			if (settings.consumables) simUI.player.setConsumes(settings.consumables);
			if (settings.playerOptions?.profession1) simUI.player.setProfession1(settings.playerOptions.profession1);
			if (settings.playerOptions?.profession2) simUI.player.setProfession2(settings.playerOptions.profession2);
			if (typeof settings.playerOptions?.distanceFromTarget === 'number') simUI.player.setDistanceFromTarget(settings.playerOptions.distanceFromTarget);
			if (typeof settings.playerOptions?.reactionTimeMs === 'number') simUI.player.setReactionTime(settings.playerOptions.reactionTimeMs);
			if (typeof settings.playerOptions?.channelClipDelayMs === 'number') simUI.player.setChannelClipDelay(settings.playerOptions.channelClipDelayMs);
			if (typeof settings.playerOptions?.inFrontOfTarget === 'boolean') simUI.player.setInFrontOfTarget(settings.playerOptions.inFrontOfTarget);
			if (settings.playerOptions?.enableItemSwap !== undefined && settings.playerOptions?.itemSwap) {
				simUI.player.itemSwapSettings.setItemSwapSettings(
					settings.playerOptions.enableItemSwap,
					simUI.sim.db.lookupItemSwap(settings.playerOptions.itemSwap),
					Stats.fromProto(settings.playerOptions.itemSwap.prepullBonusStats),
				);
			}
			if (settings.specOptions) {
				simUI.player.setSpecOptions({
					...simUI.player.getSpecOptions(),
					...settings.specOptions,
				});
			}
			if (settings.raidBuffs) simUI.sim.raid.setBuffs(settings.raidBuffs);
			if (settings.buffs) simUI.player.setBuffs(settings.buffs);
			if (settings.debuffs) simUI.sim.raid.setDebuffs(settings.debuffs);
		}
		if (encounter) {
			if (encounter.encounter) simUI.sim.encounter.fromProto(encounter.encounter);
			if (encounter.healingModel) simUI.player.setHealingModel(encounter.healingModel);
			if (encounter.tanks) simUI.sim.raid.setTanks(encounter.tanks);
			if (encounter.targetDummies !== undefined) simUI.sim.raid.setTargetDummies(encounter.targetDummies);
		}
		if (reforgeSettings && simUI.reforger) {
			simUI.reforger.fromProto(reforgeSettings);
		}
	});
};

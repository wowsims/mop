import { PresetConfigurationCategory } from '@domain/constants/preset_categories';
import { isEqualAPLRotation } from '@domain/proto_utils/apl_utils';
import { Stats } from '@domain/proto_utils/stats';
import { batch } from '@domain/state/batch';
import { subscribeSimChange } from '@domain/state/subscriptions';
import { ConsumesSpec, Debuffs, Encounter, EquipmentSpec, HealingModel, IndividualBuffs, ItemSwap, RaidBuffs, Spec } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translatePresetConfigurationCategory } from '@i18n/localization';
import { Component } from '@ui-kit/component';
import { ContentBlock } from '@ui-kit/content_block';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { IndividualSimUI } from './individual_sim_ui';
import { PresetBuild } from './preset_utils';
export class PresetConfigurationPicker extends Component {
	readonly simUI: IndividualSimUI<Spec>;
	readonly builds: Array<PresetBuild>;

	constructor(parentElem: HTMLElement, simUI: IndividualSimUI<Spec>, types?: PresetConfigurationCategory[]) {
		super(parentElem, 'preset-configuration-picker-root');
		this.rootElem.classList.add('saved-data-manager-root');

		this.simUI = simUI;
		this.builds = (this.simUI.individualConfig.presets.builds ?? []).filter(build =>
			Object.keys(build).some(category => types?.includes(category as PresetConfigurationCategory) && !!build[category as PresetConfigurationCategory]),
		);

		if (!this.builds.length) {
			this.rootElem.classList.add('hide');
			return;
		}

		const contentBlock = new ContentBlock(this.rootElem, 'saved-data', {
			header: {
				title: i18n.t('gear_tab.preset_configurations.title'),
				tooltip: i18n.t('gear_tab.preset_configurations.tooltip'),
			},
		});

		const buildsContainerRef = ref<HTMLDivElement>();

		const container = (
			<div className="saved-data-container">
				<div className="saved-data-presets" ref={buildsContainerRef}></div>
			</div>
		);

		this.simUI.sim.waitForInit().then(() => {
			this.builds.forEach(build => {
				const dataElemRef = ref<HTMLButtonElement>();
				buildsContainerRef.value!.appendChild(
					<button className="saved-data-set-chip badge rounded-pill" ref={dataElemRef}>
						<span
							className="saved-data-set-name"
							attributes={{ role: 'button' }}
							onclick={() => {
								PresetConfigurationPicker.applyBuild(build, this.simUI);
							}}>
							{build.name}
						</span>
					</button>,
				);

				let categories: string[] = [];

				// Add main categories from build keys
				Object.keys(build).forEach(c => {
					if (!['name', 'encounter', 'settings', 'reforgeSettings'].includes(c) && build[c as PresetConfigurationCategory]) {
						const category = c as PresetConfigurationCategory;
						categories.push(translatePresetConfigurationCategory(category));
					}
				});

				if (build.encounter?.encounter) {
					categories.push(translatePresetConfigurationCategory(PresetConfigurationCategory.Encounter));
				}

				if (build.epWeights) {
					categories.push(i18n.t('common.preset.stat_weights'));
				}

				if (build.reforgeSettings) {
					categories.push('Reforge Settings');
				}

				if (build.settings) {
					Object.keys(build.settings).forEach(c => {
						if (['name', 'buffs', 'raidBuffs'].includes(c)) return;

						if (c === 'options') {
							categories.push(i18n.t('common.preset.class_spec_options'));
						} else if (c === 'consumes') {
							categories.push(i18n.t('common.preset.consumables'));
						} else {
							categories.push(i18n.t('common.preset.other_settings'));
						}
					});
				}

				if (build.settings?.buffs || build.settings?.raidBuffs) {
					categories.push(i18n.t('common.preset.buffs'));
				}

				categories = [...new Set(categories)].sort();

				tippy(dataElemRef.value!, {
					content: (
						<>
							<p className="mb-1">{i18n.t('common.preset.description')}</p>
							<ul className="mb-0">
								{categories.map(category => (
									<li>{category}</li>
								))}
							</ul>
						</>
					),
				});

				const checkActive = () => dataElemRef.value!.classList[this.isBuildActive(build) ? 'add' : 'remove']('active');

				checkActive();
				this.addOnDisposeCallback(subscribeSimChange(this.simUI.sim)(checkActive));
			});
			contentBlock.bodyElement.replaceChildren(container);
		});
	}

	static applyBuild(
		{ gear, itemSwap, rotation, rotationType, talents, epWeights, encounter, settings, reforgeSettings }: PresetBuild,
		simUI: IndividualSimUI<any>,
	) {
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
				if (typeof settings.playerOptions?.distanceFromTarget === 'number')
					simUI.player.setDistanceFromTarget(settings.playerOptions.distanceFromTarget);
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
	}

	private isBuildActive({ gear, rotation, rotationType, talents, epWeights, encounter, settings }: PresetBuild): boolean {
		const hasGear = gear ? EquipmentSpec.equals(gear.gear, this.simUI.player.getGear().asSpec()) : true;
		const hasTalents = talents
			? SavedTalents.equals(
					talents.data,
					SavedTalents.create({
						talentsString: this.simUI.player.getTalentsString(),
						glyphs: this.simUI.player.getGlyphs(),
					}),
				)
			: true;
		let hasRotation = true;
		if (rotationType) {
			hasRotation = rotationType === this.simUI.player.getRotationType();
		} else if (rotation?.rotation.rotation) {
			const activeRotation = this.simUI.player.getResolvedAplRotation();
			hasRotation = isEqualAPLRotation(this.simUI.player, activeRotation, rotation.rotation.rotation);
		}
		const hasEpWeights = epWeights ? this.simUI.player.getEpWeights().equals(epWeights.epWeights) : true;
		const hasEncounter = encounter?.encounter
			? Encounter.equals({ ...encounter.encounter, apiVersion: 0 }, { ...this.simUI.sim.encounter.toProto(), apiVersion: 0 })
			: true;
		const hasHealingModel = encounter?.healingModel ? HealingModel.equals(encounter.healingModel, this.simUI.player.getHealingModel()) : true;

		const hasRace = settings?.race ? this.simUI.player.getRace() === settings.race : true;
		const hasProfession1 = settings?.playerOptions?.profession1 === undefined || this.simUI.player.getProfession1() === settings.playerOptions.profession1;
		const hasProfession2 = settings?.playerOptions?.profession2 === undefined || this.simUI.player.getProfession2() === settings.playerOptions.profession2;
		const hasDistanceFromTarget =
			settings?.playerOptions?.distanceFromTarget === undefined ||
			this.simUI.player.getDistanceFromTarget() === settings.playerOptions.distanceFromTarget;
		const hasEnableItemSwap =
			settings?.playerOptions?.enableItemSwap === undefined ||
			this.simUI.player.itemSwapSettings.getEnableItemSwap() === settings.playerOptions.enableItemSwap;
		const hasItemSwap =
			settings?.playerOptions?.itemSwap === undefined ||
			ItemSwap.equals(stripItemSwapApiVersion(this.simUI.player.itemSwapSettings?.toProto()), stripItemSwapApiVersion(settings?.playerOptions?.itemSwap));
		const hasSpecOptions = settings?.specOptions ? JSON.stringify(this.simUI.player.getSpecOptions()) == JSON.stringify(settings.specOptions) : true;
		const hasConsumables = settings?.consumables ? ConsumesSpec.equals(this.simUI.player.getConsumes(), settings.consumables) : true;
		const hasRaidBuffs = settings?.raidBuffs ? RaidBuffs.equals(this.simUI.sim.raid.getBuffs(), settings.raidBuffs) : true;
		const hasBuffs = settings?.buffs ? IndividualBuffs.equals(this.simUI.player.getBuffs(), settings.buffs) : true;
		const hasDebuffs = settings?.debuffs ? Debuffs.equals(this.simUI.sim.raid.getDebuffs(), settings.debuffs) : true;

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
}

/** Strips apiVersion from an ItemSwap and its nested UnitStats so preset comparisons aren't version-sensitive. */
function stripItemSwapApiVersion(swap: ItemSwap | undefined): ItemSwap | undefined {
	if (!swap) return swap;
	return {
		...swap,
		prepullBonusStats: swap.prepullBonusStats ? { ...swap.prepullBonusStats, apiVersion: 0 } : swap.prepullBonusStats,
	};
}

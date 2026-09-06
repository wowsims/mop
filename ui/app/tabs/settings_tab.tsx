/** @jsxImportSource @jsx-vanilla */
import { PresetConfigurationCategory } from '@domain/constants/preset_categories';
import { Encounter } from '@domain/encounter';
import { Player } from '@domain/player';
import {
	subscribeAll,
	subscribeEncounterChange,
	subscribePartyBuffs,
	subscribePlayerChange,
	subscribePlayerField,
	subscribeRaidField,
} from '@domain/state/subscriptions';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import { applySavedSettings, readSavedSettings } from '@features/settings/model/saved_settings';
import { relevantStatOptions } from '@features/settings/model/stat_options';
import { Spec } from '@generated/proto/common';
import { SavedEncounter, SavedSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { ContentBlock } from '@ui-kit/content_block';
import { SavedDataManager } from '@ui-kit/saved_data_manager';
import { SimTab } from '@ui-kit/sim_tab';

import { CustomSection, IndividualSimUI } from '../individual_sim_ui';
import { PresetConfigurationPicker } from '../preset_configuration_picker';
export class SettingsTab extends SimTab {
	/** Where React renders the encounter block. Filled in `buildEncounterSettings`. */
	encounterContainer!: HTMLElement;
	/** Where React renders the player block, which every spec builds. */
	playerSettingsContainer!: HTMLElement;
	/** Where React renders the consumables block, which every spec builds. */
	consumesContainer!: HTMLElement;
	/** Where React renders the other-settings block. Absent when that block is not built at all. */
	otherSettingsContainer?: HTMLElement;
	/** One per declared `sections` entry, paired with the config React needs to fill it. */
	customSectionContainers: Array<{ section: CustomSection<any>; body: HTMLElement }> = [];
	/** The two external-cooldown blocks. Absent on a spec whose option list filters to nothing. */
	externalDamageCooldownContainer?: HTMLElement;
	externalDefensiveCooldownContainer?: HTMLElement;
	/** The buffs and debuffs blocks, which are built on every spec. */
	buffsContainer!: HTMLElement;
	debuffsContainer!: HTMLElement;

	protected simUI: IndividualSimUI<any>;

	readonly leftPanel: HTMLElement;
	readonly rightPanel: HTMLElement;

	readonly column1: HTMLElement = this.buildColumn(1, 'settings-left-col');
	readonly column2: HTMLElement = this.buildColumn(2, 'settings-left-col');
	readonly column3: HTMLElement = this.buildColumn(3, 'settings-left-col');

	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'settings-tab', title: i18n.t('settings_tab.title') });
		this.simUI = simUI;

		this.leftPanel = document.createElement('div');
		this.leftPanel.classList.add('settings-tab-left', 'tab-panel-left');

		this.leftPanel.appendChild(this.column1);
		this.leftPanel.appendChild(this.column2);
		this.leftPanel.appendChild(this.column3);

		this.rightPanel = document.createElement('div');
		this.rightPanel.classList.add('settings-tab-right', 'tab-panel-right');

		this.contentContainer.appendChild(this.leftPanel);
		this.contentContainer.appendChild(this.rightPanel);
		this.simUI.sim.waitForInit().then(() => {
			this.buildTabContent();
		});
	}

	protected buildTabContent() {
		this.buildEncounterSettings();
		this.buildPlayerSettings();
		this.buildCustomSettingsSections();
		this.buildConsumesSection();
		this.buildOtherSettings();
		this.buildBuffsSettings();
		this.raidExternalDamageCooldowns();
		this.raidExternalDefensiveCooldowns();
		this.buildDebuffsSettings();
		this.buildPresetConfigurationPicker();
		this.buildSavedDataPickers();
	}

	private buildEncounterSettings() {
		const contentBlock = new ContentBlock(this.column1, 'encounter-settings', {
			header: { title: i18n.t('settings_tab.encounter.title') },
		});
		// Built empty on purpose: `SimApp` portals the React `EncounterPicker` into it. The block
		// itself stays vanilla because the eight around it do.
		this.encounterContainer = contentBlock.bodyElement;
	}

	private buildPlayerSettings() {
		const contentBlock = new ContentBlock(this.column1, 'player-settings', {
			header: { title: i18n.t('settings_tab.player.title') },
		});
		// Built empty: `SimApp` portals the React `PlayerSettings` into it, which renders the icon
		// group, the race select, the spec's own inputs and the two professions as one tree.
		this.playerSettingsContainer = contentBlock.bodyElement;
	}

	private buildCustomSettingsSections() {
		// The block, its `custom-section` class and its `when` visibility stay here; React fills the
		// body. `when` toggles `hide` on the block's *root*, which React does not own.
		for (const section of this.simUI.individualConfig.sections || []) {
			const contentBlock = buildCustomSection(this.column2, this.simUI.player, section);
			contentBlock.rootElem.classList.add('custom-section');
			this.customSectionContainers.push({ section, body: contentBlock.bodyElement });
		}
	}

	private buildConsumesSection() {
		const contentBlock = new ContentBlock(this.column2, 'consumes-settings', {
			header: { title: i18n.t('settings_tab.consumables.title') },
		});
		// Built empty: `SimApp` portals the React `ConsumesPicker` into it, which renders the five
		// labelled rows and every picker in them.
		this.consumesContainer = contentBlock.bodyElement;
	}

	private buildOtherSettings() {
		const settings = this.simUI.individualConfig.otherInputs?.inputs;

		const swapSlots = this.simUI.individualConfig.itemSwapSlots || [];
		if (settings.length > 0 || swapSlots.length > 0) {
			const contentBlock = new ContentBlock(this.column2, 'other-settings', {
				header: { title: i18n.t('settings_tab.other.title') },
			});

			// Built empty: `SimApp` portals the React `OtherSettings` into it, which renders the
			// generic inputs and the item-swap block as siblings in one tree. Whether the block
			// exists at all is still decided here, because the ContentBlock is still vanilla.
			this.otherSettingsContainer = contentBlock.bodyElement;
		}
	}

	private buildBuffsSettings() {
		const contentBlock = new ContentBlock(this.column3, 'buffs-settings', {
			header: { title: i18n.t('settings_tab.raid_buffs.title'), tooltip: i18n.t('settings_tab.raid_buffs.tooltip') },
		});
		// The header stays here with the block: React fills the body only.
		contentBlock.headerElement?.appendChild(<p className="fs-body">{i18n.t('settings_tab.raid_buffs.description')}</p>);

		// What `configureIconSection` did for this block, without the picker construction it counted:
		// hide the body when the spec's stats filter every buff out. The misc bundle was appended
		// afterwards and never counted towards it.
		if (relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_CONFIG, this.simUI).length === 0) contentBlock.bodyElement.classList.add('hide');
		this.buffsContainer = contentBlock.bodyElement;
	}

	private raidExternalDamageCooldowns() {
		const externalDamageCooldownOptions = relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DAMAGE_COOLDOWN, this.simUI);
		if (externalDamageCooldownOptions.length > 0) {
			const contentBlock = new ContentBlock(this.column3, 'buffs-settings', {
				header: { title: i18n.t('settings_tab.external_damage_cooldowns.title'), tooltip: i18n.t('settings_tab.external_damage_cooldowns.tooltip') },
			});

			// Built empty; React fills it. `configureIconSection` did nothing here — its only effect
			// without `adjustColumns` is to hide an empty section, and the guard above already means
			// this one is not empty.
			this.externalDamageCooldownContainer = contentBlock.bodyElement;
		}
	}
	private raidExternalDefensiveCooldowns() {
		const externalDefensiveCooldownOptions = relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DEFENSIVE_COOLDOWN, this.simUI);
		if (externalDefensiveCooldownOptions.length > 0) {
			const contentBlock = new ContentBlock(this.column3, 'buffs-settings', {
				header: {
					title: i18n.t('settings_tab.external_defensive_cooldowns.title'),
					tooltip: i18n.t('settings_tab.external_defensive_cooldowns.tooltip'),
				},
			});

			this.externalDefensiveCooldownContainer = contentBlock.bodyElement;
		}
	}

	private buildDebuffsSettings() {
		const contentBlock = new ContentBlock(this.column3, 'debuffs-settings', {
			header: { title: i18n.t('settings_tab.debuffs.title'), tooltip: i18n.t('settings_tab.debuffs.tooltip') },
		});

		// As above. The misc branch that stood here is gone with `DEBUFFS_MISC_CONFIG`, which was `[]`.
		if (relevantStatOptions(BuffDebuffInputs.DEBUFFS_CONFIG, this.simUI).length === 0) contentBlock.bodyElement.classList.add('hide');
		this.debuffsContainer = contentBlock.bodyElement;
	}

	private buildPresetConfigurationPicker() {
		new PresetConfigurationPicker(this.rightPanel, this.simUI, [PresetConfigurationCategory.Encounter, PresetConfigurationCategory.Settings]);
	}

	private buildSavedDataPickers() {
		const savedEncounterManager = new SavedDataManager<Encounter, SavedEncounter>(this.rightPanel, this.simUI.sim.encounter, {
			label: i18n.t('settings_tab.saved_encounters.encounter'),
			header: { title: i18n.t('settings_tab.saved_encounters.title') },
			nameLabel: i18n.t('settings_tab.saved_encounters.encounter_name'),
			saveButtonText: i18n.t('settings_tab.saved_encounters.save_encounter'),
			storageKey: this.simUI.getSavedEncounterStorageKey(),
			getData: (encounter: Encounter) => SavedEncounter.create({ encounter: encounter.toProto() }),
			setData: (encounter: Encounter, newEncounter: SavedEncounter) => encounter.fromProto(newEncounter.encounter!),
			subscribe: subscribeEncounterChange(this.simUI.sim.encounter),
			toJson: (a: SavedEncounter) => SavedEncounter.toJson(a),
			fromJson: (obj: any) => SavedEncounter.fromJson(obj),
		});

		const savedSettingsManager = new SavedDataManager<IndividualSimUI<any>, SavedSettings>(this.rightPanel, this.simUI, {
			label: i18n.t('settings_tab.saved_settings.settings'),
			header: { title: i18n.t('settings_tab.saved_settings.title') },
			nameLabel: i18n.t('settings_tab.saved_settings.settings_name'),
			saveButtonText: i18n.t('settings_tab.saved_settings.save_settings'),
			storageKey: this.simUI.getSavedSettingsStorageKey(),
			getData: () => readSavedSettings(this.simUI),
			setData: (simUI: IndividualSimUI<any>, newSettings: SavedSettings) => applySavedSettings(simUI, newSettings),
			subscribe: subscribeAll([
				subscribeRaidField(this.simUI.sim.raid, 'buffs'),
				subscribeRaidField(this.simUI.sim.raid, 'debuffs'),
				subscribePartyBuffs(this.simUI.player.getParty()!),
				subscribePlayerField(this.simUI.player, 'buffs'),
				subscribePlayerField(this.simUI.player, 'consumables'),
				subscribePlayerField(this.simUI.player, 'race'),
				subscribePlayerField(this.simUI.player, 'profession1'),
				subscribePlayerField(this.simUI.player, 'profession2'),
				subscribePlayerField(this.simUI.player, 'itemSwap'),
				subscribePlayerField(this.simUI.player, 'reactionTime'),
				subscribePlayerField(this.simUI.player, 'channelClipDelay'),
				subscribePlayerField(this.simUI.player, 'inFrontOfTarget'),
				subscribePlayerField(this.simUI.player, 'distanceFromTarget'),
				subscribePlayerField(this.simUI.player, 'healingModel'),
			]),
			toJson: (a: SavedSettings) => SavedSettings.toJson(a),
			fromJson: (obj: any) => SavedSettings.fromJson(obj),
		});

		this.simUI.sim.waitForInit().then(() => {
			savedEncounterManager.loadUserData();
			this.simUI.individualConfig.presets.encounters?.forEach(encounter => {
				savedEncounterManager.addSavedData({
					name: encounter.name,
					tooltip: encounter.tooltip,
					isPreset: true,
					data: SavedEncounter.create({
						encounter: encounter.encounter,
					}),
				});
			});
			savedSettingsManager.loadUserData();
			this.simUI.individualConfig.presets.settings?.forEach(settings => {
				savedSettingsManager.addSavedData({
					name: settings.name,
					tooltip: settings.tooltip,
					isPreset: true,
					data: SavedSettings.create({
						race: settings.race,
						raidBuffs: settings.raidBuffs,
						playerBuffs: settings.buffs,
						debuffs: settings.debuffs,
						consumables: settings.consumables,
						professions:
							settings.playerOptions?.profession1 && settings.playerOptions?.profession2
								? [settings.playerOptions.profession1, settings.playerOptions.profession2]
								: undefined,
						distanceFromTarget: settings.playerOptions?.distanceFromTarget,
						reactionTimeMs: settings.playerOptions?.reactionTimeMs,
						channelClipDelayMs: settings.playerOptions?.channelClipDelayMs,
						inFrontOfTarget: settings.playerOptions?.inFrontOfTarget,
						enableItemSwap: settings.playerOptions?.enableItemSwap,
					}),
				});
			});

			this.simUI.individualConfig.presets.itemSwaps?.forEach(presetItemSwap => {
				this.simUI.player;
				savedSettingsManager.addSavedData({
					name: presetItemSwap.name,
					tooltip: presetItemSwap.tooltip,
					isPreset: true,
					data: SavedSettings.create({
						...readSavedSettings(this.simUI),
						enableItemSwap: true,
						itemSwap: presetItemSwap.itemSwap,
					}),
				});
			});
		});
	}
}

// Renders a spec's declarative `CustomSection` (see @features/spec_config).
export function buildCustomSection<SpecType extends Spec>(parentElem: HTMLElement, player: Player<SpecType>, section: CustomSection<SpecType>): ContentBlock {
	const contentBlock = new ContentBlock(parentElem, section.cssClass || section.id, {
		header: { title: section.title, tooltip: section.tooltip },
	});

	// The body is left empty: `SimApp` portals the React `CustomSection` into it.
	const when = section.when;
	if (when) {
		const applyVisibility = () => contentBlock.rootElem.classList.toggle('hide', !when(player));
		applyVisibility();
		subscribePlayerChange(player)(applyVisibility);
	}

	return contentBlock;
}

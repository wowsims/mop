import i18n from '../../../i18n/config';
import { Encounter } from '../../encounter.js';
import { IndividualSimUI, InputSection } from '../../individual_sim_ui.jsx';
import { ConsumesSpec, Debuffs, HealingModel, IndividualBuffs, ItemSwap, PartyBuffs, Profession, RaidBuffs } from '../../proto/common.js';
import { SavedEncounter, SavedSettings } from '../../proto/ui.js';
import { translateRace, translateProfession } from '../../../i18n/localization.js';
import { Stats } from '../../proto_utils/stats.js';
import { EventID, TypedEvent } from '../../typed_event.js';
import { getEnumValues } from '../../utils.js';
import { ContentBlock } from '../content_block.jsx';
import { EncounterPicker } from '../encounter_picker.js';
import * as IconInputs from '../icon_inputs.js';
import { Input } from '../input.jsx';
import * as BuffDebuffInputs from '../inputs/buffs_debuffs.js';
import { relevantStatOptions } from '../inputs/stat_options.js';
import { ItemSwapPicker } from '../item_swap_picker.jsx';
import { BooleanPicker } from '../pickers/boolean_picker.js';
import { EnumPicker } from '../pickers/enum_picker.js';
import { MultiIconPicker } from '../pickers/multi_icon_picker.jsx';
import { NumberPicker } from '../pickers/number_picker.js';
import { SavedDataManager } from '../saved_data_manager.jsx';
import { SimTab } from '../sim_tab.js';
import { ConsumesPicker } from './consumes_picker.jsx';
import { PresetConfigurationCategory, PresetConfigurationPicker } from './preset_configuration_picker.jsx';

export class SettingsTab extends SimTab {
	protected simUI: IndividualSimUI<any>;

	readonly leftPanel: HTMLElement;
	readonly rightPanel: HTMLElement;

	readonly column1: HTMLElement = this.buildColumn(1, 'settings-left-col');
	readonly column2: HTMLElement = this.buildColumn(2, 'settings-left-col');
	readonly column3: HTMLElement = this.buildColumn(3, 'settings-left-col');
	readonly column4?: HTMLElement;

	constructor(parentElem: HTMLElement, simUI: IndividualSimUI<any>) {
		super(parentElem, simUI, { identifier: 'settings-tab', title: i18n.t('settings_tab.title') });
		this.simUI = simUI;

		this.leftPanel = document.createElement('div');
		this.leftPanel.classList.add('settings-tab-left', 'tab-panel-left');

		this.leftPanel.appendChild(this.column1);
		this.leftPanel.appendChild(this.column2);
		this.leftPanel.appendChild(this.column3);

		// The 4th column is only used in the raid sim player editor to spread out player settings
		if (this.simUI.isWithinRaidSim) {
			this.column4 = this.buildColumn(4, 'settings-left-col');
			this.leftPanel.appendChild(this.column4);
		}

		this.rightPanel = document.createElement('div');
		this.rightPanel.classList.add('settings-tab-right', 'tab-panel-right', 'within-raid-sim-hide');

		this.contentContainer.appendChild(this.leftPanel);
		this.contentContainer.appendChild(this.rightPanel);
		this.simUI.sim.waitForInit().then(() => {
			this.buildTabContent();
		});
	}

	protected buildTabContent() {
		if (!this.simUI.isWithinRaidSim) {
			this.buildEncounterSettings();
		}

		this.buildPlayerSettings();
		this.buildCustomSettingsSections();
		this.buildConsumesSection();
		this.buildOtherSettings();

		if (!this.simUI.isWithinRaidSim) {
			this.buildBuffsSettings();
			this.raidExternalDamageCooldowns();
			this.raidExternalDefensiveCooldowns();
			this.buildDebuffsSettings();
		}

		if (!this.simUI.isWithinRaidSim) {
			this.buildPresetConfigurationPicker();
			this.buildSavedDataPickers();
		}
	}

	private buildEncounterSettings() {
		const contentBlock = new ContentBlock(this.column1, 'encounter-settings', {
			header: { title: i18n.t('settings_tab.encounter.title') },
		});

		new EncounterPicker(contentBlock.bodyElement, this.simUI.sim.encounter, this.simUI.individualConfig.encounterPicker, this.simUI);
	}

	private buildPlayerSettings() {
		const column = this.column1;
		const contentBlock = new ContentBlock(column, 'player-settings', {
			header: { title: i18n.t('settings_tab.player.title') },
		});

		const playerIconGroup = Input.newGroupContainer();
		playerIconGroup.classList.add('player-icon-group', 'icon-group');
		contentBlock.bodyElement.appendChild(playerIconGroup);

		this.configureIconSection(
			playerIconGroup,
			this.simUI.individualConfig.playerIconInputs.map(iconInput => IconInputs.buildIconInput(playerIconGroup, this.simUI.player, iconInput)),
			true,
		);

		const races = this.simUI.player.getPlayerClass().races;
		const _racePicker = new EnumPicker(contentBlock.bodyElement, this.simUI.player, {
			id: 'simui-race',
			label: i18n.t('settings_tab.player.race'),
			values: races.map(race => {
				return {
					name: translateRace(race),
					value: race,
				};
			}),
			changedEvent: sim => sim.raceChangeEmitter,
			getValue: sim => sim.getRace(),
			setValue: (eventID, sim, newValue) => sim.setRace(eventID, newValue),
		});

		if (this.simUI.individualConfig.playerInputs?.inputs.length) {
			this.configureInputSection(contentBlock.bodyElement, this.simUI.individualConfig.playerInputs);
		}

		const professionGroup = Input.newGroupContainer();
		contentBlock.bodyElement.appendChild(professionGroup);

		const professions = getEnumValues(Profession).filter(proff => proff != Profession.Archeology) as Array<Profession>;
		const _profession1Picker = new EnumPicker(professionGroup, this.simUI.player, {
			id: 'simui-profession1',
			label: i18n.t('settings_tab.player.profession_1'),
			values: professions.map(p => {
				return {
					name: translateProfession(p),
					value: p,
				};
			}),
			changedEvent: sim => sim.professionChangeEmitter,
			getValue: sim => sim.getProfession1(),
			setValue: (eventID, sim, newValue) => sim.setProfession1(eventID, newValue),
		});

		const _profession2Picker = new EnumPicker(professionGroup, this.simUI.player, {
			id: 'simui-profession2',
			label: i18n.t('settings_tab.player.profession_2'),
			values: professions.map(p => {
				return {
					name: translateProfession(p),
					value: p,
				};
			}),
			changedEvent: sim => sim.professionChangeEmitter,
			getValue: sim => sim.getProfession2(),
			setValue: (eventID, sim, newValue) => sim.setProfession2(eventID, newValue),
		});
	}

	private buildCustomSettingsSections() {
		(this.simUI.individualConfig.customSections || []).forEach(customSection => {
			const section = customSection(this.column2, this.simUI);
			section.rootElem.classList.add('custom-section');
		});
	}

	private buildConsumesSection() {
		const column = this.simUI.isWithinRaidSim ? this.column3 : this.column2;
		const contentBlock = new ContentBlock(column, 'consumes-settings', {
			header: { title: i18n.t('settings_tab.consumables.title') },
		});
		ConsumesPicker.create(contentBlock.bodyElement, this, this.simUI);
	}

	private buildOtherSettings() {
		const settings = this.simUI.individualConfig.otherInputs?.inputs.filter(inputs => !inputs.extraCssClasses?.includes('within-raid-sim-hide') || true);

		const swapSlots = this.simUI.individualConfig.itemSwapSlots || [];
		if (settings.length > 0 || swapSlots.length > 0) {
			const contentBlock = new ContentBlock(this.column2, 'other-settings', {
			header: { title: i18n.t('settings_tab.other.title') },
		});

			if (settings.length > 0) {
				this.configureInputSection(contentBlock.bodyElement, this.simUI.individualConfig.otherInputs);
				contentBlock.bodyElement.querySelectorAll('.input-root').forEach(elem => {
					elem.classList.add('input-inline');
				});
			}

			if (swapSlots.length > 0) {
				const _itemSwapPicker = new ItemSwapPicker(contentBlock.bodyElement, this.simUI, this.simUI.player, {
					itemSlots: swapSlots,
				});
			}
		}
	}

	private buildBuffsSettings() {
		const contentBlock = new ContentBlock(this.column3, 'buffs-settings', {
			header: { title: i18n.t('settings_tab.raid_buffs.title'), tooltip: i18n.t('settings_tab.raid_buffs.tooltip') },
		});
		contentBlock.headerElement?.appendChild(
			<p className="fs-body">
				{i18n.t('settings_tab.raid_buffs.description')}
			</p>,
		);

		const buffOptions = relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_CONFIG, this.simUI);
		this.configureIconSection(
			contentBlock.bodyElement,
			buffOptions.map(options => options.picker && new options.picker(contentBlock.bodyElement, this.simUI.player, options.config as any, this.simUI)),
		);

		const miscBuffOptions = relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_MISC_CONFIG, this.simUI);
		if (miscBuffOptions.length > 0) {
			new MultiIconPicker(
				contentBlock.bodyElement,
				this.simUI.player,
				{
					inputs: miscBuffOptions.map(option => option.config),
					label: i18n.t('settings_tab.raid_buffs.misc.label'),
				},
				this.simUI,
			);
		}
	}

	private raidExternalDamageCooldowns() {
		const externalDamageCooldownOptions = relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DAMAGE_COOLDOWN, this.simUI);
		if (externalDamageCooldownOptions.length > 0) {
			const contentBlock = new ContentBlock(this.column3, 'buffs-settings', {
				header: { title: i18n.t('settings_tab.external_damage_cooldowns.title'), tooltip: i18n.t('settings_tab.external_damage_cooldowns.tooltip') },
			});

			this.configureIconSection(
				contentBlock.bodyElement,
				externalDamageCooldownOptions.map(
					options => options.picker && new options.picker(contentBlock.bodyElement, this.simUI.player, options.config as any),
				),
			);
		}
	}
	private raidExternalDefensiveCooldowns() {
		const externalDefensiveCooldownOptions = relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DEFENSIVE_COOLDOWN, this.simUI);
		if (externalDefensiveCooldownOptions.length > 0) {
			const contentBlock = new ContentBlock(this.column3, 'buffs-settings', {
				header: { title: i18n.t('settings_tab.external_defensive_cooldowns.title'), tooltip: i18n.t('settings_tab.external_defensive_cooldowns.tooltip') },
			});

			this.configureIconSection(
				contentBlock.bodyElement,
				externalDefensiveCooldownOptions.map(
					options => options.picker && new options.picker(contentBlock.bodyElement, this.simUI.player, options.config as any),
				),
			);
		}
	}

	private buildDebuffsSettings() {
		const contentBlock = new ContentBlock(this.column3, 'debuffs-settings', {
			header: { title: i18n.t('settings_tab.debuffs.title'), tooltip: i18n.t('settings_tab.debuffs.tooltip') },
		});

		const debuffOptions = relevantStatOptions(BuffDebuffInputs.DEBUFFS_CONFIG, this.simUI);
		this.configureIconSection(
			contentBlock.bodyElement,
			debuffOptions.map(options => options.picker && new options.picker(contentBlock.bodyElement, this.simUI.player, options.config as any, this.simUI)),
		);

		const miscDebuffOptions = relevantStatOptions(BuffDebuffInputs.DEBUFFS_MISC_CONFIG, this.simUI);
		if (miscDebuffOptions.length) {
			new MultiIconPicker(
				contentBlock.bodyElement,
				this.simUI.player,
				{
					inputs: miscDebuffOptions.map(options => options.config),
					label: i18n.t('settings_tab.debuffs.misc.label'),
				},
				this.simUI,
			);
		}
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
			setData: (eventID: EventID, encounter: Encounter, newEncounter: SavedEncounter) => encounter.fromProto(eventID, newEncounter.encounter!),
			changeEmitters: [this.simUI.sim.encounter.changeEmitter],
			equals: (a: SavedEncounter, b: SavedEncounter) => SavedEncounter.equals(a, b),
			toJson: (a: SavedEncounter) => SavedEncounter.toJson(a),
			fromJson: (obj: any) => SavedEncounter.fromJson(obj),
		});

		const savedSettingsManager = new SavedDataManager<IndividualSimUI<any>, SavedSettings>(this.rightPanel, this.simUI, {
			label: i18n.t('settings_tab.saved_settings.settings'),
			header: { title: i18n.t('settings_tab.saved_settings.title') },
			nameLabel: i18n.t('settings_tab.saved_settings.settings_name'),
			saveButtonText: i18n.t('settings_tab.saved_settings.save_settings'),
			storageKey: this.simUI.getSavedSettingsStorageKey(),
			getData: () => {
				return this.getCurrentSavedSettings();
			},
			setData: (eventID: EventID, simUI: IndividualSimUI<any>, newSettings: SavedSettings) => {
				TypedEvent.freezeAllAndDo(() => {
					simUI.sim.raid.setBuffs(eventID, newSettings.raidBuffs || RaidBuffs.create());
					simUI.sim.raid.setDebuffs(eventID, newSettings.debuffs || Debuffs.create());
					const party = simUI.player.getParty();
					if (party) {
						party.setBuffs(eventID, newSettings.partyBuffs || PartyBuffs.create());
					}
					simUI.player.setBuffs(eventID, newSettings.playerBuffs || IndividualBuffs.create());

					simUI.player.setConsumes(eventID, newSettings.consumables || ConsumesSpec.create());

					simUI.player.setRace(eventID, newSettings.race);
					simUI.player.setProfessions(eventID, newSettings.professions);
					simUI.player.itemSwapSettings.setItemSwapSettings(
						eventID,
						newSettings.enableItemSwap,
						simUI.sim.db.lookupItemSwap(newSettings.itemSwap || ItemSwap.create()),
						Stats.fromProto(newSettings.itemSwap?.prepullBonusStats),
					);
					simUI.player.setReactionTime(eventID, newSettings.reactionTimeMs);
					simUI.player.setChannelClipDelay(eventID, newSettings.channelClipDelayMs);
					simUI.player.setInFrontOfTarget(eventID, newSettings.inFrontOfTarget);
					simUI.player.setDistanceFromTarget(eventID, newSettings.distanceFromTarget);
					simUI.player.setHealingModel(eventID, newSettings.healingModel || HealingModel.create());
					simUI.player.setChallengeModeEnabled(eventID, newSettings.challengeMode);
				});
			},
			changeEmitters: [
				this.simUI.sim.raid.buffsChangeEmitter,
				this.simUI.sim.raid.debuffsChangeEmitter,
				this.simUI.player.getParty()!.buffsChangeEmitter,
				this.simUI.player.buffsChangeEmitter,
				this.simUI.player.consumesChangeEmitter,
				this.simUI.player.raceChangeEmitter,
				this.simUI.player.professionChangeEmitter,
				this.simUI.player.itemSwapSettings.changeEmitter,
				this.simUI.player.miscOptionsChangeEmitter,
				this.simUI.player.inFrontOfTargetChangeEmitter,
				this.simUI.player.distanceFromTargetChangeEmitter,
				this.simUI.player.healingModelChangeEmitter,
			],
			equals: (a: SavedSettings, b: SavedSettings) => SavedSettings.equals(a, b),
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
						professions: settings.playerOptions?.profession1 && settings.playerOptions?.profession2
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
						...this.getCurrentSavedSettings(),
						enableItemSwap: true,
						itemSwap: presetItemSwap.itemSwap,
					}),
				});
			});
		});
	}

	getCurrentSavedSettings() {
		return SavedSettings.create({
			raidBuffs: this.simUI.sim.raid.getBuffs(),
			partyBuffs: this.simUI.player.getParty()?.getBuffs() || PartyBuffs.create(),
			playerBuffs: this.simUI.player.getBuffs(),
			debuffs: this.simUI.sim.raid.getDebuffs(),
			consumables: this.simUI.player.getConsumes(),
			race: this.simUI.player.getRace(),
			professions: this.simUI.player.getProfessions(),
			enableItemSwap: this.simUI.player.itemSwapSettings.getEnableItemSwap(),
			itemSwap: this.simUI.player.itemSwapSettings.toProto(),
			reactionTimeMs: this.simUI.player.getReactionTime(),
			channelClipDelayMs: this.simUI.player.getChannelClipDelay(),
			inFrontOfTarget: this.simUI.player.getInFrontOfTarget(),
			distanceFromTarget: this.simUI.player.getDistanceFromTarget(),
			healingModel: this.simUI.player.getHealingModel(),
			challengeMode: this.simUI.player.getChallengeModeEnabled(),
		});
	}

	private configureInputSection(sectionElem: HTMLElement, sectionConfig: InputSection) {
		sectionConfig.inputs.forEach(inputConfig => {
			if (inputConfig.type == 'number') {
				new NumberPicker(sectionElem, this.simUI.player, inputConfig);
			} else if (inputConfig.type == 'boolean') {
				new BooleanPicker(sectionElem, this.simUI.player, { ...inputConfig, reverse: true });
			} else if (inputConfig.type == 'enum') {
				new EnumPicker(sectionElem, this.simUI.player, inputConfig);
			}
		});
	}

	private configureIconSection(sectionElem: HTMLElement, iconPickers: Array<any>, adjustColumns?: boolean) {
		if (iconPickers.length == 0) {
			sectionElem.classList.add('hide');
		} else if (adjustColumns) {
			if (iconPickers.length <= 4) {
				sectionElem.style.gridTemplateColumns = `repeat(${iconPickers.length}, 1fr)`;
			} else if (iconPickers.length > 4 && iconPickers.length < 8) {
				sectionElem.style.gridTemplateColumns = `repeat(${Math.ceil(iconPickers.length / 2)}, 1fr)`;
			}
		}
	}
}

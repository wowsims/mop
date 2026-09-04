import { PresetConfigurationCategory } from '@domain/constants/preset_categories';
import { Player } from '@domain/player';
import { batch } from '@domain/state/batch';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import { classTalentsConfig } from '@domain/talents/factory';
import { TalentsPicker } from '@features/talents/view/talents_picker';
import { Class, Glyphs, Spec } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { PetSpecPicker } from '@ui-kit/pickers/pet_spec_picker';
import { SavedDataManager } from '@ui-kit/saved_data_manager';
import { SimTab } from '@ui-kit/sim_tab';

import { trackEvent } from '../../tracking/utils';
import { IndividualSimUI } from '../individual_sim_ui';
import { PresetConfigurationPicker } from '../preset_configuration_picker';
export class TalentsTab<SpecType extends Spec> extends SimTab {
	protected simUI: IndividualSimUI<any>;

	readonly leftPanel: HTMLElement;
	readonly rightPanel: HTMLElement;

	constructor(parentElem: HTMLElement, simUI: IndividualSimUI<SpecType>) {
		super(parentElem, simUI, { identifier: 'talents-tab', title: i18n.t('talents_tab.title') });
		this.simUI = simUI;

		this.leftPanel = (<div className="talents-tab-left tab-panel-left" />) as HTMLElement;
		this.rightPanel = (<div className="talents-tab-right tab-panel-right" />) as HTMLElement;

		this.contentContainer.appendChild(this.leftPanel);
		this.contentContainer.appendChild(this.rightPanel);

		this.buildTabContent();
	}

	protected buildTabContent() {
		this.buildTalentsPicker(this.leftPanel);

		this.buildPresetConfigurationPicker();
		this.buildSavedTalentsPicker();

		this.buildHunterPetPicker(this.leftPanel);
	}
	private buildHunterPetPicker(parentElem: HTMLElement) {
		if (this.simUI.player.isClass(Class.ClassHunter)) {
			new PetSpecPicker(parentElem, this.simUI.player);
		}
	}
	private buildTalentsPicker(parentElem: HTMLElement) {
		new TalentsPicker(parentElem, this.simUI.player, {
			playerClass: this.simUI.player.getClass(),
			playerSpec: this.simUI.player.getSpec(),
			tree: classTalentsConfig[this.simUI.player.getClass()]!,
			storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'talentsString'),
			getValue: (player: Player<any>) => player.getTalentsString(),
			setValue: (player: Player<any>, newValue: string) => {
				trackEvent({
					action: 'settings',
					category: 'talents',
					label: 'update',
				});
				player.setTalentsString(newValue);
			},
		});
	}

	private buildPresetConfigurationPicker() {
		new PresetConfigurationPicker(this.rightPanel, this.simUI, [PresetConfigurationCategory.Talents]);
	}

	private buildSavedTalentsPicker() {
		const savedTalentsManager = new SavedDataManager<Player<any>, SavedTalents>(this.rightPanel, this.simUI.player, {
			label: i18n.t('talents_tab.saved_talents.label'),
			header: { title: i18n.t('talents_tab.saved_talents.title') },
			storageKey: this.simUI.getSavedTalentsStorageKey(),
			getData: (player: Player<any>) =>
				SavedTalents.create({
					talentsString: player.getTalentsString(),
					glyphs: player.getGlyphs(),
				}),
			setData: (player: Player<any>, newTalents: SavedTalents) => {
				batch(() => {
					player.setTalentsString(newTalents.talentsString);
					player.setGlyphs(newTalents.glyphs || Glyphs.create());
				});
			},
			subscribe: subscribeAll([subscribePlayerField(this.simUI.player, 'talentsString'), subscribePlayerField(this.simUI.player, 'glyphs')]),
			toJson: (a: SavedTalents) => SavedTalents.toJson(a),
			fromJson: (obj: any) => SavedTalents.fromJson(obj),
			nameLabel: i18n.t('talents_tab.saved_talents.name_label'),
			saveButtonText: i18n.t('talents_tab.saved_talents.save_button'),
			deleteTooltip: i18n.t('talents_tab.saved_talents.delete.tooltip'),
			deleteConfirmMessage: i18n.t('talents_tab.saved_talents.delete.confirm'),
			chooseNameAlert: i18n.t('talents_tab.saved_talents.alerts.choose_name'),
			nameExistsAlert: i18n.t('talents_tab.saved_talents.alerts.name_exists'),
		});

		this.simUI.sim.waitForInit().then(() => {
			savedTalentsManager.loadUserData();
			this.simUI.individualConfig.presets.talents.forEach(config => {
				config.isPreset = true;
				savedTalentsManager.addSavedData({
					name: config.name,
					isPreset: true,
					data: config.data,
					onLoad: config.onLoad,
				});
			});
		});
	}
}

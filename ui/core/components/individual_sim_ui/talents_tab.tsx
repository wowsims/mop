import i18n from '../../../i18n/config';
import { trackEvent } from '../../../tracking/utils';
import { IndividualSimUI } from '../../individual_sim_ui';
import { Player } from '../../player';
import { Class, Glyphs, Spec } from '../../proto/common';
import { SavedTalents } from '../../proto/ui';
import { classTalentsConfig } from '../../talents/factory';
import { TalentsPicker } from '../../talents/talents_picker';
import { EventID, TypedEvent } from '../../typed_event';
import { PetSpecPicker } from '../pickers/pet_spec_picker';
import { SavedDataManager } from '../saved_data_manager';
import { SimTab } from '../sim_tab';
import { PresetConfigurationCategory, PresetConfigurationPicker } from './preset_configuration_picker';

export class TalentsTab<SpecType extends Spec> extends SimTab {
	protected simUI: IndividualSimUI<any>;

	readonly leftPanel: HTMLElement;
	readonly rightPanel: HTMLElement;

	constructor(parentElem: HTMLElement, simUI: IndividualSimUI<SpecType>) {
		super(parentElem, simUI, { identifier: 'talents-tab', title: i18n.t('talents_tab.title') });
		this.simUI = simUI;

		this.leftPanel = (<div className="talents-tab-left tab-panel-left" />) as HTMLElement;
		this.rightPanel = (<div className="talents-tab-right tab-panel-right within-raid-sim-hide" />) as HTMLElement;

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
			changedEvent: (player: Player<any>) => player.talentsChangeEmitter,
			getValue: (player: Player<any>) => player.getTalentsString(),
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				trackEvent({
					action: 'settings',
					category: 'talents',
					label: 'update',
				});
				player.setTalentsString(eventID, newValue);
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
			setData: (eventID: EventID, player: Player<any>, newTalents: SavedTalents) => {
				TypedEvent.freezeAllAndDo(() => {
					player.setTalentsString(eventID, newTalents.talentsString);
					player.setGlyphs(eventID, newTalents.glyphs || Glyphs.create());
				});
			},
			changeEmitters: [this.simUI.player.talentsChangeEmitter, this.simUI.player.glyphsChangeEmitter],
			equals: (a: SavedTalents, b: SavedTalents) => SavedTalents.equals(a, b),
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

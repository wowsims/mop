import { isEqualAPLRotation } from '../../proto_utils/apl_utils';
import clsx from 'clsx';

import i18n from '../../../i18n/config';
import { IndividualSimUI, InputSection } from '../../individual_sim_ui';
import { Player } from '../../player';
import { APLRotation, APLRotation_Type as APLRotationType } from '../../proto/apl';
import { SavedRotation } from '../../proto/ui';
import { batch, EventID } from '../../state/batch';
import { subscribeAll, subscribePlayerField } from '../../state/subscriptions';
import { omitDeep } from '../../utils';
import { ContentBlock } from '../content_block';
import * as IconInputs from '../icon_inputs';
import { Input } from '../input';
import { BooleanPicker } from '../pickers/boolean_picker';
import { TextDropdownPicker } from '../pickers/dropdown_picker';
import { EnumPicker } from '../pickers/enum_picker';
import { NumberPicker } from '../pickers/number_picker';
import { SavedDataManager } from '../saved_data_manager';
import { SimTab } from '../sim_tab';
import { StickyToolbar } from '../sticky_toolbar';
import { APLGroupListPicker } from './apl/apl_group_list_picker';
import { APLVariablesListPicker } from './apl/apl_variables_list_picker';
import { APLPrePullListPicker } from './apl/pre_pull_list_picker';
import { APLPriorityListPicker } from './apl/priority_list_picker';
import { CooldownsPicker } from './cooldowns_picker';
import { PresetConfigurationCategory, PresetConfigurationPicker } from './preset_configuration_picker';
export class RotationTab extends SimTab {
	protected simUI: IndividualSimUI<any>;

	readonly autoTab: HTMLElement;
	readonly simpleTab: HTMLElement;
	readonly aplTab: HTMLElement;

	constructor(parentElem: HTMLElement, simUI: IndividualSimUI<any>) {
		super(parentElem, simUI, { identifier: 'rotation-tab', title: i18n.t('rotation_tab.title') });
		this.simUI = simUI;

		this.autoTab = (<div className="rotation-tab rotation-tab-auto" />) as HTMLElement;
		this.simpleTab = (<div className="rotation-tab rotation-tab-simple" />) as HTMLElement;
		this.aplTab = (<div className="rotation-tab rotation-tab-apl" />) as HTMLElement;

		this.contentContainer.appendChild(this.autoTab);
		this.contentContainer.appendChild(this.simpleTab);
		this.contentContainer.appendChild(this.aplTab);

		this.buildTabContent();

		this.updateSections();
		this.addOnDisposeCallback(subscribePlayerField(this.simUI.player, 'rotation')(() => this.updateSections()));
	}

	protected buildTabContent() {
		this.buildAutoTab();
		this.buildSimpleTab();
		this.buildAplTab();
	}

	private buildAutoTab() {
		const leftCol = (<div className="rotation-tab-col tab-panel-left" />) as HTMLElement;
		const rightCol = (<div className="rotation-tab-col tab-panel-right" />) as HTMLElement;

		this.autoTab.appendChild(leftCol);
		this.autoTab.appendChild(rightCol);

		this.buildRotationTypePicker(leftCol);
		leftCol.appendChild(<p>{i18n.t('rotation_tab.auto.description')}</p>);

		this.buildPresetConfigurationPicker(rightCol);
		this.buildSavedDataPickers(rightCol);
	}

	private buildSimpleTab() {
		if (!this.simUI.player.hasSimpleRotationGenerator() || !this.simUI.individualConfig.rotationInputs) {
			return;
		}

		const leftCol = (<div className="rotation-tab-col tab-panel-left tab-content" />) as HTMLElement;
		const rightCol = (<div className="rotation-tab-col tab-panel-right" />) as HTMLElement;

		this.simpleTab.appendChild(leftCol);
		this.simpleTab.appendChild(rightCol);

		this.buildRotationTypePicker(leftCol);
		this.buildPresetConfigurationPicker(rightCol);
		this.buildSavedDataPickers(rightCol);

		const container = (<div className="simple-rotation-container" />) as HTMLElement;
		leftCol.appendChild(container);

		const rotationBlock = new ContentBlock(container, 'rotation-settings', {
			header: { title: i18n.t('rotation_tab.simple.title') },
		});

		const rotationIconGroup = Input.newGroupContainer();
		rotationIconGroup.classList.add('rotation-icon-group', 'icon-group');
		rotationBlock.bodyElement.appendChild(rotationIconGroup);

		if (this.simUI.individualConfig.rotationIconInputs?.length) {
			this.configureIconSection(
				rotationIconGroup,
				this.simUI.individualConfig.rotationIconInputs.map(iconInput => IconInputs.buildIconInput(rotationIconGroup, this.simUI.player, iconInput)),
				true,
			);
		}

		this.configureInputSection(rotationBlock.bodyElement, this.simUI.individualConfig.rotationInputs);

		const cooldownsBlock = new ContentBlock(container, 'cooldown-settings', {
			header: { title: i18n.t('rotation_tab.cooldowns.title'), tooltip: i18n.t('rotation_tab.cooldowns.tooltip') },
		});
		new CooldownsPicker(cooldownsBlock.bodyElement, this.simUI.player);
	}

	private buildAplTab() {
		const navbar = this.aplTab.appendChild(<div className="apl-rotation-navbar" />) as HTMLElement;
		new StickyToolbar(navbar, this.simUI);
		this.buildRotationTypePicker(navbar);

		const navTabs = navbar.appendChild(<ul className="nav nav-tabs" attributes={{ role: 'tablist' }} />) as HTMLUListElement;
		const leftCol = this.aplTab.appendChild(<div className="rotation-tab-col tab-panel-left tab-content" />) as HTMLElement;
		const rightCol = this.aplTab.appendChild(<div className="rotation-tab-col tab-panel-right" />) as HTMLElement;

		const priorityListTab = this.buildAPLTab(navTabs, leftCol, i18n.t('rotation_tab.apl.tabs.priorityList'), 'apl-priority-list', true);
		const actionGroupsTab = this.buildAPLTab(navTabs, leftCol, i18n.t('rotation_tab.apl.tabs.actionGroups'), 'apl-action-groups');
		const variablesTab = this.buildAPLTab(navTabs, leftCol, i18n.t('rotation_tab.apl.tabs.variables'), 'apl-variables');

		new APLPrePullListPicker(priorityListTab, this.simUI);
		new APLPriorityListPicker(priorityListTab, this.simUI);
		new APLGroupListPicker(actionGroupsTab, this.simUI);
		new APLVariablesListPicker(variablesTab, this.simUI);

		this.buildPresetConfigurationPicker(rightCol);
		this.buildSavedDataPickers(rightCol);

		// new APLRotationPicker(this.aplTab, this.simUI, this.simUI.player);
	}

	private buildAPLTab(tabsContainer: HTMLElement, container: HTMLElement, label: string, tabId: string, isActive = false): HTMLElement {
		tabsContainer.appendChild(
			<li className="nav-item" attributes={{ role: 'presentation' }}>
				<button
					className={clsx({
						'nav-link': true,
						active: isActive,
					})}
					type="button"
					attributes={{
						role: 'tab',
						// @ts-expect-error
						'aria-controls': tabId,
						'aria-selected': !!isActive,
					}}
					dataset={{
						bsToggle: 'tab',
						bsTarget: `#${tabId}`,
					}}>
					{label}
				</button>
			</li>,
		) as HTMLLIElement;

		const tabContent = container.appendChild(
			<div
				id={tabId}
				className={clsx({
					'tab-pane fade': true,
					'active show': isActive,
				})}
			/>,
		) as HTMLElement;

		return tabContent;
	}

	private updateSections() {
		this.rootElem.classList.remove('rotation-type-auto', 'rotation-type-simple', 'rotation-type-apl');

		const rotationType = this.simUI.player.getRotationType();
		let rotationClass = '';
		switch (rotationType) {
			case APLRotationType.TypeAuto:
				rotationClass = 'rotation-type-auto';
				break;
			case APLRotationType.TypeSimple:
				rotationClass = 'rotation-type-simple';
				break;
			case APLRotationType.TypeAPL:
				rotationClass = 'rotation-type-apl';
				break;
		}

		this.rootElem.classList.add(rotationClass);
	}

	private configureInputSection(sectionElem: HTMLElement, sectionConfig: InputSection) {
		sectionConfig.inputs.forEach(inputConfig => {
			inputConfig.extraCssClasses = [...(inputConfig.extraCssClasses || []), 'input-inline'];
			if (inputConfig.type == 'number') {
				new NumberPicker(sectionElem, this.simUI.player, { ...inputConfig, inline: true });
			} else if (inputConfig.type == 'boolean') {
				new BooleanPicker(sectionElem, this.simUI.player, { ...inputConfig, inline: true, reverse: true });
			} else if (inputConfig.type == 'enum') {
				new EnumPicker(sectionElem, this.simUI.player, { ...inputConfig, inline: true });
			}
		});
	}

	private configureIconSection(sectionElem: HTMLElement, iconPickers: Array<any>, adjustColumns?: boolean) {
		if (!iconPickers.length) {
			sectionElem.classList.add('hide');
		} else if (adjustColumns) {
			if (iconPickers.length <= 4) {
				sectionElem.style.gridTemplateColumns = `repeat(${iconPickers.length}, 1fr)`;
			} else if (iconPickers.length > 4 && iconPickers.length < 8) {
				sectionElem.style.gridTemplateColumns = `repeat(${Math.ceil(iconPickers.length / 2)}, 1fr)`;
			}
		}
	}

	private buildRotationTypePicker(parent: HTMLElement) {
		const container = (<div className="rotation-type-container" />) as HTMLElement;
		parent.appendChild(container);

		new TextDropdownPicker(container, this.simUI.player, {
			id: 'rotation-tab-rotation-type',
			defaultLabel: '',
			values: this.simUI.player.hasSimpleRotationGenerator()
				? [
						{ value: APLRotationType.TypeAuto, label: i18n.t('rotation_tab.common.rotation_type.auto') },
						{ value: APLRotationType.TypeSimple, label: i18n.t('rotation_tab.common.rotation_type.simple') },
						{ value: APLRotationType.TypeAPL, label: i18n.t('rotation_tab.common.rotation_type.apl') },
					]
				: [
						{ value: APLRotationType.TypeAuto, label: i18n.t('rotation_tab.common.rotation_type.auto') },
						{ value: APLRotationType.TypeAPL, label: i18n.t('rotation_tab.common.rotation_type.apl') },
					],
			equals: (a, b) => a === b,
			storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'rotation'),
			getValue: (player: Player<any>) => player.getRotationType(),
			setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
				player.modifyAplRotation(eventID, rotation => {
					rotation.type = newValue;
				});
			},
		});
	}

	private buildPresetConfigurationPicker(parent: HTMLElement) {
		new PresetConfigurationPicker(parent, this.simUI, [PresetConfigurationCategory.Rotation]);
	}

	private buildSavedDataPickers(parent: HTMLElement) {
		const savedRotationsManager = new SavedDataManager<Player<any>, SavedRotation>(parent, this.simUI.player, {
			label: i18n.t('rotation_tab.saved_rotations.label'),
			header: { title: i18n.t('rotation_tab.saved_rotations.title') },
			storageKey: this.simUI.getSavedRotationStorageKey(),
			getData: (player: Player<any>) =>
				SavedRotation.create({
					rotation: player.getResolvedAplRotation(),
				}),
			setData: (eventID: EventID, player: Player<any>, newRotation: SavedRotation) =>
				batch(() => {
					player.setAplRotation(eventID, newRotation.rotation || APLRotation.create());
				}),
			subscribe: subscribeAll([subscribePlayerField(this.simUI.player, 'rotation'), subscribePlayerField(this.simUI.player, 'talentsString')]),
			// Semantic: Auto and APL types match, simple rotations compare by content.
			equals: (a: SavedRotation, b: SavedRotation) => isEqualAPLRotation(this.simUI.player, a.rotation, b.rotation),
			toJson: (a: SavedRotation) => SavedRotation.toJson(a),
			fromJson: (obj: any) => omitDeep(SavedRotation.fromJson(obj), ['uuid']),
			nameLabel: i18n.t('rotation_tab.saved_rotations.name_label'),
			saveButtonText: i18n.t('rotation_tab.saved_rotations.save_button'),
			deleteTooltip: i18n.t('rotation_tab.saved_rotations.delete.tooltip'),
			deleteConfirmMessage: i18n.t('rotation_tab.saved_rotations.delete.confirm'),
			chooseNameAlert: i18n.t('rotation_tab.saved_rotations.alerts.choose_name'),
			nameExistsAlert: i18n.t('rotation_tab.saved_rotations.alerts.name_exists'),
		});

		this.simUI.sim.waitForInit().then(() => {
			if (this.isDisposed) return;
			savedRotationsManager.loadUserData();
			(this.simUI.individualConfig.presets.rotations || []).forEach(presetRotation => {
				const rotData = presetRotation.rotation;
				// Fill default values so the equality checks always work.
				if (!rotData.rotation) rotData.rotation = APLRotation.create();
				savedRotationsManager.addSavedData({
					name: presetRotation.name,
					tooltip: presetRotation.tooltip,
					isPreset: true,
					data: rotData,
					enableWhen: presetRotation.enableWhen,
					onLoad: presetRotation.onLoad,
				});
			});
		});
	}
}

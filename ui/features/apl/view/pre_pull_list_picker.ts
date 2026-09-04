import { Player } from '@domain/player';
import { subscribePlayerField } from '@domain/state/subscriptions';
import { randomUUID } from '@domain/utils';
import { APLAction, APLPrepullAction, APLValue } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { Input } from '@ui-kit/input';
import { ListItemPickerConfig, ListPicker } from '@ui-kit/pickers/list_picker';

import type { IndividualSimHost } from '../../sim_host';
import { APLActionPicker } from './apl_actions';
import { APLValuePicker } from './apl_values';
import { APLHidePicker } from './hide_picker';
export class APLPrePullListPicker extends Component {
	constructor(container: HTMLElement, simUI: IndividualSimHost<any>) {
		super(container, 'apl-pre-pull-list-picker-root');

		new ListPicker<Player<any>, APLPrepullAction>(this.rootElem, simUI.player, {
			title: i18n.t('rotation_tab.apl.prePullActions.header'),
			titleTooltip: i18n.t('rotation_tab.apl.prePullActions.tooltips.overview'),
			extraCssClasses: ['apl-list-item-picker', 'apl-prepull-action-picker'],
			itemLabel: i18n.t('rotation_tab.apl.prePullActions.name'),
			storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'rotation'),
			getValue: (player: Player<any>) => player.aplRotation.prepullActions,
			setValue: (player: Player<any>, newValue: Array<APLPrepullAction>) => {
				player.modifyAplRotation(rotation => {
					rotation.prepullActions = newValue;
				});
			},
			newItem: () =>
				APLPrepullAction.create({
					action: {},
					doAtValue: {
						value: { oneofKind: 'const', const: { val: '-1s' } },
					},
				}),
			copyItem: (oldItem: APLPrepullAction) => APLPrepullAction.clone(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				_: ListPicker<Player<any>, APLPrepullAction>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLPrepullAction>,
			) => new APLPrepullActionPicker(parent, simUI.player, config, index),
			allowedActions: ['create', 'copy', 'delete', 'move'],
			inlineMenuBar: true,
		});
	}
}

class APLPrepullActionPicker extends Input<Player<any>, APLPrepullAction> {
	private readonly player: Player<any>;
	private readonly hidePicker: Input<Player<any>, boolean>;
	private readonly doAtPicker: Input<Player<any>, APLValue | undefined>;
	private readonly actionPicker: APLActionPicker;

	constructor(parent: HTMLElement, player: Player<any>, config: ListItemPickerConfig<Player<any>, APLPrepullAction>, index: number) {
		config.enableWhen = () => !this.getItem().hide;
		super(parent, 'apl-list-item-picker-root', player, config);
		this.player = player;

		const itemHeaderElem = ListPicker.getItemHeaderElem(this);
		ListPicker.makeListItemValidations(itemHeaderElem, player, player => player.getCurrentStats().rotationStats?.prepullActions[index]?.validations || []);

		this.hidePicker = this.addChild(
			new APLHidePicker(itemHeaderElem, player, {
				getValue: () => this.getItem().hide,
				setValue: (player: Player<any>, newValue: boolean) => {
					this.getItem().hide = newValue;
					this.player.touchRotation();
				},
			}),
		);

		this.doAtPicker = this.addChild(
			new APLValuePicker(this.rootElem, this.player, {
				id: randomUUID(),
				label: i18n.t('rotation_tab.apl.prepull_actions.do_at.label'),
				labelTooltip: i18n.t('rotation_tab.apl.prepull_actions.do_at.tooltip'),
				extraCssClasses: ['apl-prepull-actions-doat'],
				getValue: () => this.getItem().doAtValue,
				setValue: (player: Player<any>, newValue: APLValue | undefined) => {
					if (newValue) {
						this.getItem().doAtValue = newValue;
					} else {
						this.getItem().doAtValue = APLValue.create({
							value: { oneofKind: 'const', const: { val: '-1s' } },
							uuid: { value: randomUUID() },
						});
					}
					this.player.touchRotation();
				},
				inline: true,
			}),
		);

		this.actionPicker = this.addChild(
			new APLActionPicker(this.rootElem, this.player, {
				getValue: () => this.getItem().action!,
				setValue: (player: Player<any>, newValue: APLAction) => {
					this.getItem().action = newValue;
					this.player.touchRotation();
				},
			}),
		);
		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLPrepullAction {
		const item = APLPrepullAction.create({
			hide: this.hidePicker.getInputValue(),
			doAtValue: this.doAtPicker.getInputValue(),
			action: this.actionPicker.getInputValue(),
		});
		return item;
	}

	setInputValue(newValue: APLPrepullAction) {
		if (!newValue) {
			return;
		}
		this.hidePicker.setInputValue(newValue.hide);
		this.doAtPicker.setInputValue(newValue.doAtValue);
		this.actionPicker.setInputValue(newValue.action || APLAction.create());
	}

	private getItem(): APLPrepullAction {
		return (
			this.getSourceValue() ||
			APLPrepullAction.create({
				action: {},
			})
		);
	}
}

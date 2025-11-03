import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { Player } from '../../../player';
import { APLAction, APLPrepullAction, APLValue } from '../../../proto/apl';
import { EventID } from '../../../typed_event';
import { randomUUID } from '../../../utils';
import { Component } from '../../component';
import { Input } from '../../input';
import { ListItemPickerConfig, ListPicker } from '../../pickers/list_picker';
import { AdaptiveStringPicker } from '../../pickers/string_picker';
import { APLActionPicker } from '../apl_actions';
import { APLValueImplStruct } from '../apl_values';
import { APLHidePicker } from './hide_picker';

export class APLPrePullListPicker extends Component {
	constructor(container: HTMLElement, simUI: IndividualSimUI<any>) {
		super(container, 'apl-pre-pull-list-picker-root');

		new ListPicker<Player<any>, APLPrepullAction>(this.rootElem, simUI.player, {
			title: i18n.t('rotation_tab.apl.prePullActions.header'),
			titleTooltip: i18n.t('rotation_tab.apl.prePullActions.tooltips.overview'),
			extraCssClasses: ['apl-list-item-picker', 'apl-prepull-action-picker'],
			itemLabel: i18n.t('rotation_tab.apl.prePullActions.name'),
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => player.aplRotation.prepullActions,
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLPrepullAction>) => {
				player.aplRotation.prepullActions = newValue;
				player.rotationChangeEmitter.emit(eventID);
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
	private readonly doAtPicker: Input<Player<any>, string>;
	private readonly actionPicker: APLActionPicker;

	constructor(parent: HTMLElement, player: Player<any>, config: ListItemPickerConfig<Player<any>, APLPrepullAction>, index: number) {
		config.enableWhen = () => !this.getItem().hide;
		super(parent, 'apl-list-item-picker-root', player, config);
		this.player = player;

		const itemHeaderElem = ListPicker.getItemHeaderElem(this);
		ListPicker.makeListItemValidations(itemHeaderElem, player, player => player.getCurrentStats().rotationStats?.prepullActions[index]?.validations || []);

		this.hidePicker = new APLHidePicker(itemHeaderElem, player, {
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => this.getItem().hide,
			setValue: (eventID: EventID, player: Player<any>, newValue: boolean) => {
				this.getItem().hide = newValue;
				this.player.rotationChangeEmitter.emit(eventID);
			},
		});

		this.doAtPicker = new AdaptiveStringPicker(this.rootElem, this.player, {
			id: randomUUID(),
			label: i18n.t('rotation_tab.apl.prepull_actions.do_at.label'),
			labelTooltip: i18n.t('rotation_tab.apl.prepull_actions.do_at.tooltip'),
			extraCssClasses: ['apl-prepull-actions-doat'],
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => (this.getItem().doAtValue?.value as APLValueImplStruct<'const'> | undefined)?.const.val || '',
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				if (newValue) {
					this.getItem().doAtValue = APLValue.create({
						value: { oneofKind: 'const', const: { val: newValue } },
						uuid: { value: randomUUID() },
					});
				} else {
					this.getItem().doAtValue = undefined;
				}
				this.player.rotationChangeEmitter.emit(eventID);
			},
			inline: true,
		});

		this.actionPicker = new APLActionPicker(this.rootElem, this.player, {
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => this.getItem().action!,
			setValue: (eventID: EventID, player: Player<any>, newValue: APLAction) => {
				this.getItem().action = newValue;
				this.player.rotationChangeEmitter.emit(eventID);
			},
		});
		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLPrepullAction {
		const item = APLPrepullAction.create({
			hide: this.hidePicker.getInputValue(),
			doAtValue: {
				value: { oneofKind: 'const', const: { val: this.doAtPicker.getInputValue() } },
			},
			action: this.actionPicker.getInputValue(),
		});
		return item;
	}

	setInputValue(newValue: APLPrepullAction) {
		if (!newValue) {
			return;
		}
		this.hidePicker.setInputValue(newValue.hide);
		this.doAtPicker.setInputValue((newValue.doAtValue?.value as APLValueImplStruct<'const'> | undefined)?.const.val || '');
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

import { CacheHandler } from '@domain/cache_handler';
import { Player, UnitMetadata } from '@domain/player';
import { ActionId, defaultTargetIcon, getPetIconFromName } from '@domain/proto_utils/action_id';
import { renameAPLReference } from '@domain/proto_utils/apl_utils';
import { subscribePlayerField, subscribeUnitMetadata } from '@domain/state/subscriptions';
import { getEnumValues, randomUUID } from '@domain/utils';
import {
	APLActionDamageAmplifier_AmplificationType,
	APLActionGuardianHotwDpsRotation_Strategy as HotwStrategy,
	APLActionItemSwap_SwapSet as ItemSwapSet,
	APLValue,
	APLValueEclipsePhase,
	APLValueRuneSlot,
	APLValueRuneType,
	APLValueVariable,
} from '@generated/proto/apl';
import { ActionID, Stat, UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import { FeralDruid_Rotation_AplType } from '@generated/proto/druid';
import i18n from '@i18n/config';
import { translateStat } from '@i18n/localization';
import { Input, InputConfig } from '@ui-kit/input';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';
import { DropdownPicker, DropdownPickerConfig, DropdownValueConfig, TextDropdownPicker } from '@ui-kit/pickers/dropdown_picker';
import { ListItemPickerConfig, ListPicker, ListPickerExtraAction } from '@ui-kit/pickers/list_picker';
import { NumberPicker, NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import { AdaptiveStringPicker } from '@ui-kit/pickers/string_picker';
import { UnitPicker, UnitPickerConfig, UnitValue } from '@ui-kit/pickers/unit_picker';
import { ref } from 'tsx-vanilla';

import { setActionIdBackgroundAndHref, setActionIdWowheadDataset } from '../../gear/view/action_id_dom';
import { ACTION_ID_SET, actionIdSets } from '../model/action_id_sets';
import { CommonFieldDescriptor, DEFAULT_UNIT_REF } from '../model/field_descriptors';
import { UNIT_SET, unitSets } from '../model/unit_sets';
import { APLNameModal } from './apl_name_modal';

export type { DEFAULT_UNIT_REF };

export interface APLActionIDPickerConfig<ModObject> extends Omit<
	DropdownPickerConfig<ModObject, ActionID, ActionId>,
	'defaultLabel' | 'equals' | 'setOptionContent' | 'values' | 'getValue' | 'setValue'
> {
	actionIdSet: ACTION_ID_SET;
	getUnitRef: (player: Player<any>) => UnitReference;
	defaultUnitRef: DEFAULT_UNIT_REF;
	getValue: (obj: ModObject) => ActionID;
	setValue: (obj: ModObject, newValue: ActionID) => void;
}

const cachedAPLActionIDPickerContent = new CacheHandler<Element>();

export class APLActionIDPicker extends DropdownPicker<Player<any>, ActionID, ActionId> {
	constructor(parent: HTMLElement, player: Player<any>, config: APLActionIDPickerConfig<Player<any>>) {
		const actionIdSet = actionIdSets[config.actionIdSet];
		super(parent, player, {
			...config,
			sourceToValue: (src: ActionID) => (src ? ActionId.fromProto(src) : ActionId.fromEmpty()),
			// A field the user never filled in has no selection at all: an empty ActionID matches no
			// option and `createMissingValue` deliberately never resolves for it, so
			// `getInputValue()` reads `undefined` here. The action-kind swap pre-fill reads the old
			// kind's fields that way (Cast without a spell -> Sequence), so hand back the same empty
			// proto that `actionIdFieldConfig`'s `newValue()` makes instead of throwing.
			valueToSource: (val: ActionId | undefined) => (val ? val.toProto() : ActionID.create()),
			defaultLabel: actionIdSet.defaultLabel,
			equals: (a, b) => (a == null) == (b == null) && (!a || a.equals(b!)),
			setOptionContent: (button, valueConfig) => {
				const actionId = valueConfig.value;
				const isAuraType = ['auras', 'stackable_auras', 'icd_auras', 'exclusive_effect_auras'].includes(config.actionIdSet);

				const cacheKey = `${actionId.toString()}${isAuraType}`;
				const cachedContent = cachedAPLActionIDPickerContent.get(cacheKey)?.cloneNode(true) as Element | undefined;
				if (cachedContent) {
					button.appendChild(cachedContent);
				}

				const iconRef = ref<HTMLAnchorElement>();
				const content = (
					<>
						<a
							ref={iconRef}
							className="apl-actionid-item-icon"
							dataset={{
								whtticon: false,
							}}
						/>
						{actionId.name}
					</>
				);
				button.appendChild(content);

				setActionIdBackgroundAndHref(actionId, iconRef.value!);
				setActionIdWowheadDataset(actionId, iconRef.value!, { useBuffAura: isAuraType });

				cachedAPLActionIDPickerContent.set(cacheKey, content);
			},
			createMissingValue: value => {
				if (value.anyId() == 0) {
					// Intentionally never resolves; empty action ids have no value to show.
					return new Promise<DropdownValueConfig<ActionId>>(() => {});
				}

				return value.fill().then(filledId => ({
					value: filledId,
				}));
			},
			values: [],
		});

		const getUnitRef = config.getUnitRef;
		const defaultRef =
			config.defaultUnitRef == 'self' ? UnitReference.create({ type: UnitType.Self }) : UnitReference.create({ type: UnitType.CurrentTarget });
		const getActionIDs = actionIdSet.getActionIDs;
		let updateSeq = 0;
		let lastMetadata: UnitMetadata | undefined;
		const updateValues = async (force: boolean) => {
			const seq = ++updateSeq;
			const unitRef = getUnitRef(player);
			const metadata = player.sim.getUnitMetadata(unitRef, player, defaultRef);
			if (!metadata) return;
			// The option list depends only on which metadata instance backs the
			// unit; a rotation edit that leaves the unit alone has nothing to do.
			if (!force && metadata === lastMetadata) return;
			lastMetadata = metadata;
			const values = await getActionIDs(metadata);
			// A newer update (or disposal) happened while awaiting: drop this one.
			if (seq !== updateSeq || this.isDisposed) return;
			this.setOptions(values);
		};
		updateValues(true);
		const unsubUnitMeta = subscribeUnitMetadata(player.sim)(() => updateValues(true));
		const unsubRotation = subscribePlayerField(player, 'rotation')(() => updateValues(false));
		this.addOnDisposeCallback(() => {
			unsubUnitMeta();
			unsubRotation();
		});
	}
}

export interface APLUnitPickerConfig extends Omit<UnitPickerConfig<Player<any>>, 'values'> {
	unitSet: UNIT_SET;
}

export class APLUnitPicker extends UnitPicker<Player<any>> {
	private readonly unitSet: UNIT_SET;

	constructor(parent: HTMLElement, player: Player<any>, config: APLUnitPickerConfig) {
		const targetUI = !!unitSets[config.unitSet].targetUI;
		super(parent, player, {
			...config,
			sourceToValue: (src: UnitReference | undefined) => APLUnitPicker.refToValue(src, player, targetUI),
			valueToSource: (val: UnitValue) => val.value,
			values: [],
			hideLabelWhenDefaultSelected: true,
		});
		this.unitSet = config.unitSet;
		this.rootElem.classList.add('apl-unit-picker');

		this.updateValues();
		const unsubUnitMeta = subscribeUnitMetadata(player.sim)(() => this.updateValues());
		this.addOnDisposeCallback(() => {
			unsubUnitMeta();
		});
	}

	private static refToValue(ref: UnitReference | undefined, thisPlayer: Player<any>, targetUI: boolean | undefined): UnitValue {
		if (!ref || ref.type == UnitType.Unknown) {
			return {
				value: ref,
				iconUrl: targetUI ? 'fa-bullseye' : 'fa-user',
				text: targetUI ? i18n.t('rotation_tab.apl.helpers.unit_labels.current_target') : i18n.t('rotation_tab.apl.helpers.unit_labels.self'),
			};
		} else if (ref.type == UnitType.Self) {
			return {
				value: ref,
				iconUrl: 'fa-user',
				text: i18n.t('rotation_tab.apl.helpers.unit_labels.self'),
			};
		} else if (ref.type == UnitType.CurrentTarget) {
			return {
				value: ref,
				iconUrl: 'fa-bullseye',
				text: i18n.t('rotation_tab.apl.helpers.unit_labels.current_target'),
			};
		} else if (ref.type == UnitType.PreviousTarget) {
			return {
				value: ref,
				iconUrl: 'fa-arrow-left',
				text: i18n.t('rotation_tab.apl.helpers.unit_labels.previous_target'),
			};
		} else if (ref.type == UnitType.NextTarget) {
			return {
				value: ref,
				iconUrl: 'fa-arrow-right',
				text: i18n.t('rotation_tab.apl.helpers.unit_labels.next_target'),
			};
		} else if (ref.type == UnitType.Player) {
			const player = thisPlayer.sim.raid.getPlayer(ref.index);
			if (player) {
				return {
					value: ref,
					iconUrl: player.getSpecIcon(),
					text: `${i18n.t('rotation_tab.apl.helpers.unit_labels.player')} ${ref.index + 1}`,
				};
			}
		} else if (ref.type == UnitType.Target) {
			const targetMetadata = thisPlayer.sim.encounter.targetsMetadata.asList()[ref.index];
			if (targetMetadata) {
				return {
					value: ref,
					iconUrl: defaultTargetIcon,
					text: `${i18n.t('rotation_tab.apl.helpers.unit_labels.target')} ${ref.index + 1}`,
				};
			}
		} else if (ref.type == UnitType.Pet) {
			const petMetadata = thisPlayer.sim.getUnitMetadata(ref, thisPlayer, UnitReference.create({ type: UnitType.Self }));
			let name = `${i18n.t('rotation_tab.apl.helpers.unit_labels.pet')} ${ref.index + 1}`;
			let icon: string | ActionId = 'fa-paw';
			if (petMetadata) {
				const petName = petMetadata.getName();
				if (petName) {
					const rmIdx = petName.indexOf(' - ');
					name = petName.substring(rmIdx + ' - '.length);
					icon = getPetIconFromName(name) || icon;
				}
			}
			return {
				value: ref,
				iconUrl: icon,
				text: name,
			};
		}

		return {
			value: ref,
		};
	}

	private updateValues() {
		const unitSet = unitSets[this.unitSet];
		const values = unitSet.getUnits(this.modObject);

		this.setOptions(
			values.map(v => {
				const valueConfig: DropdownValueConfig<UnitValue> = {
					value: APLUnitPicker.refToValue(v, this.modObject, unitSet.targetUI),
				};
				if (v && v.type == UnitType.Pet) {
					if (unitSet.targetUI) {
						valueConfig.submenu = [APLUnitPicker.refToValue(v.owner!, this.modObject, unitSet.targetUI)];
					} else {
						valueConfig.submenu = [APLUnitPicker.refToValue(undefined, this.modObject, unitSet.targetUI)];
					}
				}
				return valueConfig;
			}),
		);
	}
}

type APLPickerBuilderFieldFactory<F> = (
	parent: HTMLElement,
	player: Player<any>,
	config: InputConfig<Player<any>, F>,
	getParentValue: () => any,
) => Input<Player<any>, F>;

export interface APLPickerBuilderFieldConfig<T, F extends keyof T> {
	field: F;
	newValue: () => T[F];
	factory: APLPickerBuilderFieldFactory<T[F]>;

	label?: string;
	labelTooltip?: string;
}

export interface APLPickerBuilderConfig<T> extends InputConfig<Player<any>, T> {
	newValue: () => T;
	fields: Array<APLPickerBuilderFieldConfig<T, any>>;
}

export interface APLPickerBuilderField<T, F extends keyof T> extends APLPickerBuilderFieldConfig<T, F> {
	picker: Input<Player<any>, T[F]>;
}

export class APLPickerBuilder<T> extends Input<Player<any>, T> {
	private readonly config: APLPickerBuilderConfig<T>;
	private readonly fieldPickers: Array<APLPickerBuilderField<T, any>>;

	constructor(parent: HTMLElement, modObject: Player<any>, config: APLPickerBuilderConfig<T>) {
		super(parent, 'apl-picker-builder-root', modObject, config);
		this.config = config;

		this.fieldPickers = config.fields.map(fieldConfig => APLPickerBuilder.makeFieldPicker(this, fieldConfig));

		this.init();
	}

	private static makeFieldPicker<T, F extends keyof T>(
		builder: APLPickerBuilder<T>,
		fieldConfig: APLPickerBuilderFieldConfig<T, F>,
	): APLPickerBuilderField<T, F> {
		const field: F = fieldConfig.field;
		const picker = builder.addChild(
			fieldConfig.factory(
				builder.rootElem,
				builder.modObject,
				{
					label: fieldConfig.label,
					labelTooltip: fieldConfig.labelTooltip,
					id: randomUUID(),
					getValue: () => {
						const source = builder.getSourceValue();
						if (!source[field]) {
							source[field] = fieldConfig.newValue();
						}
						return source[field];
					},
					setValue: (player: Player<any>, newValue: any) => {
						builder.getSourceValue()[field] = newValue;
						player.touchRotation();
					},
				},
				() => builder.getSourceValue(),
			),
		);

		if (field === 'vals' || field === 'actions') {
			picker.rootElem.classList.add('apl-picker-builder-multi');
		}

		return {
			...fieldConfig,
			picker: picker,
		};
	}

	getInputElem(): HTMLElement {
		return this.rootElem;
	}

	getInputValue(): T {
		const val = this.config.newValue();
		this.fieldPickers.forEach(pickerData => {
			val[pickerData.field as keyof T] = pickerData.picker.getInputValue();
		});
		return val;
	}

	setInputValue(newValue: T) {
		this.fieldPickers.forEach(pickerData => {
			pickerData.picker.setInputValue(newValue[pickerData.field as keyof T]);
		});
	}
}

export function actionIdFieldConfig(
	field: string,
	actionIdSet: ACTION_ID_SET,
	unitRefField?: string,
	defaultUnitRef?: DEFAULT_UNIT_REF,
	options?: Partial<APLPickerBuilderFieldConfig<any, any>>,
): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => ActionID.create(),
		factory: (parent, player, config, getParentValue) =>
			new APLActionIDPicker(parent, player, {
				id: randomUUID(),
				...config,
				actionIdSet: actionIdSet,
				getUnitRef: () => (unitRefField ? getParentValue()[unitRefField] : UnitReference.create()),
				defaultUnitRef: defaultUnitRef || 'self',
			}),
		...(options || {}),
	};
}

export function unitFieldConfig(
	field: string,
	unitSet: UNIT_SET,
	options?: Partial<APLPickerBuilderFieldConfig<any, any>>,
): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => undefined,
		factory: (parent, player, config) =>
			new APLUnitPicker(parent, player, {
				id: randomUUID(),
				...config,
				unitSet: unitSet,
			}),
		...(options || {}),
	};
}

export function booleanFieldConfig(
	field: string,
	label?: string,
	options?: Partial<APLPickerBuilderFieldConfig<any, any>>,
): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => false,
		factory: (parent, player, config) => {
			config.extraCssClasses = ['input-inline'].concat(config.extraCssClasses || []);
			return new BooleanPicker(parent, player, { id: randomUUID(), ...config });
		},
		...(options || {}),
		label: label,
	};
}

export function numberFieldConfig(
	field: string,
	float: boolean,
	options?: Partial<APLPickerBuilderFieldConfig<any, any>>,
): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => 0,
		factory: (parent, player, config) => {
			const numberPickerConfig = config as NumberPickerConfig<Player<any>>;
			numberPickerConfig.float = float;
			numberPickerConfig.extraCssClasses = ['input-inline'].concat(config.extraCssClasses || []);
			return new NumberPicker(parent, player, numberPickerConfig);
		},
		...(options || {}),
	};
}

export function stringFieldConfig(field: string, options?: Partial<APLPickerBuilderFieldConfig<any, any>>): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => '',
		factory: (parent, player, config) => {
			config.extraCssClasses = ['input-inline'].concat(config.extraCssClasses || []);
			return new AdaptiveStringPicker(parent, player, { id: randomUUID(), ...config });
		},
		...(options || {}),
	};
}

export function variableNameFieldConfig(field: string, options?: Partial<APLPickerBuilderFieldConfig<any, any>>): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => '',
		factory: (parent, player, config) => {
			const picker = new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('rotation_tab.apl.helpers.select_variable'),
				equals: (a, b) => a === b,
				values: [],
			});

			const updateValues = () => {
				const variables = player.aplRotation?.valueVariables || [];
				const values = variables.map((variable: any) => ({
					value: variable.name,
					label: variable.name,
				}));

				// If no variables are defined, show a placeholder
				if (values.length === 0) {
					values.push({
						value: '',
						label: i18n.t('rotation_tab.apl.helpers.no_variables_defined'),
					});
				}

				picker.setOptions(values);
			};

			// Update values initially and when rotation changes
			updateValues();
			picker.addOnDisposeCallback(subscribePlayerField(player, 'rotation')(updateValues));

			return picker;
		},
		...(options || {}),
	};
}

export function placeholderNameFieldConfig(field: string, options?: Partial<APLPickerBuilderFieldConfig<any, any>>): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => '',
		factory: (parent, player, config, getParentValue) => {
			return new APLPlaceholderNamePicker(parent, player, config, getParentValue);
		},
		...(options || {}),
	};
}

class APLPlaceholderNamePicker extends Input<Player<any>, string> {
	private readonly nameLabel: HTMLElement;

	constructor(parent: HTMLElement, player: Player<any>, config: InputConfig<Player<any>, string>, getParentValue: () => any) {
		super(parent, 'apl-placeholder-name-picker-root', player, config);

		const container = this.rootElem.appendChild(
			<div className="apl-name-display">
				<span className="apl-name-value" />
				<button className="btn btn-link apl-name-rename" type="button">
					<i className="fas fa-pencil-alt" />
				</button>
			</div>,
		) as HTMLElement;

		this.nameLabel = container.querySelector('.apl-name-value')!;

		container.querySelector('.apl-name-rename')!.addEventListener('click', () => {
			this.openNameModal(player, getParentValue);
		});

		this.init();

		// Auto-open modal when name is empty (freshly created)
		if (!config.getValue(player)) {
			this.openNameModal(player, getParentValue, true);
		}
	}

	private findContainingGroup(player: Player<any>, parentValue: any): any | undefined {
		return player.aplRotation?.groups?.find((group: any) =>
			group.actions?.some((action: any) => {
				const found = { value: false };
				const search = (obj: any) => {
					if (found.value || !obj || typeof obj !== 'object') return;
					if (obj === parentValue) {
						found.value = true;
						return;
					}
					if (Array.isArray(obj)) {
						obj.forEach(search);
					} else {
						Object.values(obj).forEach(search);
					}
				};
				search(action);
				return found.value;
			}),
		);
	}

	private getExistingPlaceholderNames(group: any, excludeCurrent: boolean): string[] {
		const names = new Set<string>();
		const scan = (obj: any) => {
			if (!obj || typeof obj !== 'object') return;
			if (obj?.value?.oneofKind === 'variablePlaceholder') {
				const name = obj.value.variablePlaceholder?.name;
				if (name) names.add(name);
			}
			if (Array.isArray(obj)) {
				obj.forEach(scan);
			} else {
				Object.values(obj).forEach(scan);
			}
		};
		group?.actions?.forEach(scan);

		if (excludeCurrent) {
			const currentName = this.getSourceValue();
			if (currentName) names.delete(currentName);
		}

		return Array.from(names);
	}

	private openNameModal(player: Player<any>, getParentValue: () => any, isNew = false) {
		const currentName = this.getSourceValue();
		const group = this.findContainingGroup(player, getParentValue());
		new APLNameModal((this.rootElem.closest('.sim-ui') as HTMLElement) ?? document.body, {
			title: currentName
				? i18n.t('rotation_tab.apl.nameModal.rename', { itemName: i18n.t('rotation_tab.apl.variablePlaceholder.name') })
				: i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: i18n.t('rotation_tab.apl.variablePlaceholder.name') }),
			inputLabel: i18n.t('rotation_tab.apl.variablePlaceholder.nameLabel'),
			confirmButtonLabel: currentName ? i18n.t('rotation_tab.apl.nameModal.renameConfirm') : undefined,
			defaultValue: currentName || '',
			existingNames: () => this.getExistingPlaceholderNames(group, !!currentName),
			onSubmit: (name: string) => {
				if (currentName && group) {
					// Rename placeholders within this group only
					renameAPLReference(group, { type: 'placeholder', oldName: currentName, newName: name });
					// Rename matching variable entries in group references that point to this group
					const groupName = group.name;
					const updateGroupRefs = (obj: any) => {
						if (!obj || typeof obj !== 'object') return;
						if (obj?.oneofKind === 'groupReference' && obj.groupReference?.groupName === groupName) {
							for (const v of obj.groupReference.variables ?? []) {
								if (v.name === currentName) v.name = name;
							}
						}
						if (Array.isArray(obj)) obj.forEach(updateGroupRefs);
						else Object.values(obj).forEach(updateGroupRefs);
					};
					updateGroupRefs(player.aplRotation);
				}
				this.setSourceValue(name);
				player.touchRotation();
			},
			onCancel: isNew
				? () => {
						// Remove the placeholder by resetting the parent APLValue
						const parentValue = getParentValue();
						const clearValue = (obj: any): boolean => {
							if (!obj || typeof obj !== 'object') return false;
							if (obj?.value?.oneofKind === 'variablePlaceholder' && obj.value.variablePlaceholder === parentValue) {
								obj.value = { oneofKind: undefined };
								return true;
							}
							if (Array.isArray(obj)) return obj.some(clearValue);
							return Object.values(obj).some(clearValue);
						};
						player.modifyAplRotation(rotation => {
							clearValue(rotation);
						});
					}
				: undefined,
		});
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): string {
		return this.nameLabel.textContent || '';
	}

	setInputValue(newValue: string) {
		this.nameLabel.textContent = newValue || '';
	}
}

export function groupNameFieldConfig(field: string, options?: Partial<APLPickerBuilderFieldConfig<any, any>>): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => '',
		factory: (parent, player, config) => {
			const picker = new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('rotation_tab.apl.helpers.select_group'),
				equals: (a, b) => a === b,
				values: [],
			});

			const updateValues = () => {
				const groups = player.aplRotation?.groups || [];
				const values = groups.map((group: any) => ({
					value: group.name,
					label: group.name,
				}));

				// If no groups are defined, show a placeholder
				if (values.length === 0) {
					values.push({
						value: '',
						label: i18n.t('rotation_tab.apl.helpers.no_groups_defined'),
					});
				}

				picker.setOptions(values);
			};

			// Update values initially and when rotation changes
			updateValues();
			picker.addOnDisposeCallback(subscribePlayerField(player, 'rotation')(updateValues));

			return picker;
		},
		...(options || {}),
	};
}

export function groupReferenceVariablesFieldConfig(
	field: string,
	groupNameField: string,
	options?: Partial<APLPickerBuilderFieldConfig<any, any>>,
): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => [],
		factory: (parent, player, config, getParentValue) => new APLGroupVariablesPicker(parent, player, config, getParentValue, groupNameField),
		...(options || {}),
	};
}

// Auto-populated list of the variables a referenced group expects. A real
// Input so its subscriptions and child list picker are disposed with it.
class APLGroupVariablesPicker extends Input<Player<any>, any[]> {
	private readonly listPicker: ListPicker<Player<any>, any>;
	private readonly getParentValue: () => any;
	private readonly groupNameField: string;

	constructor(parent: HTMLElement, player: Player<any>, config: InputConfig<Player<any>, any[]>, getParentValue: () => any, groupNameField: string) {
		// The inner ListPicker renders the title; don't let Input render a second label.
		const { label: _label, labelTooltip: _labelTooltip, ...inputConfig } = config;
		super(parent, 'group-reference-variables-container', player, inputConfig);
		this.getParentValue = getParentValue;
		this.groupNameField = groupNameField;

		// Reconcile once up front so the ListPicker's init() builds the final item set.
		this.reconcile();

		this.listPicker = new ListPicker(this.rootElem, player, {
			title: 'Group Variables',
			titleTooltip: "Variables to pass to the group. These will override the group's internal variables.",
			itemLabel: 'Variable',
			// Copy: ListPicker splices its input in place before calling setValue.
			getValue: () => this.getInputValue(),
			setValue: (player: Player<any>, newValue: any[]) => {
				const parentValue = this.getParentValue();
				if (parentValue) parentValue.variables = newValue;
				config.setValue(player, newValue);
			},
			newItem: () => {
				throw new Error('newItem should not be called for auto-populated group variables');
			},
			copyItem: (oldItem: any) => ({
				name: oldItem.name,
				value: oldItem.value,
			}),
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Player<any>, any>,
				index: number,
				itemConfig: ListItemPickerConfig<Player<any>, any>,
			) => {
				const currentVariables = this.getParentValue()?.variables || [];
				const variableName = currentVariables[index]?.__uiVarName || currentVariables[index]?.name || '';
				return new APLGroupVariablePicker(parent, player, itemConfig, this.getParentValue, this.groupNameField, variableName);
			},
			inlineMenuBar: false, // Hide the add/remove buttons since we auto-populate
			allowedActions: ['delete', 'copy'], // Only allow delete and copy, not create
		});
		this.addChild(this.listPicker);

		this.init();
	}

	// Scans the selected group for VariablePlaceholder values, syncs
	// parentValue.variables to that set (keeping existing entries) and toggles
	// visibility. Returns null when nothing should be shown. Memoized per
	// (rotation version, group, variables array): getValue() and the cascade
	// call it several times per edit.
	private reconcileKey: Array<unknown> = [];
	private reconcileResult: { names: Array<string>; variables: any[] } | null = null;
	private reconcile(): { names: Array<string>; variables: any[] } | null {
		const parentValue = this.getParentValue();
		const selectedGroupName = parentValue?.[this.groupNameField];
		const key = [this.modObject.sim.store.getState().players[this.modObject.storeKey]?.v.rotation, selectedGroupName, parentValue?.variables];
		if (key.every((k, i) => Object.is(k, this.reconcileKey[i]))) return this.reconcileResult;
		this.reconcileResult = this.reconcileUncached(parentValue, selectedGroupName);
		// parentValue.variables may have been replaced by the sync above.
		this.reconcileKey = [key[0], key[1], parentValue?.variables];
		return this.reconcileResult;
	}

	private reconcileUncached(parentValue: any, selectedGroupName: string | undefined): { names: Array<string>; variables: any[] } | null {
		const groups = this.modObject.aplRotation?.groups || [];
		const selectedGroup = selectedGroupName ? groups.find((group: any) => group.name === selectedGroupName) : undefined;

		const placeholderVariables = new Set<string>();
		const scanForPlaceholders = (obj: any) => {
			if (!obj || typeof obj !== 'object') return;
			if (obj?.value?.oneofKind === 'variablePlaceholder') {
				const name = obj.value.variablePlaceholder?.name;
				if (name) placeholderVariables.add(name);
			}
			if (Array.isArray(obj)) {
				obj.forEach(child => scanForPlaceholders(child));
			} else {
				Object.values(obj).forEach(child => scanForPlaceholders(child));
			}
		};
		selectedGroup?.actions?.forEach((actionItem: any) => scanForPlaceholders(actionItem));

		if (!selectedGroup || placeholderVariables.size === 0) {
			this.rootElem.classList.add('d-none');
			return null;
		}
		this.rootElem.classList.remove('d-none');

		const names = Array.from(placeholderVariables);
		const before = parentValue.variables;
		const reconciled = names.map(varName => {
			let variableItem = parentValue?.variables?.find((v: any) => v.name === varName);
			if (!variableItem) {
				variableItem = {
					name: varName,
					value: {
						uuid: { value: randomUUID() },
						value: {
							oneofKind: 'variableRef',
							variableRef: { name: '' },
						},
					},
				};
			}
			// Attach UI variable name for label
			variableItem.__uiVarName = varName;
			return variableItem;
		});
		const changed = !before || before.length !== reconciled.length || reconciled.some((v: any, i: number) => v !== before[i]);
		if (changed) {
			// Silent in-place sync, exactly like the original code: reconcile() runs
			// from getValue() (a read path invoked by rotation notifications), so
			// notifying here would re-trigger itself. The user-driven setValue path
			// is what emits.
			parentValue.variables = reconciled;
		}
		return { names, variables: parentValue.variables };
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): any[] {
		return (this.getParentValue()?.variables || []).slice();
	}

	setInputValue(newValue: any[]) {
		const parentValue = this.getParentValue();
		if (parentValue) parentValue.variables = newValue;
		this.reconcile();
		// Cascade to the nested list (its items no longer self-subscribe).
		this.listPicker.setInputValue(this.getInputValue());
	}
}

// Simple picker for individual group variables
class APLGroupVariablePicker extends Input<Player<any>, any> {
	private readonly valuePicker: TextDropdownPicker<Player<any>, string>;
	private readonly getParentValue: () => any;
	private readonly groupNameField: string;
	private readonly nameLabel: HTMLElement;
	private variableName: string;

	constructor(
		parent: HTMLElement,
		player: Player<any>,
		config: ListItemPickerConfig<Player<any>, any>,
		getParentValue: () => any,
		groupNameField: string,
		variableName: string,
	) {
		super(parent, 'apl-group-variable-picker-root', player, config);
		this.getParentValue = getParentValue;
		this.groupNameField = groupNameField;
		this.variableName = variableName;

		// Label for the variable name (kept current by setInputValue when the row is reused).
		this.nameLabel = document.createElement('label');
		this.nameLabel.classList.add('group-variable-label', 'fw-bold', 'd-block');
		this.rootElem.appendChild(this.nameLabel);

		// Variable value picker
		this.valuePicker = new TextDropdownPicker(this.rootElem, this.modObject, {
			id: randomUUID(),
			label: '',
			labelTooltip: i18n.t('rotation_tab.apl.helpers.field_configs.variable_assignment_tooltip', { variableName: this.variableName }),
			defaultLabel: i18n.t('rotation_tab.apl.helpers.select_variable'),
			equals: (a, b) => a === b,
			values: [],
			getValue: () => {
				const item = this.getSourceValue();
				if (item?.value?.value?.variableRef?.name) {
					return item.value.value.variableRef.name;
				}
				return '';
			},
			setValue: (player: Player<any>, newValue: string) => {
				const item = this.getSourceValue();
				if (item && newValue) {
					item.value = {
						uuid: { value: randomUUID() },
						value: {
							oneofKind: 'variableRef',
							variableRef: { name: newValue },
						},
					};
					player.touchRotation();
				}
			},
		});
		this.addChild(this.valuePicker);

		// Update available variables when group changes
		const updateAvailableVariables = () => {
			const parentValue = this.getParentValue();
			const selectedGroupName = parentValue[this.groupNameField];

			if (!selectedGroupName) {
				this.valuePicker.setOptions([]);
				return;
			}

			// Get available variables from the rotation
			const availableVariables = this.modObject.aplRotation?.valueVariables || [];
			const values = availableVariables.map((variable: any) => ({
				value: variable.name,
				label: variable.name,
			}));

			this.valuePicker.setOptions(values);
		};

		// Listen for group name changes
		this.addOnDisposeCallback(subscribePlayerField(this.modObject, 'rotation')(updateAvailableVariables));
		updateAvailableVariables();

		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): any {
		return {
			name: this.variableName,
			value: this.getSourceValue()?.value,
		};
	}

	setInputValue(newValue: any) {
		if (!newValue) return;
		this.variableName = newValue.__uiVarName || newValue.name || this.variableName;
		this.nameLabel.textContent = `${this.variableName}:`;
		this.valuePicker.setInputValue(newValue.value?.value?.variableRef?.name || '');
	}
}

export function eclipseTypeFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{ value: APLValueEclipsePhase.LunarPhase, label: i18n.t('rotation_tab.apl.helpers.eclipse_types.lunar') },
		{ value: APLValueEclipsePhase.SolarPhase, label: i18n.t('rotation_tab.apl.helpers.eclipse_types.solar') },
		{ value: APLValueEclipsePhase.NeutralPhase, label: i18n.t('rotation_tab.apl.helpers.eclipse_types.neutral') },
	];

	return {
		field: field,
		newValue: () => APLValueRuneType.RuneBlood,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('rotation_tab.apl.helpers.eclipse_types.lunar'),
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export function runeTypeFieldConfig(field: string, includeDeath: boolean): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{ value: APLValueRuneType.RuneBlood, label: i18n.t('rotation_tab.apl.helpers.rune_types.blood') },
		{ value: APLValueRuneType.RuneFrost, label: i18n.t('rotation_tab.apl.helpers.rune_types.frost') },
		{ value: APLValueRuneType.RuneUnholy, label: i18n.t('rotation_tab.apl.helpers.rune_types.unholy') },
	];

	if (includeDeath) {
		values.push({ value: APLValueRuneType.RuneDeath, label: i18n.t('rotation_tab.apl.helpers.rune_types.death') });
	}

	return {
		field: field,
		newValue: () => APLValueRuneType.RuneBlood,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export function runeSlotFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => APLValueRuneSlot.SlotLeftBlood,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: [
					{ value: APLValueRuneSlot.SlotLeftBlood, label: i18n.t('rotation_tab.apl.helpers.rune_slots.blood_left') },
					{ value: APLValueRuneSlot.SlotRightBlood, label: i18n.t('rotation_tab.apl.helpers.rune_slots.blood_right') },
					{ value: APLValueRuneSlot.SlotLeftFrost, label: i18n.t('rotation_tab.apl.helpers.rune_slots.frost_left') },
					{ value: APLValueRuneSlot.SlotRightFrost, label: i18n.t('rotation_tab.apl.helpers.rune_slots.frost_right') },
					{ value: APLValueRuneSlot.SlotLeftUnholy, label: i18n.t('rotation_tab.apl.helpers.rune_slots.unholy_left') },
					{ value: APLValueRuneSlot.SlotRightUnholy, label: i18n.t('rotation_tab.apl.helpers.rune_slots.unholy_right') },
				],
			}),
	};
}

export function rotationTypeFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{ value: FeralDruid_Rotation_AplType.SingleTarget, label: i18n.t('rotation_tab.apl.helpers.rotation_types.single_target') },
		{ value: FeralDruid_Rotation_AplType.Aoe, label: i18n.t('rotation_tab.apl.helpers.rotation_types.aoe') },
	];

	return {
		field: field,
		label: i18n.t('rotation_tab.apl.helpers.field_configs.type'),
		newValue: () => FeralDruid_Rotation_AplType.SingleTarget,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('rotation_tab.apl.helpers.rotation_types.single_target'),
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export function hotwStrategyFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{ value: HotwStrategy.Caster, label: i18n.t('rotation_tab.apl.helpers.hotw_strategies.caster') },
		{ value: HotwStrategy.Cat, label: i18n.t('rotation_tab.apl.helpers.hotw_strategies.cat') },
		{ value: HotwStrategy.Hybrid, label: i18n.t('rotation_tab.apl.helpers.hotw_strategies.hybrid') },
	];

	return {
		field: field,
		label: i18n.t('rotation_tab.apl.helpers.field_configs.strategy'),
		newValue: () => HotwStrategy.Caster,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('rotation_tab.apl.helpers.hotw_strategies.caster'),
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export function statTypeFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const allStats = getEnumValues(Stat) as Array<Stat>;
	const values = [{ value: -1, label: i18n.t('common.none') }].concat(
		allStats.map(stat => {
			return { value: stat, label: translateStat(stat) };
		}),
	);

	return {
		field: field,
		label: i18n.t('rotation_tab.apl.helpers.field_configs.buff_type'),
		newValue: () => 0,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export const minIcdInput = numberFieldConfig('minIcdSeconds', false, {
	label: i18n.t('rotation_tab.apl.helpers.field_configs.min_icd'),
	labelTooltip: i18n.t('rotation_tab.apl.helpers.field_configs.min_icd_tooltip'),
});

export function aplInputBuilder<T>(
	newValue: () => T,
	fields: Array<APLPickerBuilderFieldConfig<T, keyof T>>,
): (parent: HTMLElement, player: Player<any>, config: InputConfig<Player<any>, T>) => Input<Player<any>, T> {
	return (parent, player, config) => {
		return new APLPickerBuilder(parent, player, {
			...config,
			newValue: newValue,
			fields: fields,
		});
	};
}

export function reactionTimeCheckbox(): APLPickerBuilderFieldConfig<any, any> {
	return booleanFieldConfig('includeReactionTime', i18n.t('rotation_tab.apl.helpers.field_configs.include_reaction_time'), {
		labelTooltip: i18n.t('rotation_tab.apl.helpers.field_configs.include_reaction_time_tooltip'),
	});
}

export function useDotBaseValueCheckbox(): APLPickerBuilderFieldConfig<any, any> {
	return booleanFieldConfig('useBaseValue', i18n.t('rotation_tab.apl.helpers.field_configs.use_base_value'), {
		labelTooltip: i18n.t('rotation_tab.apl.helpers.field_configs.use_base_value_tooltip'),
	});
}

export function damageAmpTypeFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{
			value: APLActionDamageAmplifier_AmplificationType.CasterBuff,
			label: i18n.t('rotation_tab.apl.helpers.amplification_types.caster_buff.label'),
			tooltip: i18n.t('rotation_tab.apl.helpers.amplification_types.caster_buff.tooltip'),
		},
		{
			value: APLActionDamageAmplifier_AmplificationType.EnvironmentBuff,
			label: i18n.t('rotation_tab.apl.helpers.amplification_types.environment_buff.label'),
			tooltip: i18n.t('rotation_tab.apl.helpers.amplification_types.environment_buff.tooltip'),
		},
		{
			value: APLActionDamageAmplifier_AmplificationType.TargetDebuff,
			label: i18n.t('rotation_tab.apl.helpers.amplification_types.target_debuff.label'),
			tooltip: i18n.t('rotation_tab.apl.helpers.amplification_types.target_debuff.tooltip'),
		},
	];

	return {
		field: field,
		label: i18n.t('rotation_tab.apl.helpers.field_configs.amplification_type'),
		newValue: () => APLActionDamageAmplifier_AmplificationType.CasterBuff,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('rotation_tab.apl.helpers.amplification_types.caster_buff.label'),
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export function useRuneRegenBaseValueCheckbox(): APLPickerBuilderFieldConfig<any, any> {
	return booleanFieldConfig('useBaseValue', 'Use base value', {
		labelTooltip: 'If checked, will return your base (unmodified by procs/lust etc) rune regen rate',
	});
}

export function itemSwapSetFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => ItemSwapSet.Swap1,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: [
					{ value: ItemSwapSet.Main, label: i18n.t('rotation_tab.apl.item_swap_sets.main') },
					{ value: ItemSwapSet.Swap1, label: i18n.t('rotation_tab.apl.item_swap_sets.swapped') },
				],
			}),
	};
}

/** Maps the DOM-free field descriptors in `model/` onto the picker factories above. */
export function makeCommonFieldConfig(descriptor: CommonFieldDescriptor): APLPickerBuilderFieldConfig<any, any> {
	switch (descriptor.type) {
		case 'actionId':
			return actionIdFieldConfig(descriptor.field, descriptor.actionIdSet, descriptor.unitRefField, descriptor.defaultUnitRef, descriptor.options);
		case 'unit':
			return unitFieldConfig(descriptor.field, descriptor.unitSet, descriptor.options);
		case 'boolean':
			return booleanFieldConfig(descriptor.field, descriptor.label, descriptor.options);
		case 'number':
			return numberFieldConfig(descriptor.field, descriptor.float, descriptor.options);
		case 'string':
			return stringFieldConfig(descriptor.field, descriptor.options);
		case 'variableName':
			return variableNameFieldConfig(descriptor.field, descriptor.options);
		case 'placeholderName':
			return placeholderNameFieldConfig(descriptor.field, descriptor.options);
		case 'groupName':
			return groupNameFieldConfig(descriptor.field, descriptor.options);
		case 'groupReferenceVariables':
			return groupReferenceVariablesFieldConfig(descriptor.field, descriptor.groupNameField, descriptor.options);
		case 'eclipseType':
			return eclipseTypeFieldConfig(descriptor.field);
		case 'runeType':
			return runeTypeFieldConfig(descriptor.field, descriptor.includeDeath);
		case 'runeSlot':
			return runeSlotFieldConfig(descriptor.field);
		case 'rotationType':
			return rotationTypeFieldConfig(descriptor.field);
		case 'hotwStrategy':
			return hotwStrategyFieldConfig(descriptor.field);
		case 'statType':
			return statTypeFieldConfig(descriptor.field);
		case 'damageAmpType':
			return damageAmpTypeFieldConfig(descriptor.field);
		case 'itemSwapSet':
			return itemSwapSetFieldConfig(descriptor.field);
		case 'minIcd':
			return minIcdInput;
		case 'reactionTime':
			return reactionTimeCheckbox();
		case 'useDotBaseValue':
			return useDotBaseValueCheckbox();
		case 'useRuneRegenBaseValue':
			return useRuneRegenBaseValueCheckbox();
	}
}

/**
 * Creates a ListPickerExtraAction that extracts an APL value/condition to a named variable,
 * replacing it with a Variable Reference.
 */
export function extractToVariableAction(
	player: Player<any>,
	getValue: (index: number) => APLValue | undefined,
	setValue: (index: number, variableRef: APLValue) => void,
	modalParent: HTMLElement = document.body,
): ListPickerExtraAction {
	const isExtractable = (index: number): boolean => {
		const value = getValue(index);
		return !!value && !!value.value.oneofKind && value.value.oneofKind !== 'variableRef';
	};

	return {
		cssClass: 'list-picker-item-extract-variable',
		icon: 'fa-arrow-right-from-bracket',
		tooltip: i18n.t('rotation_tab.apl.variables.extractToVariable'),
		shouldShow: isExtractable,
		onClick: (index: number) => {
			if (!isExtractable(index)) return;
			const value = getValue(index)!;

			new APLNameModal(modalParent, {
				title: i18n.t('rotation_tab.apl.variables.extractToVariable'),
				inputLabel: i18n.t('rotation_tab.apl.variables.attributes.name'),
				confirmButtonLabel: i18n.t('rotation_tab.apl.nameModal.extract'),
				existingNames: (player.aplRotation.valueVariables || []).map(v => v.name),
				onSubmit: (name: string) => {
					if (!player.aplRotation.valueVariables) {
						player.aplRotation.valueVariables = [];
					}
					player.aplRotation.valueVariables.push(APLValueVariable.create({ name, value: APLValue.clone(value) }));

					setValue(
						index,
						APLValue.create({
							value: { oneofKind: 'variableRef', variableRef: { name } },
							uuid: { value: randomUUID() },
						}),
					);

					player.touchRotation();
				},
			});
		},
	};
}

import { ref } from 'tsx-vanilla';

import { CacheHandler } from '../../cache_handler';
import { Player, UnitMetadata } from '../../player.js';
import { APLValue, APLValueEclipsePhase, APLValueRuneSlot, APLValueRuneType, APLValueVariable, APLValueVariableRef } from '../../proto/apl.js';
import { ActionID, OtherAction, Stat, UnitReference, UnitReference_Type as UnitType } from '../../proto/common.js';
import { FeralDruid_Rotation_AplType } from '../../proto/druid.js';
import { ActionId, defaultTargetIcon, getPetIconFromName } from '../../proto_utils/action_id.js';
import { getStatName } from '../../proto_utils/names.js';
import { EventID, TypedEvent } from '../../typed_event.js';
import { bucket, getEnumValues, randomUUID } from '../../utils.js';
import { Input, InputConfig } from '../input.jsx';
import { BooleanPicker } from '../pickers/boolean_picker.js';
import { DropdownPicker, DropdownPickerConfig, DropdownValueConfig, TextDropdownPicker } from '../pickers/dropdown_picker.jsx';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker.jsx';
import { NumberPicker, NumberPickerConfig } from '../pickers/number_picker.js';
import { AdaptiveStringPicker } from '../pickers/string_picker.js';
import { UnitPicker, UnitPickerConfig, UnitValue } from '../pickers/unit_picker.jsx';

export type ACTION_ID_SET =
	| 'auras'
	| 'stackable_auras'
	| 'icd_auras'
	| 'exclusive_effect_auras'
	| 'spells'
	| 'castable_spells'
	| 'channel_spells'
	| 'dot_spells'
	| 'castable_dot_spells'
	| 'shield_spells'
	| 'non_instant_spells'
	| 'friendly_spells'
	| 'expected_dot_spells';

const actionIdSets: Record<
	ACTION_ID_SET,
	{
		defaultLabel: string;
		getActionIDs: (metadata: UnitMetadata) => Promise<Array<DropdownValueConfig<ActionId>>>;
	}
> = {
	auras: {
		defaultLabel: 'Aura',
		getActionIDs: async metadata => {
			return metadata.getAuras().map(actionId => {
				return {
					value: actionId.id,
				};
			});
		},
	},
	stackable_auras: {
		defaultLabel: 'Aura',
		getActionIDs: async metadata => {
			return metadata
				.getAuras()
				.filter(aura => aura.data.maxStacks > 0)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	icd_auras: {
		defaultLabel: 'Aura',
		getActionIDs: async metadata => {
			return metadata
				.getAuras()
				.filter(aura => aura.data.hasIcd)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	exclusive_effect_auras: {
		defaultLabel: 'Aura',
		getActionIDs: async metadata => {
			return metadata
				.getAuras()
				.filter(aura => aura.data.hasExclusiveEffect)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	// Used for non categorized lists
	spells: {
		defaultLabel: 'Spell',
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	castable_spells: {
		defaultLabel: 'Spell',
		getActionIDs: async metadata => {
			const castableSpells = metadata.getSpells().filter(spell => spell.data.isCastable);

			// Split up non-cooldowns and cooldowns into separate sections for easier browsing.
			const { spells: spells, cooldowns: cooldowns } = bucket(castableSpells, spell => (spell.data.isMajorCooldown ? 'cooldowns' : 'spells'));

			const placeholders: Array<ActionId> = [ActionId.fromOtherId(OtherAction.OtherActionPotion)];

			return [
				[
					{
						value: ActionId.fromEmpty(),
						headerText: 'Spells',
						submenu: ['Spells'],
					},
				],
				(spells || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: ['Spells'],
						extraCssClasses: actionId.data.prepullOnly
							? ['apl-prepull-actions-only']
							: actionId.data.encounterOnly
							? ['apl-priority-list-only']
							: [],
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: 'Cooldowns',
						submenu: ['Cooldowns'],
					},
				],
				(cooldowns || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: ['Cooldowns'],
						extraCssClasses: actionId.data.prepullOnly
							? ['apl-prepull-actions-only']
							: actionId.data.encounterOnly
							? ['apl-priority-list-only']
							: [],
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: 'Placeholders',
						submenu: ['Placeholders'],
					},
				],
				placeholders.map(actionId => {
					return {
						value: actionId,
						submenu: ['Placeholders'],
						tooltip: 'The Prepull Potion if CurrentTime < 0, or the Combat Potion if combat has started.',
					};
				}),
			].flat();
		},
	},
	non_instant_spells: {
		defaultLabel: 'Non-instant Spell',
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.hasCastTime)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	friendly_spells: {
		defaultLabel: 'Friendly Spell',
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.isFriendly)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	channel_spells: {
		defaultLabel: 'Channeled Spell',
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.isChanneled)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	dot_spells: {
		defaultLabel: 'DoT Spell',
		getActionIDs: async metadata => {
			return (
				metadata
					.getSpells()
					.filter(spell => spell.data.hasDot)
					// filter duplicate dot entries from RelatedDotSpell
					.filter((value, index, self) => self.findIndex(v => v.id.anyId() === value.id.anyId()) === index)
					.map(actionId => {
						return {
							value: actionId.id,
						};
					})
			);
		},
	},
	castable_dot_spells: {
		defaultLabel: 'DoT Spell',
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.hasDot)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	expected_dot_spells: {
		defaultLabel: 'DoT Spell',
		getActionIDs: async metadata => {
			return (
				metadata
					.getSpells()
					.filter(spell => spell.data.hasExpectedTick)
					// filter duplicate dot entries from RelatedDotSpell
					.filter((value, index, self) => self.findIndex(v => v.id.anyId() === value.id.anyId()) === index)
					.map(actionId => {
						return {
							value: actionId.id,
						};
					})
			);
		},
	},
	shield_spells: {
		defaultLabel: 'Shield Spell',
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.hasShield)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
};

export type DEFAULT_UNIT_REF = 'self' | 'currentTarget';

export interface APLActionIDPickerConfig<ModObject>
	extends Omit<DropdownPickerConfig<ModObject, ActionID, ActionId>, 'defaultLabel' | 'equals' | 'setOptionContent' | 'values' | 'getValue' | 'setValue'> {
	actionIdSet: ACTION_ID_SET;
	getUnitRef: (player: Player<any>) => UnitReference;
	defaultUnitRef: DEFAULT_UNIT_REF;
	getValue: (obj: ModObject) => ActionID;
	setValue: (eventID: EventID, obj: ModObject, newValue: ActionID) => void;
}

const cachedAPLActionIDPickerContent = new CacheHandler<Element>();

export class APLActionIDPicker extends DropdownPicker<Player<any>, ActionID, ActionId> {
	constructor(parent: HTMLElement, player: Player<any>, config: APLActionIDPickerConfig<Player<any>>) {
		const actionIdSet = actionIdSets[config.actionIdSet];
		super(parent, player, {
			...config,
			sourceToValue: (src: ActionID) => (src ? ActionId.fromProto(src) : ActionId.fromEmpty()),
			valueToSource: (val: ActionId) => val.toProto(),
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

				actionId.setBackgroundAndHref(iconRef.value!);
				actionId.setWowheadDataset(iconRef.value!, { useBuffAura: isAuraType });

				cachedAPLActionIDPickerContent.set(cacheKey, content);
			},
			createMissingValue: value => {
				if (value.anyId() == 0) {
					return new Promise<DropdownValueConfig<ActionId>>(() => {
						value: actionIdSet.defaultLabel;
					});
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
		const updateValues = async () => {
			const unitRef = getUnitRef(player);
			const metadata = player.sim.getUnitMetadata(unitRef, player, defaultRef);
			if (metadata) {
				const values = await getActionIDs(metadata);
				this.setOptions(values);
			}
		};
		updateValues();
		const unitMetaEvent = player.sim.unitMetadataEmitter.on(updateValues);
		const rotationChangeEvent = player.rotationChangeEmitter.on(updateValues);
		this.addOnDisposeCallback(() => {
			unitMetaEvent.dispose();
			rotationChangeEvent.dispose();
		});
	}
}

export type UNIT_SET = 'aura_sources' | 'aura_sources_targets_first' | 'targets' | 'players';

const unitSets: Record<
	UNIT_SET,
	{
		// Uses target icon by default instead of person icon. This should be set to true for inputs that default to CurrentTarget.
		targetUI?: boolean;
		getUnits: (player: Player<any>) => Array<UnitReference | undefined>;
	}
> = {
	aura_sources: {
		getUnits: player => {
			return [
				undefined,
				player
					.getPetMetadatas()
					.asList()
					.map((petMetadata, i) => UnitReference.create({ type: UnitType.Pet, index: i, owner: UnitReference.create({ type: UnitType.Self }) })),
				UnitReference.create({ type: UnitType.CurrentTarget }),
				player.sim.raid
					.getActivePlayers()
					.filter(filter => filter != player)
					.map(mapPlayer => UnitReference.create({ type: UnitType.Player, index: mapPlayer.getRaidIndex() })),
				player.sim.encounter.targetsMetadata.asList().map((targetMetadata, i) => UnitReference.create({ type: UnitType.Target, index: i })),
			].flat();
		},
	},
	aura_sources_targets_first: {
		targetUI: true,
		getUnits: player => {
			return [
				undefined,
				player.sim.encounter.targetsMetadata.asList().map((targetMetadata, i) => UnitReference.create({ type: UnitType.Target, index: i })),
				UnitReference.create({ type: UnitType.Self }),
				player
					.getPetMetadatas()
					.asList()
					.map((petMetadata, i) => UnitReference.create({ type: UnitType.Pet, index: i, owner: UnitReference.create({ type: UnitType.Self }) })),
			].flat();
		},
	},
	targets: {
		targetUI: true,
		getUnits: player => {
			return [
				undefined,
				player.sim.encounter.targetsMetadata.asList().map((_targetMetadata, i) => UnitReference.create({ type: UnitType.Target, index: i })),
			].flat();
		},
	},
	players: {
		targetUI: true,
		getUnits: player => {
			return [
				undefined,
				player.sim.raid.getActivePlayers().map(player => UnitReference.create({ type: UnitType.Player, index: player.getRaidIndex() })),
			].flat();
		},
	},
};

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
		const event = player.sim.unitMetadataEmitter.on(() => this.updateValues());
		this.addOnDisposeCallback(() => {
			event.dispose();
		});
	}

	private static refToValue(ref: UnitReference | undefined, thisPlayer: Player<any>, targetUI: boolean | undefined): UnitValue {
		if (!ref || ref.type == UnitType.Unknown) {
			return {
				value: ref,
				iconUrl: targetUI ? 'fa-bullseye' : 'fa-user',
				text: targetUI ? 'Current Target' : 'Self',
			};
		} else if (ref.type == UnitType.Self) {
			return {
				value: ref,
				iconUrl: 'fa-user',
				text: 'Self',
			};
		} else if (ref.type == UnitType.CurrentTarget) {
			return {
				value: ref,
				iconUrl: 'fa-bullseye',
				text: 'Current Target',
			};
		} else if (ref.type == UnitType.Player) {
			const player = thisPlayer.sim.raid.getPlayer(ref.index);
			if (player) {
				return {
					value: ref,
					iconUrl: player.getSpecIcon(),
					text: `Player ${ref.index + 1}`,
				};
			}
		} else if (ref.type == UnitType.Target) {
			const targetMetadata = thisPlayer.sim.encounter.targetsMetadata.asList()[ref.index];
			if (targetMetadata) {
				return {
					value: ref,
					iconUrl: defaultTargetIcon,
					text: `Target ${ref.index + 1}`,
				};
			}
		} else if (ref.type == UnitType.Pet) {
			const petMetadata = thisPlayer.sim.getUnitMetadata(ref, thisPlayer, UnitReference.create({ type: UnitType.Self }));
			let name = `Pet ${ref.index + 1}`;
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
		const picker = fieldConfig.factory(
			builder.rootElem,
			builder.modObject,
			{
				label: fieldConfig.label,
				labelTooltip: fieldConfig.labelTooltip,
				id: randomUUID(),
				changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
				getValue: () => {
					const source = builder.getSourceValue();
					if (!source[field]) {
						source[field] = fieldConfig.newValue();
					}
					return source[field];
				},
				setValue: (eventID: EventID, player: Player<any>, newValue: any) => {
					builder.getSourceValue()[field] = newValue;
					player.rotationChangeEmitter.emit(eventID);
				},
			},
			() => builder.getSourceValue(),
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
				defaultLabel: 'Select Variable',
				equals: (a, b) => a === b,
				values: [],
				changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
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
						label: 'No variables defined',
					});
				}

				picker.setOptions(values);
			};

			// Update values initially and when rotation changes
			updateValues();
			player.rotationChangeEmitter.on(updateValues);

			return picker;
		},
		...(options || {}),
	};
}

export function groupNameFieldConfig(field: string, options?: Partial<APLPickerBuilderFieldConfig<any, any>>): APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => '',
		factory: (parent, player, config) => {
			const picker = new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: 'Select Group',
				equals: (a, b) => a === b,
				values: [],
				changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
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
						label: 'No groups defined',
					});
				}

				picker.setOptions(values);
			};

			// Update values initially and when rotation changes
			updateValues();
			player.rotationChangeEmitter.on(updateValues);

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
		factory: (parent, player, config, getParentValue) => {
			// Create a simple container
			const container = document.createElement('div');
			container.classList.add('group-reference-variables-container');
			container.style.marginTop = '8px';
			parent.appendChild(container);

			// Create a ListPicker for the variables
			const listPicker = new ListPicker(container, player, {
				title: 'Group Variables',
				titleTooltip: "Variables to pass to the group. These will override the group's internal variables.",
				itemLabel: 'Variable',
				changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
				getValue: () => {
					const parentValue = getParentValue();
					return parentValue?.variables || [];
				},
				setValue: (eventID: EventID, player: Player<any>, newValue: any[]) => {
					const parentValue = getParentValue();
					parentValue.variables = newValue;
					config.setValue(eventID, player, newValue);
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
					const currentVariables = getParentValue()?.variables || [];
					const variableName = currentVariables[index]?.__uiVarName || currentVariables[index]?.name || '';
					return new APLGroupVariablePicker(parent, player, itemConfig, getParentValue, groupNameField, variableName);
				},
				inlineMenuBar: false, // Hide the add/remove buttons since we auto-populate
				allowedActions: ['delete', 'copy'], // Only allow delete and copy, not create
			});

			// Function to update the list based on the selected group
			const updateVariableList = () => {
				const parentValue = getParentValue();
				const selectedGroupName = parentValue[groupNameField];

				if (!selectedGroupName) {
					listPicker.setInputValue([]);
					container.style.display = 'none';
					return;
				}

				// Find the selected group
				const groups = player.aplRotation?.groups || [];
				const selectedGroup = groups.find((group: any) => group.name === selectedGroupName);

				if (!selectedGroup) {
					listPicker.setInputValue([]);
					container.style.display = 'none';
					return;
				}

				// Prepare a set and recursive scanner for VariablePlaceholder values.
				const placeholderVariables = new Set<string>();
				const scanForPlaceholders = (obj: any) => {
					if (!obj || typeof obj !== 'object') return;
					// Detect a variable placeholder APLValue.
					if (obj?.value?.oneofKind === 'variablePlaceholder') {
						const name = obj.value.variablePlaceholder?.name;
						if (name) placeholderVariables.add(name);
					}
					// Recurse through arrays and object properties.
					if (Array.isArray(obj)) {
						obj.forEach(child => scanForPlaceholders(child));
					} else {
						Object.values(obj).forEach(child => scanForPlaceholders(child));
					}
				};

				// Perform a full recursive scan on every action in the group.
				selectedGroup.actions?.forEach((actionItem: any) => {
					scanForPlaceholders(actionItem);
				});

				// Hide the container if no placeholder variables found
				if (placeholderVariables.size === 0) {
					container.style.display = 'none';
					listPicker.setInputValue([]);
					return;
				}

				// Show the container and populate variables
				container.style.display = 'block';

				parentValue.variables = Array.from(placeholderVariables).map(varName => {
					// Find existing variable or create new one
					let variableItem = parentValue?.variables.find((v: any) => v.name === varName);
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

				listPicker.setInputValue(parentValue.variables);
			};

			// Listen for group name changes and rotation changes
			player.rotationChangeEmitter.on(updateVariableList);
			updateVariableList();

			return {
				rootElem: container,
				getInputValue: () => {
					const parentValue = getParentValue();
					return parentValue?.variables || [];
				},
				setInputValue: (newValue: any[]) => {
					const parentValue = getParentValue();
					parentValue.variables = newValue;
				},
			} as any;
		},
		...(options || {}),
	};
}

// Simple picker for individual group variables
class APLGroupVariablePicker extends Input<Player<any>, any> {
	private readonly valuePicker: TextDropdownPicker<Player<any>, string>;
	private readonly getParentValue: () => any;
	private readonly groupNameField: string;
	private readonly variableName: string;

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

		// Create label for the variable name
		const label = document.createElement('label');
		label.textContent = `${this.variableName}:`;
		label.classList.add('group-variable-label');
		label.style.fontWeight = 'bold';
		label.style.marginBottom = '8px';
		label.style.display = 'block';
		this.rootElem.appendChild(label);

		// Variable value picker
		this.valuePicker = new TextDropdownPicker(this.rootElem, this.modObject, {
			id: randomUUID(),
			label: '',
			labelTooltip: `Value to assign to variable '${this.variableName}'`,
			defaultLabel: 'Select Variable',
			equals: (a, b) => a === b,
			values: [],
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => {
				const item = this.getSourceValue();
				if (item?.value?.value?.variableRef?.name) {
					return item.value.value.variableRef.name;
				}
				return '';
			},
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				const item = this.getSourceValue();
				if (item && newValue) {
					item.value = {
						uuid: { value: randomUUID() },
						value: {
							oneofKind: 'variableRef',
							variableRef: { name: newValue },
						},
					};
					player.rotationChangeEmitter.emit(eventID);
				}
			},
		});

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
		this.modObject.rotationChangeEmitter.on(updateAvailableVariables);
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
		// The value picker will be updated via the change event
	}
}

export function eclipseTypeFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{ value: APLValueEclipsePhase.LunarPhase, label: 'Lunar' },
		{ value: APLValueEclipsePhase.SolarPhase, label: 'Solar' },
		{ value: APLValueEclipsePhase.NeutralPhase, label: 'Neutral' },
	];

	return {
		field: field,
		newValue: () => APLValueRuneType.RuneBlood,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: 'Lunar',
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export function runeTypeFieldConfig(field: string, includeDeath: boolean): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{ value: APLValueRuneType.RuneBlood, label: 'Blood' },
		{ value: APLValueRuneType.RuneFrost, label: 'Frost' },
		{ value: APLValueRuneType.RuneUnholy, label: 'Unholy' },
	];

	if (includeDeath) {
		values.push({ value: APLValueRuneType.RuneDeath, label: 'Death' });
	}

	return {
		field: field,
		newValue: () => APLValueRuneType.RuneBlood,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: 'None',
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
				defaultLabel: 'None',
				equals: (a, b) => a == b,
				values: [
					{ value: APLValueRuneSlot.SlotLeftBlood, label: 'Blood Left' },
					{ value: APLValueRuneSlot.SlotRightBlood, label: 'Blood Right' },
					{ value: APLValueRuneSlot.SlotLeftFrost, label: 'Frost Left' },
					{ value: APLValueRuneSlot.SlotRightFrost, label: 'Frost Right' },
					{ value: APLValueRuneSlot.SlotLeftUnholy, label: 'Unholy Left' },
					{ value: APLValueRuneSlot.SlotRightUnholy, label: 'Unholy Right' },
				],
			}),
	};
}

export function rotationTypeFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const values = [
		{ value: FeralDruid_Rotation_AplType.SingleTarget, label: 'Single Target' },
		{ value: FeralDruid_Rotation_AplType.Aoe, label: 'AOE' },
	];

	return {
		field: field,
		label: 'Type',
		newValue: () => FeralDruid_Rotation_AplType.SingleTarget,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: 'Single Target',
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export function statTypeFieldConfig(field: string): APLPickerBuilderFieldConfig<any, any> {
	const allStats = getEnumValues(Stat) as Array<Stat>;
	const values = [{ value: -1, label: 'None' }].concat(
		allStats.map(stat => {
			return { value: stat, label: getStatName(stat) };
		}),
	);

	return {
		field: field,
		label: 'Buff Type',
		newValue: () => 0,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: 'None',
				equals: (a, b) => a == b,
				values: values,
			}),
	};
}

export const minIcdInput = numberFieldConfig('minIcdSeconds', false, {
	label: 'Min ICD',
	labelTooltip:
		'If non-zero, filter out any procs that either lack an ICD or for which the ICD is smaller than the specified value (in seconds). This can be useful for certain snapshotting checks, since procs with low ICDs are often too weak to snapshot.',
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

import { Spec } from '@generated/proto/common';
import type { StoreField } from '@sim/hooks/useStoreField';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import type { ClassOptions, SpecOptions, SpecRotation } from '@sim/proto/spec_types';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { formatToNumber } from '@sim/utils/format';
import { randomUUID } from '@sim/utils/misc';

import { BooleanPickerConfig } from './BooleanPicker/types';
import { EnumPickerConfig, EnumValueConfig } from './EnumPicker/types';
import { IconEnumPickerConfig, IconEnumValueConfig } from './IconEnumPicker/types';
import { IconPickerConfig } from './IconPicker/types';
import type { StoreBinding } from './input';
import { MultiIconPickerConfig } from './MultiIconPicker/types';
import { NumberPickerConfig } from './NumberPicker/types';

const storeBinding = <ModObject>(
	storeSubscribe: ((obj: ModObject) => StoreSubscribe) | undefined,
	storeField: StoreField | ReadonlyArray<StoreField>,
): StoreBinding<ModObject> => (storeSubscribe ? { storeSubscribe } : { storeField });

const mapStoreBinding = <From, To>(binding: StoreBinding<From>, getModObject: (obj: To) => From): StoreBinding<To> => {
	if (binding.storeSubscribe === undefined) return { storeField: binding.storeField };
	const source = binding.storeSubscribe;
	return { storeSubscribe: (obj: To) => source(getModObject(obj)) };
};

export const makeMultiIconInput = <ModObject>(
	inputs: Array<IconPickerConfig<ModObject, any>>,
	label: string,
	categoryId?: ActionId,
): MultiIconPickerConfig<ModObject> => {
	return {
		inputs: inputs,
		label: label,
		categoryId: categoryId,
		showWhen: p => inputs.filter(i => !i.showWhen || i.showWhen(p as ModObject)).length > 0,
	};
};

// Extend this to add player callbacks as optional config fields.
interface BasePlayerConfig<SpecType extends Spec, T> {
	getValue?: (player: Player<SpecType>) => T;
	setValue?: (player: Player<SpecType>, newVal: T) => void;
	storeSubscribe?: (player: Player<SpecType>) => StoreSubscribe;
	storeField?: StoreField | ReadonlyArray<StoreField>;
	extraClassNames?: Array<string>;
	showWhen?: (player: Player<SpecType>) => boolean;
}

/////////////////////////////////////////////////////////////////////////////////
//                                    BOOLEAN
/////////////////////////////////////////////////////////////////////////////////
export interface TypedBooleanPickerConfig<ModObject> extends BooleanPickerConfig<ModObject> {
	type: 'boolean';
}

interface WrappedBooleanInputConfig<SpecType extends Spec, ModObject> extends BooleanPickerConfig<ModObject> {
	getModObject: (player: Player<SpecType>) => ModObject;
}
export const makeWrappedBooleanInput = <SpecType extends Spec, ModObject>(
	config: WrappedBooleanInputConfig<SpecType, ModObject>,
): TypedBooleanPickerConfig<Player<SpecType>> => {
	const getModObject = config.getModObject;
	return {
		id: config.id,
		type: 'boolean',
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		storeSubscribe: config.storeSubscribe && (player => config.storeSubscribe!(getModObject(player))),
		storeField: config.storeField,
		getValue: (player: Player<SpecType>) => config.getValue(getModObject(player)),
		setValue: (player: Player<SpecType>, newValue: boolean) => config.setValue(getModObject(player), newValue),
		enableWhen: config.enableWhen ? (player: Player<SpecType>) => config.enableWhen!(getModObject(player)) : undefined,
		showWhen: config.showWhen ? (player: Player<SpecType>) => config.showWhen!(getModObject(player)) : undefined,
		extraClassNames: config.extraClassNames,
	};
};
export interface PlayerBooleanInputConfig<SpecType extends Spec, Message> extends BasePlayerConfig<SpecType, boolean> {
	fieldName: keyof Message;
	label: string;
	labelTooltip?: string;
	description?: string | Element;
	enableWhen?: (player: Player<SpecType>) => boolean;
	showWhen?: (player: Player<SpecType>) => boolean;
}
export const makeClassOptionsBooleanInput = <SpecType extends Spec>(
	config: PlayerBooleanInputConfig<SpecType, ClassOptions<SpecType>>,
): TypedBooleanPickerConfig<Player<SpecType>> => {
	return makeWrappedBooleanInput<SpecType, Player<SpecType>>({
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getClassOptions()[config.fieldName] as unknown as boolean),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: boolean) => {
				const newMessage = player.getClassOptions();
				(newMessage[config.fieldName] as unknown as boolean) = newVal;
				player.setClassOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
		extraClassNames: config.extraClassNames,
	});
};
export const makeSpecOptionsBooleanInput = <SpecType extends Spec>(
	config: PlayerBooleanInputConfig<SpecType, SpecOptions<SpecType>>,
): TypedBooleanPickerConfig<Player<SpecType>> => {
	return makeWrappedBooleanInput<SpecType, Player<SpecType>>({
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSpecOptions()[config.fieldName] as unknown as boolean),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: boolean) => {
				const newMessage = player.getSpecOptions();
				(newMessage[config.fieldName] as unknown as boolean) = newVal;
				player.setSpecOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
		extraClassNames: config.extraClassNames,
	});
};
export const makeRotationBooleanInput = <SpecType extends Spec>(
	config: PlayerBooleanInputConfig<SpecType, SpecRotation<SpecType>>,
): TypedBooleanPickerConfig<Player<SpecType>> => {
	return makeWrappedBooleanInput<SpecType, Player<SpecType>>({
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSimpleRotation()[config.fieldName] as unknown as boolean),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: boolean) => {
				const newMessage = player.getSimpleRotation();
				(newMessage[config.fieldName] as unknown as boolean) = newVal;
				player.setSimpleRotation(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'rotation'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
		extraClassNames: config.extraClassNames,
	});
};

/////////////////////////////////////////////////////////////////////////////////
//                                    NUMBER
/////////////////////////////////////////////////////////////////////////////////
export interface TypedNumberPickerConfig<ModObject> extends NumberPickerConfig<ModObject> {
	type: 'number';
}

interface WrappedNumberInputConfig<SpecType extends Spec, ModObject> extends NumberPickerConfig<ModObject> {
	getModObject: (player: Player<SpecType>) => ModObject;
}
const makeWrappedNumberInput = <SpecType extends Spec, ModObject>(
	config: WrappedNumberInputConfig<SpecType, ModObject>,
): TypedNumberPickerConfig<Player<SpecType>> => {
	const getModObject = config.getModObject;
	return {
		id: config.id,
		type: 'number',
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		float: config.float,
		showZeroes: config.showZeroes,
		maxDecimalDigits: config.maxDecimalDigits,
		positive: config.positive,
		storeSubscribe: config.storeSubscribe && (player => config.storeSubscribe!(getModObject(player))),
		storeField: config.storeField,
		getValue: (player: Player<SpecType>) => config.getValue(getModObject(player)),
		setValue: (player: Player<SpecType>, newValue: number) => config.setValue(getModObject(player), newValue),
		enableWhen: config.enableWhen ? (player: Player<SpecType>) => config.enableWhen!(getModObject(player)) : undefined,
		showWhen: config.showWhen ? (player: Player<SpecType>) => config.showWhen!(getModObject(player)) : undefined,
		extraClassNames: config.extraClassNames,
	};
};
export interface PlayerNumberInputConfig<SpecType extends Spec, Message>
	extends
		BasePlayerConfig<SpecType, number>,
		Pick<NumberPickerConfig<Player<SpecType>>, 'labelTooltip' | 'description' | 'showZeroes' | 'maxDecimalDigits' | 'float' | 'positive'> {
	fieldName: keyof Message;
	label: string;
	percent?: boolean;
	max?: number;
	enableWhen?: (player: Player<SpecType>) => boolean;
	showWhen?: (player: Player<SpecType>) => boolean;
	storeSubscribe?: (player: Player<SpecType>) => StoreSubscribe;
}

export const numberInputValueToPercentage = (value: number, config: PlayerNumberInputConfig<any, any>) =>
	Number(formatToNumber(value / 100, { maximumFractionDigits: config.maxDecimalDigits, useGrouping: false }));

export const numberInputPercentToValue = (value: number, config: PlayerNumberInputConfig<any, any>) =>
	Number(formatToNumber(value * 100, { maximumFractionDigits: config.maxDecimalDigits, useGrouping: false }));

export const makeClassOptionsNumberInput = <SpecType extends Spec>(
	config: PlayerNumberInputConfig<SpecType, ClassOptions<SpecType>>,
): TypedNumberPickerConfig<Player<SpecType>> => {
	const internalConfig = {
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		float: config.float,
		showZeroes: config.showZeroes,
		maxDecimalDigits: config.maxDecimalDigits,
		positive: config.positive,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getClassOptions()[config.fieldName] as unknown as number),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: number) => {
				const newMessage = player.getClassOptions();
				if (config?.max && newVal > config.max) {
					newVal = config.max;
				}
				(newMessage[config.fieldName] as unknown as number) = newVal;
				player.setClassOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
		extraClassNames: config.extraClassNames,
	};
	if (config.percent) {
		const getValue = internalConfig.getValue;
		internalConfig.getValue = (player: Player<SpecType>) => numberInputPercentToValue(getValue(player), config);
		const setValue = internalConfig.setValue;
		internalConfig.setValue = (player: Player<SpecType>, newVal: number) => setValue(player, numberInputValueToPercentage(newVal, config));
	}
	return makeWrappedNumberInput<SpecType, Player<SpecType>>(internalConfig);
};
export const makeSpecOptionsNumberInput = <SpecType extends Spec>(
	config: PlayerNumberInputConfig<SpecType, SpecOptions<SpecType>>,
): TypedNumberPickerConfig<Player<SpecType>> => {
	const internalConfig = {
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		float: config.float,
		showZeroes: config.showZeroes,
		maxDecimalDigits: config.maxDecimalDigits,
		positive: config.positive,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSpecOptions()[config.fieldName] as unknown as number),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: number) => {
				const newMessage = player.getSpecOptions();
				if (config?.max && newVal > config.max) {
					newVal = config.max;
				}
				(newMessage[config.fieldName] as unknown as number) = newVal;
				player.setSpecOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
		extraClassNames: config.extraClassNames,
	};

	if (config.percent) {
		const getValue = internalConfig.getValue;
		internalConfig.getValue = (player: Player<SpecType>) => numberInputPercentToValue(getValue(player), config);
		const setValue = internalConfig.setValue;
		internalConfig.setValue = (player: Player<SpecType>, newVal: number) => setValue(player, numberInputValueToPercentage(newVal, config));
	}
	return makeWrappedNumberInput<SpecType, Player<SpecType>>(internalConfig);
};
export const makeRotationNumberInput = <SpecType extends Spec>(
	config: PlayerNumberInputConfig<SpecType, SpecRotation<SpecType>>,
): TypedNumberPickerConfig<Player<SpecType>> => {
	const internalConfig = {
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		float: config.float,
		showZeroes: config.showZeroes,
		positive: config.positive,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSimpleRotation()[config.fieldName] as unknown as number),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: number) => {
				const newMessage = player.getSimpleRotation();
				if (config?.max && newVal > config.max) {
					newVal = config.max;
				}
				(newMessage[config.fieldName] as unknown as number) = newVal;
				player.setSimpleRotation(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'rotation'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
		extraClassNames: config.extraClassNames,
	};
	if (config.percent) {
		const getValue = internalConfig.getValue;
		internalConfig.getValue = (player: Player<SpecType>) => numberInputPercentToValue(getValue(player), config);
		const setValue = internalConfig.setValue;
		internalConfig.setValue = (player: Player<SpecType>, newVal: number) => setValue(player, numberInputValueToPercentage(newVal, config));
	}
	return makeWrappedNumberInput<SpecType, Player<SpecType>>(internalConfig);
};

/////////////////////////////////////////////////////////////////////////////////
//                                    ENUM
/////////////////////////////////////////////////////////////////////////////////
export interface TypedEnumPickerConfig<ModObject> extends EnumPickerConfig<ModObject> {
	type: 'enum';
}

interface WrappedEnumInputConfig<SpecType extends Spec, ModObject> extends EnumPickerConfig<ModObject> {
	getModObject: (player: Player<SpecType>) => ModObject;
}
const makeWrappedEnumInput = <SpecType extends Spec, ModObject>(
	config: WrappedEnumInputConfig<SpecType, ModObject>,
): TypedEnumPickerConfig<Player<SpecType>> => {
	const getModObject = config.getModObject;
	return {
		id: config.id,
		type: 'enum',
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		values: config.values,
		storeSubscribe: config.storeSubscribe && (player => config.storeSubscribe!(getModObject(player))),
		storeField: config.storeField,
		getValue: (player: Player<SpecType>) => config.getValue(getModObject(player)),
		setValue: (player: Player<SpecType>, newValue: number) => config.setValue(getModObject(player), newValue),
		enableWhen: config.enableWhen ? (player: Player<SpecType>) => config.enableWhen!(getModObject(player)) : undefined,
		showWhen: config.showWhen ? (player: Player<SpecType>) => config.showWhen!(getModObject(player)) : undefined,
	};
};

export interface PlayerEnumInputConfig<SpecType extends Spec, Message> {
	fieldName: keyof Message;
	label: string;
	labelTooltip?: string;
	description?: string | Element;
	values: Array<EnumValueConfig>;
	getValue?: (player: Player<SpecType>) => number;
	setValue?: (player: Player<SpecType>, newValue: number) => void;
	enableWhen?: (player: Player<SpecType>) => boolean;
	showWhen?: (player: Player<SpecType>) => boolean;
	storeSubscribe?: (player: Player<SpecType>) => StoreSubscribe;
	storeField?: StoreField | ReadonlyArray<StoreField>;
}
// T is unused, but kept to have the same interface as the icon enum inputs.
export const makeClassOptionsEnumInput = <SpecType extends Spec, _T>(
	config: PlayerEnumInputConfig<SpecType, ClassOptions<SpecType>>,
): TypedEnumPickerConfig<Player<SpecType>> => {
	return makeWrappedEnumInput<SpecType, Player<SpecType>>({
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		values: config.values,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getClassOptions()[config.fieldName] as unknown as number),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: number) => {
				const newMessage = player.getClassOptions();
				(newMessage[config.fieldName] as unknown as number) = newVal;
				player.setClassOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
	});
};
// T is unused, but kept to have the same interface as the icon enum inputs.
export const makeSpecOptionsEnumInput = <SpecType extends Spec, _T>(
	config: PlayerEnumInputConfig<SpecType, SpecOptions<SpecType>>,
): TypedEnumPickerConfig<Player<SpecType>> => {
	return makeWrappedEnumInput<SpecType, Player<SpecType>>({
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		values: config.values,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSpecOptions()[config.fieldName] as unknown as number),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: number) => {
				const newMessage = player.getSpecOptions();
				(newMessage[config.fieldName] as unknown as number) = newVal;
				player.setSpecOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
	});
};
// T is unused, but kept to have the same interface as the icon enum inputs.
export const makeRotationEnumInput = <SpecType extends Spec, _T>(
	config: PlayerEnumInputConfig<SpecType, SpecRotation<SpecType>>,
): TypedEnumPickerConfig<Player<SpecType>> => {
	return makeWrappedEnumInput<SpecType, Player<SpecType>>({
		id: `${String(config.fieldName) || randomUUID()}`,
		label: config.label,
		labelTooltip: config.labelTooltip,
		description: config.description,
		values: config.values,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSimpleRotation()[config.fieldName] as unknown as number),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: number) => {
				const newMessage = player.getSimpleRotation();
				(newMessage[config.fieldName] as unknown as number) = newVal;
				player.setSimpleRotation(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'rotation'),
		enableWhen: config.enableWhen,
		showWhen: config.showWhen,
	});
};

/////////////////////////////////////////////////////////////////////////////////
//                                  ICON
/////////////////////////////////////////////////////////////////////////////////
export type TypedIconPickerConfig<ModObject, T> = IconPickerConfig<ModObject, T> & { type: 'icon' };

type WrappedIconInputConfig<SpecType extends Spec, ModObject, T> = IconPickerConfig<ModObject, T> & {
	getModObject: (player: Player<SpecType>) => ModObject;
};
const makeWrappedIconInput = <SpecType extends Spec, ModObject, T>(
	config: WrappedIconInputConfig<SpecType, ModObject, T>,
): TypedIconPickerConfig<Player<SpecType>, T> => {
	const getModObject = config.getModObject;
	return {
		type: 'icon',
		actionId: config.actionId,
		label: config.label,
		states: config.states,
		...mapStoreBinding(config, getModObject),
		showWhen: (player: Player<SpecType>) => !config.showWhen || (config.showWhen(getModObject(player)) as any),
		getValue: (player: Player<SpecType>) => config.getValue(getModObject(player)),
		setValue: (player: Player<SpecType>, newValue: T) => config.setValue(getModObject(player), newValue),
		extraClassNames: config.extraClassNames,
	};
};

type WrappedTypedInputConfig<Message, ModObject, T> = StoreBinding<ModObject> & {
	getModObject: (player: Player<any>) => ModObject;
	getValue: (modObj: ModObject) => Message;
	setValue: (modObj: ModObject, messageVal: Message) => void;
	extraClassNames?: Array<string>;

	showWhen?: (obj: ModObject) => boolean;
	getFieldValue?: (modObj: ModObject) => T;
	setFieldValue?: (modObj: ModObject, newValue: T) => void;
};

export const makeBooleanIconInput = <SpecType extends Spec, Message, ModObject>(
	config: WrappedTypedInputConfig<Message, ModObject, boolean>,
	actionId: ActionId,
	fieldName: keyof Message,
	value?: number,
	label?: string,
): TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return makeWrappedIconInput<SpecType, ModObject, boolean>({
		getModObject: config.getModObject,
		actionId,
		label,
		states: 2,
		...mapStoreBinding(config, (modObj: ModObject) => modObj),
		showWhen: config.showWhen,
		getValue:
			config.getFieldValue ||
			((modObj: ModObject) =>
				value ? (config.getValue(modObj)[fieldName] as unknown as number) == value : (config.getValue(modObj)[fieldName] as unknown as boolean)),
		setValue:
			config.setFieldValue ||
			((modObj: ModObject, newValue: boolean) => {
				const newMessage = config.getValue(modObj);
				if (value) {
					if (newValue) {
						(newMessage[fieldName] as unknown as number) = value;
					} else if ((newMessage[fieldName] as unknown as number) == value) {
						(newMessage[fieldName] as unknown as number) = 0;
					}
				} else {
					(newMessage[fieldName] as unknown as boolean) = newValue;
				}
				config.setValue(modObj, newMessage);
			}),
		extraClassNames: config.extraClassNames,
	});
};

export interface PlayerBooleanIconInputConfig<SpecType extends Spec, Message, T> extends BasePlayerConfig<SpecType, T> {
	fieldName: keyof Message;
	id: ActionId;
	value?: number;
}
export const makeClassOptionsBooleanIconInput = <SpecType extends Spec>(
	config: PlayerBooleanIconInputConfig<SpecType, ClassOptions<SpecType>, boolean>,
): TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return makeBooleanIconInput<SpecType, ClassOptions<SpecType>, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			getValue: (player: Player<SpecType>) => player.getClassOptions(),
			setValue: (player: Player<SpecType>, newVal: ClassOptions<SpecType>) => player.setClassOptions(newVal),
			...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
			extraClassNames: config.extraClassNames,
			getFieldValue: config.getValue,
			setFieldValue: config.setValue,
			showWhen: config.showWhen,
		},
		config.id,
		config.fieldName,
		config.value,
	);
};
export const makeSpecOptionsBooleanIconInput = <SpecType extends Spec>(
	config: PlayerBooleanIconInputConfig<SpecType, SpecOptions<SpecType>, boolean>,
): TypedIconPickerConfig<Player<SpecType>, boolean> => {
	return makeBooleanIconInput<SpecType, SpecOptions<SpecType>, Player<SpecType>>(
		{
			getModObject: (player: Player<SpecType>) => player,
			getValue: (player: Player<SpecType>) => player.getSpecOptions(),
			setValue: (player: Player<SpecType>, newVal: SpecOptions<SpecType>) => player.setSpecOptions(newVal),
			...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
			extraClassNames: config.extraClassNames,
			getFieldValue: config.getValue,
			setFieldValue: config.setValue,
			showWhen: config.showWhen,
		},
		config.id,
		config.fieldName,
		config.value,
	);
};

const makeNumberIconInput = <SpecType extends Spec, Message, ModObject>(
	config: WrappedTypedInputConfig<Message, ModObject, number>,
	actionId: ActionId,
	fieldName: keyof Message,
	multiplier?: number,
	label?: string,
): TypedIconPickerConfig<Player<SpecType>, number> => {
	return makeWrappedIconInput<SpecType, ModObject, number>({
		getModObject: config.getModObject,
		actionId,
		label,
		states: 0, // Must be assigned externally.
		...mapStoreBinding(config, (modObj: ModObject) => modObj),
		getValue: (modObj: ModObject) => config.getValue(modObj)[fieldName] as unknown as number,
		setValue: (modObj: ModObject, newValue: number) => {
			const newMessage = config.getValue(modObj);
			if (multiplier) {
				const sign = newValue - (newMessage[fieldName] as unknown as number);
				newValue += (multiplier - 1) * sign;
			}
			if (newValue < 0) {
				newValue = 0;
			}
			(newMessage[fieldName] as unknown as number) = newValue;
			config.setValue(modObj, newMessage);
		},
	});
};
export const makeTristateIconInput = <SpecType extends Spec, Message, ModObject>(
	config: WrappedTypedInputConfig<Message, ModObject, number>,
	id: ActionId,
	impId: ActionId,
	fieldName: keyof Message,
	label?: string,
): TypedIconPickerConfig<Player<SpecType>, number> => {
	const input = makeNumberIconInput<SpecType, Message, ModObject>(config, id, fieldName, undefined, label);
	input.states = 3;
	input.improvedId = impId;
	return input;
};
export const makeQuadstateIconInput = <SpecType extends Spec, Message, ModObject>(
	config: WrappedTypedInputConfig<Message, ModObject, number>,
	id: ActionId,
	impId: ActionId,
	impId2: ActionId,
	fieldName: keyof Message,
): TypedIconPickerConfig<Player<SpecType>, number> => {
	const input = makeNumberIconInput<SpecType, Message, ModObject>(config, id, fieldName);
	input.states = 4;
	input.improvedId = impId;
	input.improvedId2 = impId2;
	return input;
};
export const makeMultistateIconInput = <SpecType extends Spec, Message, ModObject>(
	config: WrappedTypedInputConfig<Message, ModObject, number>,
	id: ActionId,
	numStates: number,
	fieldName: keyof Message,
	multiplier?: number,
	label?: string,
): TypedIconPickerConfig<Player<SpecType>, number> => {
	const input = makeNumberIconInput<SpecType, Message, ModObject>(config, id, fieldName, multiplier, label);
	input.states = numStates;
	return input;
};

export type TypedIconEnumPickerConfig<ModObject, T> = IconEnumPickerConfig<ModObject, T> & { type: 'iconEnum' };

type WrappedEnumIconInputConfig<SpecType extends Spec, ModObject, T> = IconEnumPickerConfig<ModObject, T> & {
	getModObject: (player: Player<SpecType>) => ModObject;
};
const makeWrappedEnumIconInput = <SpecType extends Spec, ModObject, T>(
	config: WrappedEnumIconInputConfig<SpecType, ModObject, T>,
): TypedIconEnumPickerConfig<Player<SpecType>, T> => {
	const getModObject = config.getModObject;
	return {
		type: 'iconEnum',
		numColumns: config.numColumns,
		values: config.values.map(value => {
			if (value.showWhen) {
				const showWhen = value.showWhen;
				value.showWhen = ((player: Player<SpecType>) => showWhen(getModObject(player))) as any;
			}
			return value as unknown as IconEnumValueConfig<Player<SpecType>, T>;
		}),
		equals: config.equals,
		showWhen: (player: Player<SpecType>): boolean => !config.showWhen || (config.showWhen(getModObject(player)) as any),
		zeroValue: config.zeroValue,
		...mapStoreBinding(config, getModObject),
		getValue: (player: Player<SpecType>) => config.getValue(getModObject(player)),
		setValue: (player: Player<SpecType>, newValue: T) => config.setValue(getModObject(player), newValue),
		extraClassNames: config.extraClassNames,
	};
};

export interface PlayerEnumIconInputConfig<SpecType extends Spec, Message, T> extends BasePlayerConfig<SpecType, T> {
	fieldName: keyof Message;
	values: Array<IconEnumValueConfig<Player<SpecType>, T>>;
	numColumns?: number;
}
export const makeClassOptionsEnumIconInput = <SpecType extends Spec, T>(
	config: PlayerEnumIconInputConfig<SpecType, ClassOptions<SpecType>, T>,
): TypedIconEnumPickerConfig<Player<SpecType>, T> => {
	return makeWrappedEnumIconInput<SpecType, Player<SpecType>, T>({
		numColumns: config.numColumns || 1,
		values: config.values,
		equals: (a: T, b: T) => a == b,
		showWhen: config.showWhen,
		zeroValue: 0 as unknown as T,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getClassOptions()[config.fieldName] as unknown as T),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: T) => {
				const newMessage = player.getClassOptions();
				(newMessage[config.fieldName] as unknown as T) = newVal;
				player.setClassOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		extraClassNames: config.extraClassNames,
	});
};
export const makeSpecOptionsEnumIconInput = <SpecType extends Spec, T>(
	config: PlayerEnumIconInputConfig<SpecType, SpecOptions<SpecType>, T>,
): TypedIconEnumPickerConfig<Player<SpecType>, T> => {
	return makeWrappedEnumIconInput<SpecType, Player<SpecType>, T>({
		numColumns: config.numColumns || 1,
		values: config.values,
		equals: (a: T, b: T) => a == b,
		showWhen: config.showWhen,
		zeroValue: 0 as unknown as T,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSpecOptions()[config.fieldName] as unknown as T),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: T) => {
				const newMessage = player.getSpecOptions();
				(newMessage[config.fieldName] as unknown as T) = newVal;
				player.setSpecOptions(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'specOptions'),
		extraClassNames: config.extraClassNames,
	});
};
export const makeRotationEnumIconInput = <SpecType extends Spec, T>(
	config: PlayerEnumIconInputConfig<SpecType, SpecRotation<SpecType>, T>,
): TypedIconEnumPickerConfig<Player<SpecType>, T> => {
	return makeWrappedEnumIconInput<SpecType, Player<SpecType>, T>({
		numColumns: config.numColumns || 1,
		values: config.values,
		equals: (a: T, b: T) => a == b,
		showWhen: config.showWhen,
		zeroValue: 0 as unknown as T,
		getModObject: (player: Player<SpecType>) => player,
		getValue: config.getValue || ((player: Player<SpecType>) => player.getSimpleRotation()[config.fieldName] as unknown as T),
		setValue:
			config.setValue ||
			((player: Player<SpecType>, newVal: T) => {
				const newMessage = player.getSimpleRotation();
				(newMessage[config.fieldName] as unknown as T) = newVal;
				player.setSimpleRotation(newMessage);
			}),
		...storeBinding(config.storeSubscribe, config.storeField ?? 'rotation'),
		extraClassNames: config.extraClassNames,
	});
};

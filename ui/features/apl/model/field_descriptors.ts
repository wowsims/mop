import { ACTION_ID_SET } from './action_id_sets';
import { UNIT_SET } from './unit_sets';

export type DEFAULT_UNIT_REF = 'self' | 'currentTarget';

export interface FieldOptions {
	label?: string;
	labelTooltip?: string;
}

// The DOM-free half of an APL picker field: which proto field it edits, how to
// label it, and a `type` tag naming the picker the view should build for it.
// The view (`apl_helpers.tsx` / `apl_values.ts` / `apl_actions.ts`) owns the
// tag -> picker-factory mapping; nothing here touches the DOM.
type FieldDescriptorPayloads = {
	// Handled by view/apl_helpers.tsx.
	actionId: { field: string; actionIdSet: ACTION_ID_SET; unitRefField?: string; defaultUnitRef?: DEFAULT_UNIT_REF; options?: FieldOptions };
	unit: { field: string; unitSet: UNIT_SET; options?: FieldOptions };
	boolean: { field: string; label?: string; options?: FieldOptions };
	number: { field: string; float: boolean; options?: FieldOptions };
	string: { field: string; options?: FieldOptions };
	variableName: { field: string; options?: FieldOptions };
	placeholderName: { field: string; options?: FieldOptions };
	groupName: { field: string; options?: FieldOptions };
	groupReferenceVariables: { field: string; groupNameField: string; options?: FieldOptions };
	eclipseType: { field: string };
	runeType: { field: string; includeDeath: boolean };
	runeSlot: { field: string };
	rotationType: { field: string };
	hotwStrategy: { field: string };
	statType: { field: string };
	damageAmpType: { field: string };
	itemSwapSet: { field: string };
	minIcd: object;
	reactionTime: object;
	useDotBaseValue: object;
	useRuneRegenBaseValue: object;
	// Handled by view/apl_values.ts (they build APL value pickers).
	comparisonOperator: { field: string };
	mathOperator: { field: string };
	executePhaseThreshold: { field: string };
	totemType: { field: string };
	value: { field: string; options?: FieldOptions };
	valueList: { field: string };
	// Handled by view/apl_actions.ts (they build APL action pickers).
	action: { field: string };
	actionList: { field: string };
};

type Descriptor<K extends keyof FieldDescriptorPayloads> = { type: K } & FieldDescriptorPayloads[K];

export type APLFieldDescriptor = { [K in keyof FieldDescriptorPayloads]: Descriptor<K> }[keyof FieldDescriptorPayloads];

/** Everything an APL *value* kind may use — i.e. no action pickers. */
export type ValueFieldDescriptor = Exclude<APLFieldDescriptor, Descriptor<'action' | 'actionList'>>;

/** The subset `apl_helpers.tsx` can build without knowing about value/action pickers. */
export type CommonFieldDescriptor = Exclude<
	ValueFieldDescriptor,
	Descriptor<'comparisonOperator' | 'mathOperator' | 'executePhaseThreshold' | 'totemType' | 'value' | 'valueList'>
>;

// Constructors mirror the argument order of the `*FieldConfig` picker factories
// they replace in the view, so the kind tables below read exactly as before.
export function actionIdFieldConfig(
	field: string,
	actionIdSet: ACTION_ID_SET,
	unitRefField?: string,
	defaultUnitRef?: DEFAULT_UNIT_REF,
	options?: FieldOptions,
): Descriptor<'actionId'> {
	return { type: 'actionId', field, actionIdSet, unitRefField, defaultUnitRef, options };
}

export function unitFieldConfig(field: string, unitSet: UNIT_SET, options?: FieldOptions): Descriptor<'unit'> {
	return { type: 'unit', field, unitSet, options };
}

export function booleanFieldConfig(field: string, label?: string, options?: FieldOptions): Descriptor<'boolean'> {
	return { type: 'boolean', field, label, options };
}

export function numberFieldConfig(field: string, float: boolean, options?: FieldOptions): Descriptor<'number'> {
	return { type: 'number', field, float, options };
}

export function stringFieldConfig(field: string, options?: FieldOptions): Descriptor<'string'> {
	return { type: 'string', field, options };
}

export function variableNameFieldConfig(field: string, options?: FieldOptions): Descriptor<'variableName'> {
	return { type: 'variableName', field, options };
}

export function placeholderNameFieldConfig(field: string, options?: FieldOptions): Descriptor<'placeholderName'> {
	return { type: 'placeholderName', field, options };
}

export function groupNameFieldConfig(field: string, options?: FieldOptions): Descriptor<'groupName'> {
	return { type: 'groupName', field, options };
}

export function groupReferenceVariablesFieldConfig(field: string, groupNameField: string, options?: FieldOptions): Descriptor<'groupReferenceVariables'> {
	return { type: 'groupReferenceVariables', field, groupNameField, options };
}

export function eclipseTypeFieldConfig(field: string): Descriptor<'eclipseType'> {
	return { type: 'eclipseType', field };
}

export function runeTypeFieldConfig(field: string, includeDeath: boolean): Descriptor<'runeType'> {
	return { type: 'runeType', field, includeDeath };
}

export function runeSlotFieldConfig(field: string): Descriptor<'runeSlot'> {
	return { type: 'runeSlot', field };
}

export function rotationTypeFieldConfig(field: string): Descriptor<'rotationType'> {
	return { type: 'rotationType', field };
}

export function hotwStrategyFieldConfig(field: string): Descriptor<'hotwStrategy'> {
	return { type: 'hotwStrategy', field };
}

export function statTypeFieldConfig(field: string): Descriptor<'statType'> {
	return { type: 'statType', field };
}

export function damageAmpTypeFieldConfig(field: string): Descriptor<'damageAmpType'> {
	return { type: 'damageAmpType', field };
}

export function itemSwapSetFieldConfig(field: string): Descriptor<'itemSwapSet'> {
	return { type: 'itemSwapSet', field };
}

export const minIcdInput: Descriptor<'minIcd'> = { type: 'minIcd' };

export function reactionTimeCheckbox(): Descriptor<'reactionTime'> {
	return { type: 'reactionTime' };
}

export function makeUseDotBaseValueCheckbox(): Descriptor<'useDotBaseValue'> {
	return { type: 'useDotBaseValue' };
}

export function makeUseRuneRegenBaseValueCheckbox(): Descriptor<'useRuneRegenBaseValue'> {
	return { type: 'useRuneRegenBaseValue' };
}

export function comparisonOperatorFieldConfig(field: string): Descriptor<'comparisonOperator'> {
	return { type: 'comparisonOperator', field };
}

export function mathOperatorFieldConfig(field: string): Descriptor<'mathOperator'> {
	return { type: 'mathOperator', field };
}

export function executePhaseThresholdFieldConfig(field: string): Descriptor<'executePhaseThreshold'> {
	return { type: 'executePhaseThreshold', field };
}

export function totemTypeFieldConfig(field: string): Descriptor<'totemType'> {
	return { type: 'totemType', field };
}

export function valueFieldConfig(field: string, options?: FieldOptions): Descriptor<'value'> {
	return { type: 'value', field, options };
}

export function valueListFieldConfig(field: string): Descriptor<'valueList'> {
	return { type: 'valueList', field };
}

export function actionFieldConfig(field: string): Descriptor<'action'> {
	return { type: 'action', field };
}

export function actionListFieldConfig(field: string): Descriptor<'actionList'> {
	return { type: 'actionList', field };
}

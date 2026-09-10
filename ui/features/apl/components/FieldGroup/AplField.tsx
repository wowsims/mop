import { ActionPicker } from '@features/apl/components/ActionPicker';
import { ValuePicker } from '@features/apl/components/ValuePicker';
import { useApl } from '@features/apl/context/AplContext';
import type { AplFieldSpec } from '@features/apl/model/field_specs';
import type { Player } from '@sim/player/player';
import { AdaptiveStringPicker } from '@ui-kit/AdaptiveStringPicker';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { useId } from 'react';

import { ActionIdField } from './fields/ActionIdField';
import { ActionListField } from './fields/ActionListField';
import { EnumField } from './fields/EnumField';
import { GroupVariablesField } from './fields/GroupVariablesField';
import { PlaceholderNameField } from './fields/PlaceholderNameField';
import { RotationNameField } from './fields/RotationNameField';
import { UnitField } from './fields/UnitField';
import { ValueListField } from './fields/ValueListField';
import { fieldInputConfig } from './utils';

export interface AplFieldProps {
	player: Player<any>;
	spec: AplFieldSpec;
	/** The kind's impl message this field lives on. */
	getParentValue: () => any;
}

/**
 * One field of an APL kind, dispatched on the shape its descriptor resolved to.
 *
 * **This is where the value and action trees close their loop**, and the rule that keeps it
 * working is narrow: `ValuePicker` → `FieldGroup` → `AplField` → `ValuePicker` is a genuine ES
 * module cycle, and it is safe because nothing in it is read at module-evaluation time. The
 * dispatch is a `switch` **inside the component body**, so the imported binding is resolved when
 * the field renders, long after every module in the cycle has finished evaluating.
 *
 * A module-level lookup table — the mapped type this codebase otherwise prefers for a
 * discriminated union — would break exactly that: it reads the imported component while the cycle
 * is still initialising, and the first module in is the one that throws a `ReferenceError`. That is
 * also the shape vanilla had, in `valueKindFactories` / `actionKindFactories`, and why its authors
 * concluded the cluster could not be ported in halves.
 */
export const AplField = ({ player, spec, getParentValue }: AplFieldProps) => {
	const id = useId();
	const { changeSource } = useApl();
	const config = fieldInputConfig(spec, id, getParentValue, changeSource);

	switch (spec.kind) {
		case 'boolean':
			return <BooleanPicker modObject={player} config={config} />;
		case 'number':
			return <NumberPicker modObject={player} config={{ ...config, float: spec.float }} />;
		case 'string':
			return <AdaptiveStringPicker modObject={player} config={config} />;
		case 'enum':
			return <EnumField player={player} config={config} table={spec.table} />;
		case 'actionId':
			return (
				<ActionIdField
					player={player}
					config={config}
					actionIdSet={spec.actionIdSet}
					unitRefField={spec.unitRefField}
					defaultUnitRef={spec.defaultUnitRef}
					getParentValue={getParentValue}
				/>
			);
		case 'unit':
			return <UnitField player={player} config={config} unitSet={spec.unitSet} />;
		case 'rotationName':
			return <RotationNameField player={player} config={config} source={spec.source} />;
		case 'placeholderName':
			return <PlaceholderNameField player={player} config={config} getParentValue={getParentValue} />;
		case 'groupVariables':
			return <GroupVariablesField player={player} config={config} groupNameField={spec.groupNameField} getParentValue={getParentValue} />;
		case 'value':
			return <ValuePicker player={player} config={config} />;
		case 'valueList':
			return <ValueListField player={player} config={config} />;
		case 'action':
			return <ActionPicker player={player} config={config} />;
		case 'actionList':
			return <ActionListField player={player} config={config} />;
	}
};

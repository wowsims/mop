import type { APLFieldDescriptor } from '@features/apl/model/field_descriptors';
import { resolveField } from '@features/apl/model/field_specs';
import type { Player } from '@sim/player/player';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { useId, useMemo } from 'react';

import { AplField } from './AplField';

export interface FieldGroupProps {
	player: Player<any>;
	/** The kind's impl message. Every field edits one of its properties. */
	config: InputConfig<Player<any>, any>;
	/** The kind's field list, straight from `model/value_kinds.ts` or `model/action_kinds.ts`. */
	fields: Array<APLFieldDescriptor>;
}

/**
 * The fields of one APL kind.
 *
 * Each field writes its own property of the live message, so the group renders and holds no value
 * of its own — nothing here reassembles the message from its fields.
 *
 * The descriptors are resolved once per kind. They come from a module-level table, so the memo
 * holds for the life of the picker and the enum option lists it produces keep their identity —
 * which is what stops the dropdown menu tree being rebuilt on every keystroke elsewhere.
 */
export const FieldGroup = ({ player, config, fields }: FieldGroupProps) => {
	const generatedId = useId();
	const specs = useMemo(() => fields.map(resolveField), [fields]);
	const getParentValue = () => config.getValue(player);

	return (
		<PickerShell config={{ ...config, id: config.id || generatedId }} className="apl-picker-builder-root" hidden={false} disabled={false}>
			{/* The field list is fixed by the kind, so the position is the identity. */}
			{specs.map((spec, index) => (
				<AplField key={index} player={player} spec={spec} getParentValue={getParentValue} />
			))}
		</PickerShell>
	);
};

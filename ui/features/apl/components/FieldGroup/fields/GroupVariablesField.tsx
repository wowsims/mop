import { placeholderNames } from '@features/apl/model/placeholders';
import { rotationSource } from '@features/apl/utils';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { randomUUID } from '@sim/utils/misc';
import type { InputConfig } from '@ui-kit/input';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';
import { PickerShell } from '@ui-kit/PickerShell';
import { useCallback, useMemo, useRef } from 'react';

import { GroupVariableRow } from './GroupVariableRow';

export interface GroupVariablesFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, Array<any>> & { id: string };
	/** The sibling field naming the group being referenced. */
	groupNameField: string;
	getParentValue: () => any;
}

const newVariable = (name: string) => ({
	name,
	value: { uuid: { value: randomUUID() }, value: { oneofKind: 'variableRef', variableRef: { name: '' } } },
});

/**
 * The variables a referenced group expects, one row per placeholder the group defines.
 *
 * The row set is derived: it is exactly the placeholder names of the selected group, and
 * `reconcile` rewrites the stored `variables` to that set, keeping whatever each name was already
 * assigned. It is a write on a read path, and **both** the container's own read and the list's
 * `getValue` have to call it: they are separate `useSyncExternalStore` subscribers, either may read
 * first on a notification, and a reader that skipped the reconcile would cache a row set the other
 * is about to replace. Calling it twice is safe because it is idempotent — the second call finds
 * every entry and writes nothing.
 *
 * Delete therefore acts on a list rebuilt underneath it: the row returns with its assignment
 * cleared, which is the useful reading of the button and the only one it can have. Copy is not
 * offered — a duplicate entry carries an existing name, so the next reconcile drops it.
 *
 * With no group selected, or one with no placeholders, there is nothing to pass and the container
 * is `d-none` — not the shell's `hide`, which is a different class.
 */
export const GroupVariablesField = ({ player, config, groupNameField, getParentValue }: GroupVariablesFieldProps) => {
	const parentRef = useRef(getParentValue);
	parentRef.current = getParentValue;

	const reconcile = useCallback((): Array<any> => {
		const parentValue = parentRef.current();
		const groupName = parentValue?.[groupNameField];
		const group = groupName ? (player.aplRotation?.groups || []).find(candidate => candidate.name === groupName) : undefined;
		const existing: Array<any> = parentValue?.variables || [];
		const reconciled = placeholderNames(group).map(name => existing.find(entry => entry.name === name) || newVariable(name));
		const changed = reconciled.length !== existing.length || reconciled.some((entry, index) => entry !== existing[index]);
		if (changed && parentValue) parentValue.variables = reconciled;
		return changed ? reconciled : existing;
	}, [player, groupNameField]);

	const subscribe = useMemo(() => rotationSource(player), [player]);
	const variables = useStoreSubscribe(subscribe, reconcile);

	const listConfig: ListPickerConfig<Player<any>, any> = {
		title: 'Group Variables',
		titleTooltip: "Variables to pass to the group. These will override the group's internal variables.",
		itemLabel: 'Variable',
		storeSubscribe: rotationSource,
		getValue: () => reconcile().slice(),
		setValue: (subject: Player<any>, next: Array<any>) => {
			const parentValue = parentRef.current();
			if (parentValue) parentValue.variables = next;
			config.setValue(subject, next);
		},
		newItem: () => {
			throw new Error('newItem should not be called for auto-populated group variables');
		},
		allowedActions: ['delete'],
	};

	return (
		<PickerShell
			// The list renders the title, so the field's own label would be a second one.
			config={{
				...config,
				label: undefined,
				labelTooltip: undefined,
				extraClassNames: [...(config.extraClassNames || []), ...(variables.length ? [] : ['d-none'])],
			}}
			className="group-reference-variables-container"
			hidden={false}
			disabled={false}>
			<ListPicker<Player<any>, any>
				modObject={player}
				config={listConfig}
				renderItem={(index, itemConfig) => (
					<GroupVariableRow
						player={player}
						config={itemConfig}
						name={itemConfig.getValue(player)?.name ?? ''}
						groupSelected={!!parentRef.current()?.[groupNameField]}
					/>
				)}
			/>
		</PickerShell>
	);
};

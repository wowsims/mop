import { rotationSource } from '@features/apl/utils';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { randomUUID } from '@sim/utils/misc';
import { DropdownField } from '@ui-kit/DropdownPicker';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { useId, useMemo } from 'react';

export interface GroupVariableRowProps {
	player: Player<any>;
	/** The list's binding to this row's `{ name, value }` entry. */
	config: InputConfig<Player<any>, any>;
	/** The placeholder this row fills in. */
	name: string;
	/** Without a selected group there is nothing to assign, and the menu offers nothing. */
	groupSelected: boolean;
}

/**
 * One placeholder of a referenced group, and the rotation variable being passed for it.
 *
 * The name is a real `<label>`, with the `htmlFor` naming the dropdown beside it — unlike the
 * list's own title, which labels no control at all and so had to become a `<span>`.
 */
export const GroupVariableRow = ({ player, config, name, groupSelected }: GroupVariableRowProps) => {
	const rootId = useId();
	const valueId = useId();

	const subscribe = rotationSource(player);
	const available = useStoreSubscribe(subscribe, () => (groupSelected ? (player.aplRotation?.valueVariables || []).map(variable => variable.name) : []));
	const options = useMemo(() => available.map(variableName => ({ value: variableName, label: variableName })), [available]);

	const valueConfig: InputConfig<Player<any>, string> & { id: string } = {
		id: valueId,
		// Empty, so the shell renders no label of its own: the name beside the control is the label.
		label: '',
		storeSubscribe: rotationSource,
		getValue: () => config.getValue(player)?.value?.value?.variableRef?.name || '',
		setValue: (subject: Player<any>, newValue: string) => {
			const entry = config.getValue(subject);
			if (!entry || !newValue) return;
			entry.value = { uuid: { value: randomUUID() }, value: { oneofKind: 'variableRef', variableRef: { name: newValue } } };
			subject.touchRotation();
		},
	};

	return (
		<PickerShell
			config={{ id: rootId, getValue: () => undefined, setValue: () => {} }}
			className="apl-group-variable-picker-root"
			hidden={false}
			disabled={false}>
			<label className="group-variable-label fw-bold d-block" htmlFor={valueId}>
				{name}:
			</label>
			<DropdownField<Player<any>, string>
				modObject={player}
				config={valueConfig}
				options={options}
				defaultLabel={i18n.t('rotation_tab.apl.helpers.select_variable')}
			/>
		</PickerShell>
	);
};

import { rotationSource } from '@features/apl/utils';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { DropdownField } from '@ui-kit/DropdownPicker';
import type { InputConfig } from '@ui-kit/input';
import { useMemo } from 'react';

export type RotationNameSource = 'variables' | 'groups';

export interface RotationNameFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, string> & { id: string };
	source: RotationNameSource;
}

const LABELS = {
	variables: { defaultLabel: 'rotation_tab.apl.helpers.select_variable', empty: 'rotation_tab.apl.helpers.no_variables_defined' },
	groups: { defaultLabel: 'rotation_tab.apl.helpers.select_group', empty: 'rotation_tab.apl.helpers.no_groups_defined' },
} as const;

/**
 * A dropdown over the names the rotation already defines — its value variables, or its action
 * groups.
 *
 * An empty source still offers one option, which is what makes the menu openable and says why it
 * is empty.
 */
export const RotationNameField = ({ player, config, source }: RotationNameFieldProps) => {
	const subscribe = useMemo(() => rotationSource(player), [player]);
	const names = useStoreSubscribe(subscribe, () =>
		(source == 'variables' ? player.aplRotation?.valueVariables || [] : player.aplRotation?.groups || []).map(entry => entry.name),
	);

	const options = useMemo(
		() => (names.length ? names.map(name => ({ value: name, label: name })) : [{ value: '', label: i18n.t(LABELS[source].empty) }]),
		[names, source],
	);

	return <DropdownField<Player<any>, string> modObject={player} config={config} options={options} defaultLabel={i18n.t(LABELS[source].defaultLabel)} />;
};

import type { Player } from '@domain/player';
import { usePlayer } from '@features/SimHostContext';
import type { InputConfig } from '@features/spec_config';
import { EnumPicker } from '@ui-kit/EnumPicker';
import type { IconInputConfig } from '@ui-kit/icon_inputs';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { IconPicker } from '@ui-kit/IconPicker';
import clsx from 'clsx';
import { useMemo } from 'react';

import { InputPicker } from '../InputPicker';
import { iconGridColumns, professionInput, raceInput } from './utils';

export interface PlayerSettingsProps {
	/** `playerIconInputs` — the spec's class-specific toggles. Empty on more than half the specs. */
	iconInputs: ReadonlyArray<IconInputConfig<Player<any>, any>>;
	/** `playerInputs.inputs`, which only the three rogue specs declare. */
	inputs: ReadonlyArray<InputConfig<Player<any>>>;
}

/**
 * The Player block: a row of class-specific icons, the race select, whatever generic inputs the
 * spec declares, and the two professions.
 *
 * Mixed on purpose — it is the block where the three generic walks and two hand-rolled controls sit
 * side by side, so it fixes nothing beyond the order they appear in.
 *
 * The inline `gridTemplateColumns` is load-bearing and invisible to the tree gates: `SERIALIZE`
 * reads the class attribute and nothing else, so dropping it would cost a column layout that no
 * check could report.
 */
export const PlayerSettings = ({ iconInputs, inputs }: PlayerSettingsProps) => {
	const player = usePlayer() as Player<any>;
	// The values lists are built from the class and from an enum, and neither changes for the life of
	// the page; rebuilding them per render would hand `EnumPicker` a new config on every notification.
	const race = useMemo(() => raceInput(player), [player]);
	const professions = useMemo(() => [professionInput(1), professionInput(2)] as const, []);

	return (
		<>
			<div
				className={clsx('picker-group', 'player-icon-group', 'icon-group', iconInputs.length === 0 && 'hide')}
				style={{ gridTemplateColumns: iconGridColumns(iconInputs.length) }}>
				{iconInputs.map((config, index) =>
					// The lists are module-level constants that never reorder and the configs carry no
					// id, so the index is the key.
					config.type === 'icon' ? (
						<IconPicker key={index} modObject={player} config={config} />
					) : (
						<IconEnumPicker key={index} modObject={player} config={config} />
					),
				)}
			</div>
			<EnumPicker modObject={player} config={race} />
			{inputs.map(config => (
				<InputPicker key={config.id} config={config} />
			))}
			<div className="picker-group">
				{professions.map(config => (
					<EnumPicker key={config.id} modObject={player} config={config} />
				))}
			</div>
		</>
	);
};

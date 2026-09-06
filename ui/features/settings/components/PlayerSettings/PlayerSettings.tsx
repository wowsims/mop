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
	iconInputs: ReadonlyArray<IconInputConfig<Player<any>, any>>;
	inputs: ReadonlyArray<InputConfig<Player<any>>>;
}

export const PlayerSettings = ({ iconInputs, inputs }: PlayerSettingsProps) => {
	const player = usePlayer() as Player<any>;
	const race = useMemo(() => raceInput(player), [player]);
	const professions = useMemo(() => [professionInput(1), professionInput(2)] as const, []);

	return (
		<>
			<div
				className={clsx('picker-group', 'player-icon-group', 'icon-group', iconInputs.length === 0 && 'hide')}
				style={{ gridTemplateColumns: iconGridColumns(iconInputs.length) }}>
				{iconInputs.map((config, index) =>
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

import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { iconGridColumns, type IconInputConfig } from '@ui-kit/icon_inputs';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { IconPicker } from '@ui-kit/IconPicker';

export interface RotationIconGroupProps {
	inputs: ReadonlyArray<IconInputConfig<Player<any>, any>>;
}

/**
 * The rotation tab's icon row.
 *
 * `configureIconSection`'s `hide` branch is dropped: it fired only for an empty picker list, and
 * the one caller built the list from a `rotationIconInputs` array it had already checked was
 * non-empty, so that branch could never run.
 */
export const RotationIconGroup = ({ inputs }: RotationIconGroupProps) => {
	const player = usePlayer();

	return (
		<div className="picker-group rotation-icon-group icon-group" style={{ gridTemplateColumns: iconGridColumns(inputs.length) }}>
			{inputs.map((config, index) =>
				config.type === 'icon' ? (
					<IconPicker key={index} modObject={player} config={config} />
				) : (
					<IconEnumPicker key={index} modObject={player} config={config} />
				),
			)}
		</div>
	);
};

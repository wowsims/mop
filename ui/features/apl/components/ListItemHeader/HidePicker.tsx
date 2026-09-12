import { useAplInput } from '@features/apl/hooks/useAplInput';
import type { Player } from '@sim/player/player';
import type { InputConfig } from '@ui-kit/input';
import { ListItemAction } from '@ui-kit/ListPicker';
import { PickerShell } from '@ui-kit/PickerShell';

export interface HidePickerProps {
	player: Player<any>;
	config: InputConfig<Player<any>, boolean>;
}

/**
 * The eye that disables one APL list item.
 *
 * It deliberately has no tooltip: the "Enable/Disable" string it would want was never translated,
 * so adding it would put one English label into an otherwise localised header.
 */
export const HidePicker = ({ player, config }: HidePickerProps) => {
	const { value, setValue, hidden, disabled, shellConfig } = useAplInput(player, config);

	return (
		<PickerShell config={shellConfig} className="hide-picker-root" hidden={hidden} disabled={disabled}>
			<ListItemAction icon={value ? 'fa-eye-slash' : 'fa-eye'} className="hide-picker-button" onClick={() => setValue(!value)} />
		</PickerShell>
	);
};

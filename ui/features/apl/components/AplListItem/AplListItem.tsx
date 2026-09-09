import { ActionPicker } from '@features/apl/components/ActionPicker';
import { useAplInput } from '@features/apl/hooks/useAplInput';
import type { APLAction } from '@generated/proto/apl';
import type { Player } from '@sim/player/player';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import type { ReactNode } from 'react';

/** The shape the three action lists share: a row that can be hidden and holds one action. */
export interface HideableAction {
	hide: boolean;
	action?: APLAction;
}

export interface AplListItemProps<T extends HideableAction> {
	player: Player<any>;
	config: InputConfig<Player<any>, T>;
	/** Rendered above the action picker — the pre-pull list's "Do At" value. */
	leading?: ReactNode;
}

/**
 * One row of the priority list, a group's action list or the pre-pull list.
 *
 * A hidden row renders `disabled` rather than being unmounted — that is all `hide` means here.
 */
export const AplListItem = <T extends HideableAction>({ player, config, leading }: AplListItemProps<T>) => {
	const { hidden, disabled, shellConfig } = useAplInput(player, { ...config, enableWhen: () => !config.getValue(player)?.hide });

	const item = () => config.getValue(player);

	return (
		<PickerShell config={shellConfig} className="apl-list-item-picker-root" hidden={hidden} disabled={disabled}>
			{leading}
			<ActionPicker
				player={player}
				config={{
					getValue: () => item().action!,
					setValue: (subject: Player<any>, newValue: APLAction) => {
						const current = item();
						if (!current) return;
						current.action = newValue;
						subject.touchRotation();
					},
				}}
			/>
		</PickerShell>
	);
};

import { ActionPicker } from '@features/apl/components/ActionPicker';
import { AplProvider, useApl } from '@features/apl/context/AplContext';
import { useAplInput } from '@features/apl/hooks/useAplInput';
import { rowSource } from '@features/apl/model/row_source';
import type { APLAction } from '@generated/proto/apl';
import type { Player } from '@sim/player/player';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { type ReactNode, useMemo, useRef } from 'react';

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
	const { changeSource } = useApl();
	const { hidden, disabled, shellConfig } = useAplInput(player, { ...config, enableWhen: () => !config.getValue(player)?.hide });

	const item = useRef(() => config.getValue(player));
	item.current = () => config.getValue(player);

	const row = useMemo(() => {
		const source = rowSource(changeSource(player), () => item.current());
		const action: InputConfig<Player<any>, APLAction> = {
			getValue: () => item.current().action!,
			setValue: (subject: Player<any>, newValue: APLAction) => {
				const current = item.current();
				if (!current) return;
				current.action = newValue;
				subject.touchRotation();
			},
		};
		return { changeSource: () => source, action };
	}, [player, changeSource]);

	return (
		<AplProvider changeSource={row.changeSource}>
			<PickerShell config={shellConfig} className="apl-list-item-picker-root" hidden={hidden} disabled={disabled}>
				{leading}
				<ActionPicker player={player} config={row.action} />
			</PickerShell>
		</AplProvider>
	);
};

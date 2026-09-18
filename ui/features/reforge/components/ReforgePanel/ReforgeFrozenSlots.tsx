import { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import type { Player } from '@sim/player/player';
import type { ReforgeSettings } from '@sim/settings/reforge_settings';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import clsx from 'clsx';
import { useMemo } from 'react';

import { useReforgeIdPrefix } from './ReforgeIdPrefixContext';

export interface ReforgeFrozenSlotsProps {
	settings: ReforgeSettings;
	player: Player<any>;
	freezeItemSlots: boolean;
}

/** Two slots per row, in the gear's own slot order. The slot list is the whole slot enum, so it is memoised on the player. */
export const ReforgeFrozenSlots = ({ settings, player, freezeItemSlots }: ReforgeFrozenSlotsProps) => {
	const idPrefix = useReforgeIdPrefix();
	const slotsByRow = useMemo(() => {
		const allSlots = player.getGear().getItemSlots();
		const numRows = Math.floor(allSlots.length / 2) + 1;
		return Array.from({ length: numRows }, (_row, rowIdx) => allSlots.slice(rowIdx * 2, (rowIdx + 1) * 2));
	}, [player]);

	return (
		<table className={clsx('mb-2', !freezeItemSlots && 'hidden')} hidden={!freezeItemSlots}>
			{/* React reports rows placed directly under <table> as a nesting error, so the parser's implied <tbody> is written out here instead. */}
			<tbody>
				{slotsByRow.map((slots, rowIdx) => (
					<tr key={rowIdx}>
						{slots.map(slot => (
							<td key={slot}>
								<BooleanPicker
									modObject={player}
									config={{
										id: `${idPrefix}-freeze-${ItemSlot[slot]}`,
										label: translateSlotName(slot),
										layout: 'inline',
										storeField: 'reforge:freezeItemSlots',
										getValue: () => settings.getFrozenItemSlot(slot) || false,
										setValue: (_player, newValue) => settings.setFrozenItemSlot(slot, newValue),
									}}
								/>
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
};

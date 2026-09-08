import { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import type { Player } from '@sim/player/player';
import type { ReforgeSettings } from '@sim/settings/reforge_settings';
import { subscribeReforgeField } from '@sim/state/subscriptions';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import clsx from 'clsx';
import { useMemo } from 'react';

export interface ReforgeFrozenSlotsProps {
	settings: ReforgeSettings;
	player: Player<any>;
	freezeItemSlots: boolean;
}

/** Two slots per row, in the gear's own slot order. The slot list is read once per open, as the vanilla builder did. */
export const ReforgeFrozenSlots = ({ settings, player, freezeItemSlots }: ReforgeFrozenSlotsProps) => {
	const slotsByRow = useMemo(() => {
		const allSlots = player.getGear().getItemSlots();
		const numRows = Math.floor(allSlots.length / 2) + 1;
		return Array.from({ length: numRows }, (_row, rowIdx) => allSlots.slice(rowIdx * 2, (rowIdx + 1) * 2));
	}, [player]);

	return (
		<table className={clsx('mb-2', !freezeItemSlots && 'd-none')}>
			{/* The vanilla table put its rows straight under <table>, which React reports as a nesting error — the parser's implied <tbody> is written out here instead. */}
			<tbody>
				{slotsByRow.map((slots, rowIdx) => (
					<tr key={rowIdx}>
						{slots.map(slot => (
							<td key={slot}>
								<BooleanPicker
									modObject={player}
									config={{
										id: 'reforge-optimizer-freeze-' + ItemSlot[slot],
										label: translateSlotName(slot),
										inline: true,
										storeSubscribe: () => subscribeReforgeField(settings, 'freezeItemSlots'),
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

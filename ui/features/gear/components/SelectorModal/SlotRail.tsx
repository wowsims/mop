import type { ItemSlot } from '@generated/proto/common';
import type { Gear } from '@sim/proto/gear';
import { Tooltip } from '@ui-kit/Tooltip';
import { useId } from 'react';

import { ALL_ITEM_SLOTS } from '../../model/gear_data';
import { SlotRailIcon } from './SlotRailIcon';

export interface SlotRailProps {
	gear: Gear;
	isBlacksmithing: boolean;
	currentSlot: ItemSlot | null;
	onOpen: (slot: ItemSlot) => void;
}

export const SlotRail = ({ gear, isBlacksmithing, currentSlot, onOpen }: SlotRailProps) => {
	const tooltipId = useId();

	return (
		<>
			<div className="gear-picker-modal-slots">
				{ALL_ITEM_SLOTS.map(slot => (
					<SlotRailIcon
						key={slot}
						slot={slot}
						item={gear.getEquippedItem(slot)}
						isBlacksmithing={isBlacksmithing}
						active={slot === currentSlot}
						tooltipId={tooltipId}
						onOpen={() => onOpen(slot)}
					/>
				))}
			</div>
			<Tooltip id={tooltipId} place="left" render={({ activeAnchor }) => `Edit ${(activeAnchor as HTMLElement | null)?.dataset.slotLabel ?? ''}`} />
		</>
	);
};

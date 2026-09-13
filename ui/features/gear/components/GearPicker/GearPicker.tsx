import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import clsx from 'clsx';

import { LEFT_ITEM_SLOTS, RIGHT_ITEM_SLOTS } from '../../model/gear_data';
import { ItemPickerCell } from './ItemPickerCell';

export interface GearPickerProps {
	ready: boolean;
}

export const GearPicker = ({ ready }: GearPickerProps) => (
	<div className="gear-picker-root grid grid-cols-2 gap-section max-lg:gap-(--spacing-stack) max-sm:grid-cols-1">
		<TabPanelColumns.Col className="gear-picker-left gap-(--spacing-stack) *:flex-row *:text-left [&>*:nth-child(6)]:mb-section" externalGap>
			{LEFT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</TabPanelColumns.Col>
		<TabPanelColumns.Col
			className={clsx(
				'gear-picker-right gap-(--spacing-stack) *:flex-row-reverse max-md:*:flex-row',
				'[&_.item-picker-labels-container]:items-end max-md:[&_.item-picker-labels-container]:items-start',
				'[&_.item-picker-labels-container]:text-right',
				'[&_.item-picker-name-row]:text-right max-md:[&_.item-picker-name-row]:text-left',
				'[&_.item-picker-reforge]:text-right max-md:[&_.item-picker-reforge]:text-left',
				'[&_.item-picker-enchant]:text-right max-md:[&_.item-picker-enchant]:text-left',
				'[&_.item-picker-tinker]:text-right max-md:[&_.item-picker-tinker]:text-left',
			)}
			externalGap>
			{RIGHT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</TabPanelColumns.Col>
	</div>
);

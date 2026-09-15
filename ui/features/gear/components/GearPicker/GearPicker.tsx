import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import clsx from 'clsx';

import { LEFT_ITEM_SLOTS, RIGHT_ITEM_SLOTS } from '../../model/gear_data';
import { ItemPickerCell } from './ItemPickerCell';

export interface GearPickerProps {
	ready: boolean;
}

export const GearPicker = ({ ready }: GearPickerProps) => (
	<div className="ui-gear-picker grid grid-cols-2 gap-section max-lg:gap-3 max-sm:grid-cols-1" data-testid="gear-picker-root">
		<TabPanelColumns.Col className="gap-3 *:flex-row *:text-left [&>*:nth-child(6)]:mb-section" externalGap>
			{LEFT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</TabPanelColumns.Col>
		<TabPanelColumns.Col
			className={clsx(
				'gap-3 *:flex-row-reverse max-md:*:flex-row',
				'[&_.ui-item-picker-labels-container]:items-end max-md:[&_.ui-item-picker-labels-container]:items-start',
				'[&_.ui-item-picker-labels-container]:text-right',
				'[&_.ui-item-picker-name-row]:text-right max-md:[&_.ui-item-picker-name-row]:text-left',
				'[&_.ui-item-picker-label-muted]:text-right max-md:[&_.ui-item-picker-label-muted]:text-left',
			)}
			externalGap>
			{RIGHT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</TabPanelColumns.Col>
	</div>
);

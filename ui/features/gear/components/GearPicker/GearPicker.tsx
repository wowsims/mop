import './GearPicker.scss';

import { TabPanelColumns } from '@ui-kit/TabPanelColumns';

import { LEFT_ITEM_SLOTS, RIGHT_ITEM_SLOTS } from '../../model/gear_data';
import { ItemPickerCell } from './ItemPickerCell';

export interface GearPickerProps {
	ready: boolean;
}

export const GearPicker = ({ ready }: GearPickerProps) => (
	<div className="gear-picker-root">
		<TabPanelColumns.Col className="gear-picker-left" externalGap>
			{LEFT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</TabPanelColumns.Col>
		<TabPanelColumns.Col className="gear-picker-right" externalGap>
			{RIGHT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</TabPanelColumns.Col>
	</div>
);

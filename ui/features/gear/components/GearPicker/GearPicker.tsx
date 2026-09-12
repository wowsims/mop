import './GearPicker.scss';

import { LEFT_ITEM_SLOTS, RIGHT_ITEM_SLOTS } from '../../model/gear_data';
import { ItemPickerCell } from './ItemPickerCell';

export interface GearPickerProps {
	ready: boolean;
}

export const GearPicker = ({ ready }: GearPickerProps) => (
	<div className="gear-picker-root">
		<div className="gear-picker-left tab-panel-col">
			{LEFT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</div>
		<div className="gear-picker-right tab-panel-col">
			{RIGHT_ITEM_SLOTS.map(slot => (
				<ItemPickerCell key={slot} slot={slot} ready={ready} />
			))}
		</div>
	</div>
);

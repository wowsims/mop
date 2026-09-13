import './BulkPickerGroups.scss';

import { useBulkState } from '../../hooks/useBulkState';
import { BulkItemPickerGroup } from './BulkItemPickerGroup';

export const BulkPickerGroups = () => {
	const pickerGroups = useBulkState(slice => slice.pickerGroups);

	return (
		<div className="bulk-gear-combo">
			{Array.from(pickerGroups).map(([bulkSlot, entries]) => (
				<BulkItemPickerGroup key={bulkSlot} bulkSlot={bulkSlot} entries={entries} />
			))}
		</div>
	);
};

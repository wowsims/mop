import { useBulkState } from '../../hooks/useBulkState';
import { BulkItemPickerGroup } from './BulkItemPickerGroup';

export const BulkPickerGroups = () => {
	const pickerGroups = useBulkState(slice => slice.pickerGroups);

	return (
		<div className="bulk-gear-combo grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-y-12 [grid-template-rows:auto]">
			{Array.from(pickerGroups).map(([bulkSlot, entries]) => (
				<BulkItemPickerGroup key={bulkSlot} bulkSlot={bulkSlot} entries={entries} />
			))}
		</div>
	);
};

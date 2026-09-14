import { useBulkState } from '../../hooks/useBulkState';
import { BulkItemPickerGroup } from './BulkItemPickerGroup';

export const BulkPickerGroups = () => {
	const pickerGroups = useBulkState(slice => slice.pickerGroups);

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-y-12 grid-rows-auto" data-testid="bulk-gear-combo">
			{Array.from(pickerGroups).map(([bulkSlot, entries]) => (
				<BulkItemPickerGroup key={bulkSlot} bulkSlot={bulkSlot} entries={entries} />
			))}
		</div>
	);
};

import { useBulkState } from '../../hooks/useBulkState';
import { BulkItemPickerGroup } from './BulkItemPickerGroup';

export const BulkPickerGroups = () => {
	const pickerGroups = useBulkState(slice => slice.pickerGroups);

	return (
		<div className="grid grid-cols-1 grid-rows-auto gap-6 sm:grid-cols-2 sm:gap-y-12 xl:grid-cols-3" data-testid="bulk-gear-combo">
			{Array.from(pickerGroups).map(([bulkSlot, entries]) => (
				<BulkItemPickerGroup key={bulkSlot} bulkSlot={bulkSlot} entries={entries} />
			))}
		</div>
	);
};

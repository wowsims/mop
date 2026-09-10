import './BulkPickerGroups.scss';

import { useBulkTab } from '../../hooks/useBulkTab';
import { useBulkVersion } from '../../hooks/useBulkVersion';
import { BulkItemPickerGroup } from './BulkItemPickerGroup';

export const BulkPickerGroups = () => {
	const bt = useBulkTab();
	useBulkVersion('items');

	return (
		<div className="bulk-gear-combo">
			{Array.from(bt.pickerGroups).map(([bulkSlot, entries]) => (
				<BulkItemPickerGroup key={bulkSlot} bulkSlot={bulkSlot} entries={entries} />
			))}
		</div>
	);
};

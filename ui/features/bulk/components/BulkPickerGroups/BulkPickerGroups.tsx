import './BulkPickerGroups.scss';

import { useBulkTab } from '../../hooks/useBulkTab';
import { useBulkVersion } from '../../hooks/useBulkVersion';
import { BulkItemPickerGroup } from './BulkItemPickerGroup';

export const BulkPickerGroups = () => {
	const bt = useBulkTab();
	// The groups are plain arrays the tab mutates, so the slice's items counter is what says they moved.
	useBulkVersion('items');

	return (
		<div className="bulk-gear-combo">
			{Array.from(bt.pickerGroups.values()).map(group => (
				<BulkItemPickerGroup key={group.bulkSlot} group={group} />
			))}
		</div>
	);
};

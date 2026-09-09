import i18n from '@i18n/config';
import { getBulkSlotI18nKey } from '@i18n/entity_mapping';
import { translateBulkSlotName } from '@i18n/localization';
import { ContentBlock } from '@ui-kit/ContentBlock';

import type { BulkPickerGroup } from '../../model/picker_groups';
import { BulkItemPicker } from './BulkItemPicker';

export interface BulkItemPickerGroupProps {
	group: BulkPickerGroup;
}

export const BulkItemPickerGroup = ({ group }: BulkItemPickerGroupProps) => {
	const slotKey = getBulkSlotI18nKey(group.bulkSlot);
	const entries = group.entries;

	return (
		<ContentBlock
			className={['bulk-item-picker-group-root', `gear-group-${slotKey.replace(/_/g, '-')}`]}
			config={{ header: { title: translateBulkSlotName(group.bulkSlot) } }}>
			{entries.length ? (
				entries.map(entry => <BulkItemPicker key={entry.index} group={group} index={entry.index} item={entry.item} />)
			) : (
				<span>{i18n.t('bulk_tab.picker.no_items')}</span>
			)}
		</ContentBlock>
	);
};

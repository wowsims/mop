import i18n from '@i18n/config';
import { getBulkSlotI18nKey } from '@i18n/entity_mapping';
import { translateBulkSlotName } from '@i18n/localization';
import type { BulkPickerEntry } from '@sim/bulk/types';
import type { BulkSimItemSlot } from '@sim/bulk/utils';
import { ContentBlock } from '@ui-kit/ContentBlock';

import { BulkItemPicker } from './BulkItemPicker';

export interface BulkItemPickerGroupProps {
	bulkSlot: BulkSimItemSlot;
	entries: readonly BulkPickerEntry[];
}

export const BulkItemPickerGroup = ({ bulkSlot, entries }: BulkItemPickerGroupProps) => {
	const slotKey = getBulkSlotI18nKey(bulkSlot);

	return (
		<ContentBlock
			className={['bulk-item-picker-group-root', `gear-group-${slotKey.replace(/_/g, '-')}`]}
			config={{ header: { title: translateBulkSlotName(bulkSlot) } }}>
			{entries.length ? (
				entries.map(entry => <BulkItemPicker key={entry.index} bulkSlot={bulkSlot} index={entry.index} item={entry.item} />)
			) : (
				<span>{i18n.t('bulk_tab.picker.no_items')}</span>
			)}
		</ContentBlock>
	);
};

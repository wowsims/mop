import { subscribeBulkField } from '@sim/state/subscriptions';
import { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateWeaponType } from '@i18n/localization';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import clsx from 'clsx';

import { trackEvent } from '../../../../tracking/analytics';
import type { BulkTab } from '../../bulk_tab';
import { useBulkTab } from '../../hooks/useBulkTab';
import { useBulkVersion } from '../../hooks/useBulkVersion';

export interface FreezeWeaponTypesProps {
	slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand;
}

export const FreezeWeaponTypes = ({ slot }: FreezeWeaponTypesProps) => {
	const bt = useBulkTab();
	useBulkVersion('settings');
	const weaponTypes = bt.getFreezeWeaponTypes(slot);

	return (
		<div>
			{!!weaponTypes.length && (
				<div className={clsx('bulk-gear-freeze-weapontypes', bt.frozenWeaponSlot === slot && 'hide')}>
					<h6 className="mb-2">
						{slot === ItemSlot.ItemSlotMainHand
							? i18n.t('bulk_tab.settings.freeze_weapon_types.mainhand_label')
							: i18n.t('bulk_tab.settings.freeze_weapon_types.offhand_label')}
					</h6>
					<div className="fs-content mb-2">{i18n.t('bulk_tab.settings.freeze_weapon_types.tooltip')}</div>
					<div className="bulk-gear-freeze-weapontypes__list gap-1">
						{weaponTypes.map(weaponType => (
							<BooleanPicker<BulkTab>
								key={weaponType}
								modObject={bt}
								config={{
									id: `bulk-${slot}-weapon-type-${weaponType}`,
									label: translateWeaponType(weaponType),
									inline: true,
									storeSubscribe: () => subscribeBulkField(bt, 'settings'),
									getValue: () => bt.weaponTypeFilters.get(slot)!.includes(weaponType),
									setValue: (_modObj, newValue: boolean) => {
										const filter = bt.weaponTypeFilters.get(slot)!;
										bt.setWeaponTypeFilter(slot, newValue ? [...filter, weaponType] : filter.filter(type => type !== weaponType));
										trackEvent({ action: 'settings', category: 'batch_sim', label: `freeze_${slot}_weapon_type`, value: newValue });
									},
								}}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

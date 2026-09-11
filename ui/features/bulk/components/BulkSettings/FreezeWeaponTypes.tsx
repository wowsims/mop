import { getBulkFreezeWeaponTypes } from '@sim/bulk/utils';
import { usePlayer } from '@sim/context/SimHostContext';
import { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateWeaponType } from '@i18n/localization';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import clsx from 'clsx';

import { trackEvent } from '../../../../tracking/analytics';
import { useBulkState } from '../../hooks/useBulkState';
import { setBulkWeaponTypeFilter } from '../../model/settings';

export interface FreezeWeaponTypesProps {
	slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand;
}

export const FreezeWeaponTypes = ({ slot }: FreezeWeaponTypesProps) => {
	const player = usePlayer();
	const frozenWeaponSlot = useBulkState(slice => slice.frozenWeaponSlot);
	const weaponTypeFilters = useBulkState(slice => slice.weaponTypeFilters);
	const weaponTypes = getBulkFreezeWeaponTypes(player, slot);

	return (
		<div>
			{!!weaponTypes.length && (
				<div className={clsx('bulk-gear-freeze-weapontypes', frozenWeaponSlot === slot && 'hide')}>
					<h6 className="mb-2">
						{slot === ItemSlot.ItemSlotMainHand
							? i18n.t('bulk_tab.settings.freeze_weapon_types.mainhand_label')
							: i18n.t('bulk_tab.settings.freeze_weapon_types.offhand_label')}
					</h6>
					<div className="fs-content mb-2">{i18n.t('bulk_tab.settings.freeze_weapon_types.tooltip')}</div>
					<div className="bulk-gear-freeze-weapontypes__list gap-1">
						{weaponTypes.map(weaponType => (
							<BooleanPicker
								key={weaponType}
								modObject={player}
								config={{
									id: `bulk-${slot}-weapon-type-${weaponType}`,
									label: translateWeaponType(weaponType),
									inline: true,
									storeField: 'bulk:settings',
									getValue: () => weaponTypeFilters.get(slot)!.includes(weaponType),
									setValue: (_modObj, newValue: boolean) => {
										const filter = weaponTypeFilters.get(slot)!;
										setBulkWeaponTypeFilter(player, slot, newValue ? [...filter, weaponType] : filter.filter(type => type !== weaponType));
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

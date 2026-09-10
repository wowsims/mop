import { BulkSimItemSlot } from '@sim/bulk/utils';
import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribeBulkChange, subscribeBulkField, subscribePlayerField } from '@sim/state/subscriptions';
import { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { useEffect, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import type { BulkTab } from '../../bulk_tab';
import { useBulkState } from '../../hooks/useBulkState';
import { useBulkTab } from '../../hooks/useBulkTab';
import { frozenItemSlot } from '../../model/picker_groups';
import { canRunBatch } from '../../model/selectors';
import { CombinationsCount } from './CombinationsCount';
import { FreezeWeaponTypes } from './FreezeWeaponTypes';
import { RequiredSetBonuses } from './RequiredSetBonuses';

interface FrozenPair {
	bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket;
	slots: [ItemSlot, ItemSlot];
	id: string;
	labelKey: string;
	slotKeys: [string, string];
	event: string;
}

const FROZEN_PAIRS: readonly FrozenPair[] = [
	{
		bulkSlot: BulkSimItemSlot.ItemSlotFinger,
		slots: [ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotFinger2],
		id: 'freeze-ring',
		labelKey: 'bulk_tab.settings.freeze_ring',
		slotKeys: ['slots.finger_1', 'slots.finger_2'],
		event: 'freeze_ring_slot',
	},
	{
		bulkSlot: BulkSimItemSlot.ItemSlotTrinket,
		slots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
		id: 'freeze-trinket',
		labelKey: 'bulk_tab.settings.freeze_trinket',
		slotKeys: ['slots.trinket_1', 'slots.trinket_2'],
		event: 'freeze_trinket_slot',
	},
];

export const BulkSettings = () => {
	const bt = useBulkTab();
	const player = usePlayer();
	const frozenItems = useBulkState(slice => slice.frozenItems);
	const canRun = useBulkState(slice => canRunBatch(slice, bt.getCombinationsLimit()));
	const gear = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'gear'), [player]),
		() => player.getGear(),
	);

	const frozenSlotValue = ({ bulkSlot, slots }: FrozenPair): number => frozenItemSlot(player.getGear(), slots, bt.frozenItems.get(bulkSlot)) ?? -1;

	// The vanilla picker cleared a frozen item its slot no longer holds from inside `getValue`.
	// A store write during render is not safe in React, so the same reset runs after it instead.
	useEffect(() => {
		for (const pair of FROZEN_PAIRS) {
			const frozenItem = frozenItems.get(pair.bulkSlot);
			if (frozenItem && frozenItemSlot(gear, pair.slots, frozenItem) === null) bt.setFrozenItem(pair.bulkSlot, null);
		}
	}, [bt, gear, frozenItems]);

	const freezeItemConfig = (pair: FrozenPair) => ({
		id: pair.id,
		label: i18n.t(`${pair.labelKey}.label`),
		labelTooltip: i18n.t(`${pair.labelKey}.tooltip`),
		values: [
			{ name: i18n.t('common.none'), value: -1 },
			{ name: i18n.t(pair.slotKeys[0], { ns: 'character' }), value: pair.slots[0] },
			{ name: i18n.t(pair.slotKeys[1], { ns: 'character' }), value: pair.slots[1] },
		],
		storeSubscribe: () => subscribeBulkChange(bt),
		getValue: () => frozenSlotValue(pair),
		setValue: (_modObj: BulkTab, newValue: number) => {
			bt.setFrozenItem(pair.bulkSlot, newValue === -1 ? null : player.getGear().getEquippedItem(newValue));
			trackEvent({ action: 'settings', category: 'batch_sim', label: pair.event, value: newValue });
		},
	});

	return (
		<div className="bulk-tab-right tab-panel-right">
			<div className="bulk-settings-outer-container">
				<div className="bulk-settings-container">
					<CombinationsCount />
					<button type="button" className="btn btn-primary bulk-settings-btn" disabled={!canRun} onClick={() => void bt.runBatchSim()}>
						{i18n.t('bulk_tab.actions.simulate_batch')}
					</button>
					<div className="use-legacy-bulk-sim-container">
						<BooleanPicker<BulkTab>
							modObject={bt}
							config={{
								id: 'use-legacy-bulk-sim',
								label: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.label'),
								labelTooltip: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.tooltip'),
								inline: true,
								storeSubscribe: () => subscribeBulkField(bt, 'settings'),
								getValue: () => bt.useLegacyBulkSim,
								setValue: (_modObj, newValue: boolean) => {
									bt.setUseLegacyBulkSim(newValue);
									trackEvent({ action: 'settings', category: 'batch_sim', label: 'use_legacy_bulk_sim', value: newValue });
								},
							}}
						/>
					</div>
					<div className="inherit-upgrades-container">
						<BooleanPicker<BulkTab>
							modObject={bt}
							config={{
								id: 'inherit-upgrades',
								label: i18n.t('bulk_tab.settings.inherit_upgrades.label'),
								labelTooltip: i18n.t('bulk_tab.settings.inherit_upgrades.tooltip'),
								inline: true,
								storeSubscribe: () => subscribeBulkField(bt, 'settings'),
								getValue: () => bt.inheritUpgrades,
								setValue: (_modObj, newValue: boolean) => {
									bt.setInheritUpgrades(newValue);
									trackEvent({ action: 'settings', category: 'batch_sim', label: 'inherit_upgrades', value: newValue });
								},
							}}
						/>
					</div>
					<RequiredSetBonuses />
					{FROZEN_PAIRS.map(pair => (
						<div key={pair.id}>
							<EnumPicker<BulkTab> modObject={bt} config={freezeItemConfig(pair)} />
						</div>
					))}
					{bt.playerCanDualWield && (
						<>
							<div>
								<EnumPicker<BulkTab>
									modObject={bt}
									config={{
										id: 'freeze-weapon',
										label: i18n.t('bulk_tab.settings.freeze_weapon.label'),
										labelTooltip: i18n.t('bulk_tab.settings.freeze_weapon.tooltip'),
										values: [
											{ name: i18n.t('common.none'), value: -1 },
											{ name: i18n.t('slots.main_hand', { ns: 'character' }), value: ItemSlot.ItemSlotMainHand },
											{ name: i18n.t('slots.off_hand', { ns: 'character' }), value: ItemSlot.ItemSlotOffHand },
										],
										storeSubscribe: () => subscribeBulkChange(bt),
										getValue: () => bt.frozenWeaponSlot ?? -1,
										setValue: (_modObj, newValue: number) => {
											bt.setFrozenWeaponSlot(newValue === -1 ? null : newValue);
											trackEvent({ action: 'settings', category: 'batch_sim', label: 'freeze_weapon_slot', value: newValue });
										},
									}}
								/>
							</div>
							<FreezeWeaponTypes slot={ItemSlot.ItemSlotMainHand} />
							<FreezeWeaponTypes slot={ItemSlot.ItemSlotOffHand} />
						</>
					)}
				</div>
			</div>
		</div>
	);
};

import { BulkSimItemSlot, getBulkPlayerCanDualWield } from '@sim/bulk/utils';
import { usePlayer, useSimHost } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { useEffect } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useBulkState } from '../../hooks/useBulkState';
import { bulkCombinationsLimit } from '../../model/limits';
import { frozenItemSlot } from '../../model/picker_groups';
import { runBulkBatch } from '../../model/run';
import { canRunBatch } from '../../model/selectors';
import { setBulkFrozenItem, setBulkFrozenWeaponSlot, setBulkInheritUpgrades, setBulkUseLegacyBulkSim } from '../../model/settings';
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
	const host = useSimHost();
	const player = usePlayer();
	const frozenItems = useBulkState(slice => slice.frozenItems);
	const frozenWeaponSlot = useBulkState(slice => slice.frozenWeaponSlot);
	const inheritUpgrades = useBulkState(slice => slice.inheritUpgrades);
	const useLegacyBulkSim = useBulkState(slice => slice.useLegacyBulkSim);
	const canRun = useBulkState(slice => canRunBatch(slice, bulkCombinationsLimit(player.sim.isNative)));
	const gear = useStoreSubscribe(subscribePlayerField(player, 'gear'), () => player.getGear());

	// Clearing a frozen item whose slot no longer holds it writes to the store; that is not safe
	// during render, so it runs in an effect after render instead.
	useEffect(() => {
		for (const pair of FROZEN_PAIRS) {
			const frozenItem = frozenItems.get(pair.bulkSlot);
			if (frozenItem && frozenItemSlot(gear, pair.slots, frozenItem) === null) setBulkFrozenItem(player, pair.bulkSlot, null);
		}
	}, [player, gear, frozenItems]);

	const freezeItemConfig = (pair: FrozenPair) => ({
		id: pair.id,
		label: i18n.t(`${pair.labelKey}.label`),
		labelTooltip: i18n.t(`${pair.labelKey}.tooltip`),
		values: [
			{ name: i18n.t('common.none'), value: -1 },
			{ name: i18n.t(pair.slotKeys[0], { ns: 'character' }), value: pair.slots[0] },
			{ name: i18n.t(pair.slotKeys[1], { ns: 'character' }), value: pair.slots[1] },
		],
		storeField: ['bulk:settings', 'bulk:items'] as const,
		getValue: () => frozenItemSlot(player.getGear(), pair.slots, frozenItems.get(pair.bulkSlot)) ?? -1,
		setValue: (_modObj: typeof player, newValue: number) => {
			setBulkFrozenItem(player, pair.bulkSlot, newValue === -1 ? null : player.getGear().getEquippedItem(newValue));
			trackEvent({ action: 'settings', category: 'batch_sim', label: pair.event, value: newValue });
		},
	});

	return (
		<div className="bulk-tab-right tab-panel-right">
			<div className="bulk-settings-outer-container">
				<div className="bulk-settings-container">
					<CombinationsCount />
					<button type="button" className="btn btn-primary bulk-settings-btn" disabled={!canRun} onClick={() => void runBulkBatch(host)}>
						{i18n.t('bulk_tab.actions.simulate_batch')}
					</button>
					<div className="use-legacy-bulk-sim-container">
						<BooleanPicker
							modObject={player}
							config={{
								id: 'use-legacy-bulk-sim',
								label: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.label'),
								labelTooltip: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.tooltip'),
								inline: true,
								storeField: 'bulk:settings',
								getValue: () => useLegacyBulkSim,
								setValue: (_modObj, newValue: boolean) => {
									setBulkUseLegacyBulkSim(player, newValue);
									trackEvent({ action: 'settings', category: 'batch_sim', label: 'use_legacy_bulk_sim', value: newValue });
								},
							}}
						/>
					</div>
					<div className="inherit-upgrades-container">
						<BooleanPicker
							modObject={player}
							config={{
								id: 'inherit-upgrades',
								label: i18n.t('bulk_tab.settings.inherit_upgrades.label'),
								labelTooltip: i18n.t('bulk_tab.settings.inherit_upgrades.tooltip'),
								inline: true,
								storeField: 'bulk:settings',
								getValue: () => inheritUpgrades,
								setValue: (_modObj, newValue: boolean) => {
									setBulkInheritUpgrades(player, newValue);
									trackEvent({ action: 'settings', category: 'batch_sim', label: 'inherit_upgrades', value: newValue });
								},
							}}
						/>
					</div>
					<RequiredSetBonuses />
					{FROZEN_PAIRS.map(pair => (
						<div key={pair.id}>
							<EnumPicker modObject={player} config={freezeItemConfig(pair)} />
						</div>
					))}
					{getBulkPlayerCanDualWield(player) && (
						<>
							<div>
								<EnumPicker
									modObject={player}
									config={{
										id: 'freeze-weapon',
										label: i18n.t('bulk_tab.settings.freeze_weapon.label'),
										labelTooltip: i18n.t('bulk_tab.settings.freeze_weapon.tooltip'),
										values: [
											{ name: i18n.t('common.none'), value: -1 },
											{ name: i18n.t('slots.main_hand', { ns: 'character' }), value: ItemSlot.ItemSlotMainHand },
											{ name: i18n.t('slots.off_hand', { ns: 'character' }), value: ItemSlot.ItemSlotOffHand },
										],
										storeField: ['bulk:settings', 'bulk:items'],
										getValue: () => frozenWeaponSlot ?? -1,
										setValue: (_modObj, newValue: number) => {
											setBulkFrozenWeaponSlot(player, newValue === -1 ? null : newValue);
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

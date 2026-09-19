import { ReforgeSettingsPanel } from '@features/reforge/components/ReforgePanel';
import { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { BulkSimItemSlot, getBulkPlayerCanDualWield } from '@sim/bulk/utils';
import { usePlayer, useSimHost } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { Accordion, AccordionItem } from '@ui-kit/Accordion';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import { useEffect } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { BULK_SETTINGS_GROUP, useBulkSettingsGroups } from '../../hooks/useBulkSettingsGroups';
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
	const gear = usePlayerStore('gear');
	const [openGroups, setOpenGroups] = useBulkSettingsGroups();

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
		value: frozenItemSlot(gear, pair.slots, frozenItems.get(pair.bulkSlot)) ?? -1,
		onChange: (newValue: number) => {
			setBulkFrozenItem(player, pair.bulkSlot, newValue === -1 ? null : player.getGear().getEquippedItem(newValue));
			trackEvent({ action: 'settings', category: 'batch_sim', label: pair.event, value: newValue });
		},
	});

	return (
		<TabPanelColumns.Right>
			<div className="sticky top-sim-header pt-6 lg:max-h-bulk-settings-max-h lg:overflow-y-auto">
				<div className="grid gap-6 border border-border bg-background p-4" data-testid="bulk-settings-container">
					<CombinationsCount />
					<Button data-testid="bulk-settings-btn" disabled={!canRun} onClick={() => void runBulkBatch(host)}>
						{i18n.t('bulk_tab.actions.simulate_batch')}
					</Button>
					<Accordion value={openGroups} onValueChange={setOpenGroups}>
						<AccordionItem
							value={BULK_SETTINGS_GROUP.options}
							title={i18n.t('bulk_tab.settings.groups.options')}
							panelClassName="grid gap-6"
							testId="bulk-settings-group-options">
							<div>
								<BooleanPicker
									modObject={player}
									config={{
										id: 'use-legacy-bulk-sim',
										label: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.label'),
										labelTooltip: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.tooltip'),
										layout: 'inline',
										value: useLegacyBulkSim,
										onChange: (newValue: boolean) => {
											setBulkUseLegacyBulkSim(player, newValue);
											trackEvent({ action: 'settings', category: 'batch_sim', label: 'use_legacy_bulk_sim', value: newValue });
										},
									}}
								/>
							</div>
							<div>
								<BooleanPicker
									modObject={player}
									config={{
										id: 'inherit-upgrades',
										label: i18n.t('bulk_tab.settings.inherit_upgrades.label'),
										labelTooltip: i18n.t('bulk_tab.settings.inherit_upgrades.tooltip'),
										layout: 'inline',
										value: inheritUpgrades,
										onChange: (newValue: boolean) => {
											setBulkInheritUpgrades(player, newValue);
											trackEvent({ action: 'settings', category: 'batch_sim', label: 'inherit_upgrades', value: newValue });
										},
									}}
								/>
							</div>
							<RequiredSetBonuses />
						</AccordionItem>
						{host.reforger && (
							<AccordionItem
								value={BULK_SETTINGS_GROUP.reforge}
								title={i18n.t('bulk_tab.settings.groups.reforge')}
								testId="bulk-settings-group-reforge">
								<p className="mb-4 text-sm">{i18n.t('bulk_tab.settings.groups.reforge_description')}</p>
								<ReforgeSettingsPanel
									model={host.reforger}
									options={host.reforgeOptions ?? undefined}
									idPrefix="bulk-reforge-optimizer"
									gemsLocked
								/>
							</AccordionItem>
						)}
						<AccordionItem
							value={BULK_SETTINGS_GROUP.freezes}
							title={i18n.t('bulk_tab.settings.groups.frozen_slots')}
							panelClassName="grid gap-6"
							testId="bulk-settings-group-freezes">
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
												value: frozenWeaponSlot ?? -1,
												onChange: (newValue: number) => {
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
						</AccordionItem>
					</Accordion>
				</div>
			</div>
		</TabPanelColumns.Right>
	);
};

import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Stats } from '@sim/proto/stats';
import { batch } from '@sim/state/batch';
import { subscribePlayerChange } from '@sim/state/subscriptions';
import { EquipmentSpec, UnitStats } from '@generated/proto/common';
import { SavedGearSet } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useCallback, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSavedGear } from '../../hooks/useSavedGear';
import { gearSetData, serializeGearSet } from './utils';

export const SavedGear = () => {
	const host = useSimHost();
	const { player, sim, individualConfig } = host;
	const ready = useSimReady();

	const label = i18n.t('gear_tab.gear_sets.gear_set');
	const { entries: userData, save, remove } = useSavedGear();

	const presets = useMemo<Array<SavedDataPanelEntry<SavedGearSet>>>(
		() =>
			ready
				? individualConfig.presets.gear.map(presetGear => {
						const data = SavedGearSet.create({
							gear: sim.db.lookupEquipmentSpec(presetGear.gear).asSpec(),
							bonusStatsStats: new Stats().toProto(),
						});
						return {
							name: presetGear.name,
							data,
							json: serializeGearSet(data),
							tooltip: presetGear.tooltip,
							isPreset: true,
							disabled: !!presetGear.enableWhen && !presetGear.enableWhen(player),
							afterLoad: () => presetGear.onLoad?.(player),
						};
					})
				: [],
		[ready, individualConfig, player, sim],
	);

	const gear = useStoreSubscribe(
		useMemo(() => subscribePlayerChange(player), [player]),
		() => gearSetData(player),
	);
	const currentJson = useMemo(() => serializeGearSet(gear), [gear]);

	const onLoad = useCallback(
		(entry: SavedDataPanelEntry<SavedGearSet>) => {
			batch(() => {
				player.setGear(sim.db.lookupEquipmentSpec(entry.data.gear || EquipmentSpec.create()));
				player.setBonusStats(Stats.fromProto(entry.data.bonusStatsStats || UnitStats.create()));
			});
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[player, sim, label],
	);

	const onSave = useCallback(
		(name: string) => {
			save(name, gearSetData(player));
			trackEvent({ action: 'settings', category: 'save', label });
		},
		[player, label, save],
	);

	const onDelete = useCallback(
		(entry: SavedDataPanelEntry<SavedGearSet>) => {
			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	return (
		<SavedDataPanel
			title={i18n.t('gear_tab.gear_sets.title')}
			label={label}
			nameLabel={i18n.t('gear_tab.gear_sets.gear_set_name')}
			saveButtonText={i18n.t('gear_tab.gear_sets.save_gear_set')}
			presets={presets}
			userData={userData}
			currentJson={currentJson}
			onLoad={onLoad}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
};

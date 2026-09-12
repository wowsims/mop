import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Stats } from '@sim/proto/stats';
import { batch } from '@sim/state/batch';
import { subscribePlayerChange } from '@sim/state/subscriptions';
import { useSavedPanel } from '@features/hooks/useSavedPanel';
import { EquipmentSpec, UnitStats } from '@generated/proto/common';
import { SavedGearSet } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useMemo } from 'react';

import { useSavedGear } from '../../hooks/useSavedGear';
import { gearSetData, serializeGearSet } from './utils';

export const SavedGear = () => {
	const host = useSimHost();
	const { player, sim } = host;
	const individualConfig = useSpecPresets();
	const ready = useSimReady();

	const label = i18n.t('gear_tab.gear_sets.gear_set');

	const presets = useMemo<Array<SavedDataPanelEntry<SavedGearSet>>>(
		() =>
			ready
				? individualConfig.gear.map(presetGear => {
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

	const current = useStoreSubscribe(subscribePlayerChange(player), () => gearSetData(player));

	const panel = useSavedPanel({
		label,
		storage: useSavedGear(),
		current,
		serialize: serializeGearSet,
		load: entry =>
			batch(() => {
				player.setGear(sim.db.lookupEquipmentSpec(entry.data.gear || EquipmentSpec.create()));
				player.setBonusStats(Stats.fromProto(entry.data.bonusStatsStats || UnitStats.create()));
			}),
	});

	return (
		<SavedDataPanel
			container={host.rootElem}
			title={i18n.t('gear_tab.gear_sets.title')}
			nameLabel={i18n.t('gear_tab.gear_sets.gear_set_name')}
			saveButtonText={i18n.t('gear_tab.gear_sets.save_gear_set')}
			presets={presets}
			{...panel}
		/>
	);
};

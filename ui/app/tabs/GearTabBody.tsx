import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import type { Player } from '@sim/player';
import { Stats } from '@sim/proto_utils/stats';
import { batch } from '@sim/state/batch';
import { subscribePlayerChange } from '@sim/state/subscriptions';
import { GearPicker } from '@features/gear/components/GearPicker';
import { GemSummary, ReforgeSummary, UpgradeCostsSummary } from '@features/gear/components/SummaryTable';
import { EquipmentSpec, UnitStats } from '@generated/proto/common';
import { SavedGearSet } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { SavedDataManager } from '@ui-kit/saved_data_manager';

import { PresetConfigurationPicker } from '../preset_configuration_picker';

export const GearTabBody = () => {
	const host = useSimHost();
	const player = host.player;
	const ready = useSimReady(host.sim);

	const mountRight = useLegacyMount(
		parent => {
			const presets = new PresetConfigurationPicker(parent, host, [PresetConfigurationCategory.Gear]);
			const saved = new SavedDataManager<Player<any>, SavedGearSet>(parent, player, {
				header: { title: i18n.t('gear_tab.gear_sets.title') },
				label: i18n.t('gear_tab.gear_sets.gear_set'),
				nameLabel: i18n.t('gear_tab.gear_sets.gear_set_name'),
				saveButtonText: i18n.t('gear_tab.gear_sets.save_gear_set'),
				storageKey: host.getSavedGearStorageKey(),
				getData: (subject: Player<any>) =>
					SavedGearSet.create({ gear: subject.getGear().asSpec(), bonusStatsStats: subject.getBonusStats().toProto() }),
				setData: (subject: Player<any>, newSavedGear: SavedGearSet) => {
					batch(() => {
						subject.setGear(host.sim.db.lookupEquipmentSpec(newSavedGear.gear || EquipmentSpec.create()));
						subject.setBonusStats(Stats.fromProto(newSavedGear.bonusStatsStats || UnitStats.create()));
					});
				},
				subscribe: subscribePlayerChange(player),
				toJson: (a: SavedGearSet) => SavedGearSet.toJson(a),
				fromJson: (obj: any) => SavedGearSet.fromJson(obj),
			});

			host.sim
				.waitForInit()
				.then(() => {
					saved.loadUserData();
					host.individualConfig.presets.gear.forEach(presetGear => {
						saved.addSavedData({
							name: presetGear.name,
							tooltip: presetGear.tooltip,
							isPreset: true,
							data: SavedGearSet.create({
								// Convert to gear and back so order is always the same.
								gear: host.sim.db.lookupEquipmentSpec(presetGear.gear).asSpec(),
								bonusStatsStats: new Stats().toProto(),
							}),
							enableWhen: presetGear.enableWhen,
							onLoad: presetGear.onLoad,
						});
					});
				})
				.catch(console.error);

			return [presets, saved];
		},
		[host, player],
	);

	return (
		<>
			<div className="gear-tab-left tab-panel-left">
				<GearPicker ready={ready} />
				<div className="summary-tables-container">
					<GemSummary />
					<ReforgeSummary />
					<UpgradeCostsSummary />
				</div>
			</div>
			<div className="gear-tab-right tab-panel-right" ref={mountRight} />
		</>
	);
};

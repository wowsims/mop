import { PresetConfigurationCategory } from '@domain/constants/preset_categories';
import type { Encounter } from '@domain/encounter';
import { subscribeAll, subscribeEncounterChange, subscribePartyBuffs, subscribePlayerField, subscribeRaidField } from '@domain/state/subscriptions';
import { EncounterPicker } from '@features/encounter';
import { ConsumesPicker, CustomSection, OtherSettings, PlayerSettings, RaidBuffs, StatOptionIcons } from '@features/settings';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as ConsumablesInputs from '@features/settings/model/consumables';
import { applySavedSettings, readSavedSettings } from '@features/settings/model/saved_settings';
import { relevantStatOptions } from '@features/settings/model/stat_options';
import type { IndividualSimHost } from '@features/sim_host';
import { useSimHost } from '@features/SimHostContext';
import { SavedEncounter, SavedSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { SavedDataManager } from '@ui-kit/saved_data_manager';
import { useMemo } from 'react';

import { useSimReady } from '../hooks/useSimReady';
import { PresetConfigurationPicker } from '../preset_configuration_picker';

export const SettingsTabBody = () => {
	const host = useSimHost();
	const config = host.individualConfig;
	const ready = useSimReady(host.sim);

	const options = useMemo(
		() => ({
			buffs: relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_CONFIG, host),
			buffsMisc: relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_MISC_CONFIG, host),
			debuffs: relevantStatOptions(BuffDebuffInputs.DEBUFFS_CONFIG, host),
			externalDamageCooldowns: relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DAMAGE_COOLDOWN, host),
			externalDefensiveCooldowns: relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DEFENSIVE_COOLDOWN, host),
			conjured: relevantStatOptions(ConsumablesInputs.CONJURED_CONFIG, host),
			explosive: relevantStatOptions(ConsumablesInputs.EXPLOSIVE_CONFIG, host),
		}),
		[host],
	);

	const itemSwapSlots = config.itemSwapSlots || [];
	const hasOtherSettings = config.otherInputs.inputs.length > 0 || itemSwapSlots.length > 0;

	const mountRight = useLegacyMount(
		parent => {
			const presets = new PresetConfigurationPicker(parent, host, [PresetConfigurationCategory.Encounter, PresetConfigurationCategory.Settings]);

			const savedEncounterManager = new SavedDataManager<Encounter, SavedEncounter>(parent, host.sim.encounter, {
				label: i18n.t('settings_tab.saved_encounters.encounter'),
				header: { title: i18n.t('settings_tab.saved_encounters.title') },
				nameLabel: i18n.t('settings_tab.saved_encounters.encounter_name'),
				saveButtonText: i18n.t('settings_tab.saved_encounters.save_encounter'),
				storageKey: host.getSavedEncounterStorageKey(),
				getData: (encounter: Encounter) => SavedEncounter.create({ encounter: encounter.toProto() }),
				setData: (encounter: Encounter, newEncounter: SavedEncounter) => encounter.fromProto(newEncounter.encounter!),
				subscribe: subscribeEncounterChange(host.sim.encounter),
				toJson: (a: SavedEncounter) => SavedEncounter.toJson(a),
				fromJson: (obj: any) => SavedEncounter.fromJson(obj),
			});

			const savedSettingsManager = new SavedDataManager<IndividualSimHost<any>, SavedSettings>(parent, host, {
				label: i18n.t('settings_tab.saved_settings.settings'),
				header: { title: i18n.t('settings_tab.saved_settings.title') },
				nameLabel: i18n.t('settings_tab.saved_settings.settings_name'),
				saveButtonText: i18n.t('settings_tab.saved_settings.save_settings'),
				storageKey: host.getSavedSettingsStorageKey(),
				getData: () => readSavedSettings(host),
				setData: (subject: IndividualSimHost<any>, newSettings: SavedSettings) => applySavedSettings(subject, newSettings),
				subscribe: subscribeAll([
					subscribeRaidField(host.sim.raid, 'buffs'),
					subscribeRaidField(host.sim.raid, 'debuffs'),
					subscribePartyBuffs(host.player.getParty()!),
					subscribePlayerField(host.player, 'buffs'),
					subscribePlayerField(host.player, 'consumables'),
					subscribePlayerField(host.player, 'race'),
					subscribePlayerField(host.player, 'profession1'),
					subscribePlayerField(host.player, 'profession2'),
					subscribePlayerField(host.player, 'itemSwap'),
					subscribePlayerField(host.player, 'reactionTime'),
					subscribePlayerField(host.player, 'channelClipDelay'),
					subscribePlayerField(host.player, 'inFrontOfTarget'),
					subscribePlayerField(host.player, 'distanceFromTarget'),
					subscribePlayerField(host.player, 'healingModel'),
				]),
				toJson: (a: SavedSettings) => SavedSettings.toJson(a),
				fromJson: (obj: any) => SavedSettings.fromJson(obj),
			});

			host.sim.waitForInit().then(() => {
				savedEncounterManager.loadUserData();
				config.presets.encounters?.forEach(encounter => {
					savedEncounterManager.addSavedData({
						name: encounter.name,
						tooltip: encounter.tooltip,
						isPreset: true,
						data: SavedEncounter.create({ encounter: encounter.encounter }),
					});
				});

				savedSettingsManager.loadUserData();
				config.presets.settings?.forEach(settings => {
					savedSettingsManager.addSavedData({
						name: settings.name,
						tooltip: settings.tooltip,
						isPreset: true,
						data: SavedSettings.create({
							race: settings.race,
							raidBuffs: settings.raidBuffs,
							playerBuffs: settings.buffs,
							debuffs: settings.debuffs,
							consumables: settings.consumables,
							professions:
								settings.playerOptions?.profession1 && settings.playerOptions?.profession2
									? [settings.playerOptions.profession1, settings.playerOptions.profession2]
									: undefined,
							distanceFromTarget: settings.playerOptions?.distanceFromTarget,
							reactionTimeMs: settings.playerOptions?.reactionTimeMs,
							channelClipDelayMs: settings.playerOptions?.channelClipDelayMs,
							inFrontOfTarget: settings.playerOptions?.inFrontOfTarget,
							enableItemSwap: settings.playerOptions?.enableItemSwap,
						}),
					});
				});

				config.presets.itemSwaps?.forEach(presetItemSwap => {
					savedSettingsManager.addSavedData({
						name: presetItemSwap.name,
						tooltip: presetItemSwap.tooltip,
						isPreset: true,
						data: SavedSettings.create({ ...readSavedSettings(host), enableItemSwap: true, itemSwap: presetItemSwap.itemSwap }),
					});
				});
			});

			return [presets, savedEncounterManager, savedSettingsManager];
		},
		[host, config],
	);

	return (
		<>
			<div className="settings-tab-left tab-panel-left">
				<div className="tab-panel-col settings-left-col-1">
					{ready && (
						<>
							<ContentBlock cssClass="encounter-settings" config={{ header: { title: i18n.t('settings_tab.encounter.title') } }}>
								<EncounterPicker showExecuteProportion={config.encounterPicker.showExecuteProportion} />
							</ContentBlock>
							<ContentBlock cssClass="player-settings" config={{ header: { title: i18n.t('settings_tab.player.title') } }}>
								<PlayerSettings iconInputs={config.playerIconInputs} inputs={config.playerInputs?.inputs ?? []} />
							</ContentBlock>
						</>
					)}
				</div>
				<div className="tab-panel-col settings-left-col-2">
					{ready && (
						<>
							{config.sections?.map(section => (
								<CustomSection key={section.id} section={section} />
							))}
							<ContentBlock cssClass="consumes-settings" config={{ header: { title: i18n.t('settings_tab.consumables.title') } }}>
								<ConsumesPicker
									consumableStats={config.consumableStats ?? config.epStats}
									conjuredOptions={options.conjured}
									explosiveOptions={options.explosive}
									petInputs={config.petConsumeInputs ?? []}
								/>
							</ContentBlock>
							{hasOtherSettings && (
								<ContentBlock cssClass="other-settings" config={{ header: { title: i18n.t('settings_tab.other.title') } }}>
									<OtherSettings inputs={config.otherInputs.inputs} itemSlots={itemSwapSlots} />
								</ContentBlock>
							)}
						</>
					)}
				</div>
				<div className="tab-panel-col settings-left-col-3">
					{ready && (
						<>
							<ContentBlock
								cssClass="buffs-settings"
								config={{
									header: { title: i18n.t('settings_tab.raid_buffs.title'), tooltip: i18n.t('settings_tab.raid_buffs.tooltip') },
									bodyClasses: options.buffs.length === 0 ? ['hide'] : undefined,
								}}
								headerChildren={<p className="fs-body">{i18n.t('settings_tab.raid_buffs.description')}</p>}>
								<RaidBuffs options={options.buffs} miscOptions={options.buffsMisc} />
							</ContentBlock>
							{options.externalDamageCooldowns.length > 0 && (
								<ContentBlock
									cssClass="buffs-settings"
									config={{
										header: {
											title: i18n.t('settings_tab.external_damage_cooldowns.title'),
											tooltip: i18n.t('settings_tab.external_damage_cooldowns.tooltip'),
										},
									}}>
									<StatOptionIcons options={options.externalDamageCooldowns} />
								</ContentBlock>
							)}
							{options.externalDefensiveCooldowns.length > 0 && (
								<ContentBlock
									cssClass="buffs-settings"
									config={{
										header: {
											title: i18n.t('settings_tab.external_defensive_cooldowns.title'),
											tooltip: i18n.t('settings_tab.external_defensive_cooldowns.tooltip'),
										},
									}}>
									<StatOptionIcons options={options.externalDefensiveCooldowns} />
								</ContentBlock>
							)}
							<ContentBlock
								cssClass="debuffs-settings"
								config={{
									header: { title: i18n.t('settings_tab.debuffs.title'), tooltip: i18n.t('settings_tab.debuffs.tooltip') },
									bodyClasses: options.debuffs.length === 0 ? ['hide'] : undefined,
								}}>
								<StatOptionIcons options={options.debuffs} />
							</ContentBlock>
						</>
					)}
				</div>
			</div>
			<div className="settings-tab-right tab-panel-right" ref={mountRight} />
		</>
	);
};

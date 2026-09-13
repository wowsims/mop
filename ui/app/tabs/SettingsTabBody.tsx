import { EncounterPicker, SavedEncounter } from '@features/encounter';
import { SelectorModal } from '@features/gear/components/SelectorModal';
import { OpenSelectorModalContext, useSelectorModalState } from '@features/gear/hooks/useSelectorModal';
import { ConsumesPicker, CustomSection, OtherSettings, PlayerSettings, RaidBuffs, SavedSettings, StatOptionIcons } from '@features/settings';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as ConsumablesInputs from '@features/settings/model/consumables';
import { relevantStatOptions } from '@features/settings/model/stat_options';
import i18n from '@i18n/config';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { useMemo } from 'react';

import { PresetConfigurationPicker } from '../PresetConfigurationPicker';

const SETTINGS_PRESETS = [PresetConfigurationCategory.Encounter, PresetConfigurationCategory.Settings];

export const SettingsTabBody = () => {
	const host = useSimHost();
	const config = useSpecConfig();
	const ready = useSimReady();

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
	const selector = useSelectorModalState();

	return (
		<OpenSelectorModalContext value={selector.openTab}>
			<div className="settings-tab-left tab-panel-left">
				<div className="tab-panel-col settings-left-col-1">
					{ready && (
						<>
							<ContentBlock className="encounter-settings" config={{ header: { title: i18n.t('settings_tab.encounter.title') } }}>
								<EncounterPicker showExecuteProportion={config.encounterPicker.showExecuteProportion} />
							</ContentBlock>
							<ContentBlock className="player-settings" config={{ header: { title: i18n.t('settings_tab.player.title') } }}>
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
							<ContentBlock className="consumes-settings" config={{ header: { title: i18n.t('settings_tab.consumables.title') } }}>
								<ConsumesPicker
									consumableStats={config.consumableStats ?? config.epStats}
									conjuredOptions={options.conjured}
									explosiveOptions={options.explosive}
									petInputs={config.petConsumeInputs ?? []}
								/>
							</ContentBlock>
							{hasOtherSettings && (
								<ContentBlock className="other-settings" config={{ header: { title: i18n.t('settings_tab.other.title') } }}>
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
								className="buffs-settings"
								config={{
									header: { title: i18n.t('settings_tab.raid_buffs.title'), tooltip: i18n.t('settings_tab.raid_buffs.tooltip') },
									withoutBody: options.buffs.length === 0,
								}}
								headerChildren={<p className="fs-body">{i18n.t('settings_tab.raid_buffs.description')}</p>}>
								<RaidBuffs options={options.buffs} miscOptions={options.buffsMisc} />
							</ContentBlock>
							{options.externalDamageCooldowns.length > 0 && (
								<ContentBlock
									className="buffs-settings"
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
									className="buffs-settings"
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
								className="debuffs-settings"
								config={{
									header: { title: i18n.t('settings_tab.debuffs.title'), tooltip: i18n.t('settings_tab.debuffs.tooltip') },
									withoutBody: options.debuffs.length === 0,
								}}>
								<StatOptionIcons options={options.debuffs} />
							</ContentBlock>
						</>
					)}
				</div>
			</div>
			<div className="settings-tab-right tab-panel-right">
				<PresetConfigurationPicker categories={SETTINGS_PRESETS} />
				<SavedEncounter />
				<SavedSettings />
			</div>
			<SelectorModal state={selector} id="item-swap-selector-modal" rail={false} />
		</OpenSelectorModalContext>
	);
};

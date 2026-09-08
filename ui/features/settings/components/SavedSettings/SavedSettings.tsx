import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { subscribeAll, subscribePartyBuffs, subscribePlayerField, subscribeRaidField } from '@sim/state/subscriptions';
import { applySavedSettings, readSavedSettings } from '@features/settings/model/saved_settings';
import { SavedSettings as SavedSettingsProto } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useReadyStoreSubscribe } from '@ui-kit/hooks/useReadyStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useCallback, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSavedSettings } from '../../hooks/useSavedSettings';
import { serializeSettings } from './utils';

export const SavedSettings = () => {
	const host = useSimHost();
	const config = host.individualConfig;
	const ready = useSimReady();

	const label = i18n.t('settings_tab.saved_settings.settings');
	const { entries: userData, save, remove } = useSavedSettings();

	const presets = useMemo<Array<SavedDataPanelEntry<SavedSettingsProto>>>(() => {
		if (!ready) return [];
		const settingsPresets = (config.presets.settings ?? []).map(settings => {
			const data = SavedSettingsProto.create({
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
			});
			return { name: settings.name, data, json: serializeSettings(data), tooltip: settings.tooltip, isPreset: true };
		});
		const itemSwapPresets = (config.presets.itemSwaps ?? []).map(presetItemSwap => {
			const data = SavedSettingsProto.create({ ...readSavedSettings(host), enableItemSwap: true, itemSwap: presetItemSwap.itemSwap });
			return { name: presetItemSwap.name, data, json: serializeSettings(data), tooltip: presetItemSwap.tooltip, isPreset: true };
		});
		return [...settingsPresets, ...itemSwapPresets];
	}, [ready, host, config]);

	const settings = useReadyStoreSubscribe(
		useMemo(
			() =>
				subscribeAll([
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
			[host],
		),
		// Reaches `player.getConsumes()`, so it dereferences a null `sim.db` before the sim is ready.
		() => readSavedSettings(host),
		ready,
	);
	const currentJson = useMemo(() => (settings ? serializeSettings(settings) : ''), [settings]);

	const onLoad = useCallback(
		(entry: SavedDataPanelEntry<SavedSettingsProto>) => {
			applySavedSettings(host, entry.data);
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[host, label],
	);

	const onSave = useCallback(
		(name: string) => {
			save(name, readSavedSettings(host));
			trackEvent({ action: 'settings', category: 'save', label });
		},
		[host, label, save],
	);

	const onDelete = useCallback(
		(entry: SavedDataPanelEntry<SavedSettingsProto>) => {
			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	return (
		<SavedDataPanel
			title={i18n.t('settings_tab.saved_settings.title')}
			label={label}
			nameLabel={i18n.t('settings_tab.saved_settings.settings_name')}
			saveButtonText={i18n.t('settings_tab.saved_settings.save_settings')}
			presets={presets}
			userData={userData}
			currentJson={currentJson}
			onLoad={onLoad}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
};

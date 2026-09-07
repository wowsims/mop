import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { subscribeEncounterChange } from '@sim/state/subscriptions';
import { SavedEncounter as SavedEncounterProto } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useCallback, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSavedEncounter } from '../../hooks/useSavedEncounter';
import { encounterData, serializeEncounter } from './utils';

export const SavedEncounter = () => {
	const host = useSimHost();
	const { encounter } = host.sim;
	const config = host.individualConfig;
	const ready = useSimReady(host.sim);

	const label = i18n.t('settings_tab.saved_encounters.encounter');
	const { entries: userData, save, remove } = useSavedEncounter();

	const presets = useMemo<Array<SavedDataPanelEntry<SavedEncounterProto>>>(
		() =>
			ready
				? (config.presets.encounters ?? []).map(preset => {
						const data = SavedEncounterProto.create({ encounter: preset.encounter });
						return {
							name: preset.name,
							data,
							json: serializeEncounter(data),
							tooltip: preset.tooltip,
							isPreset: true,
						};
					})
				: [],
		[ready, config],
	);

	const encounterJson = useStoreSubscribe(
		useMemo(() => subscribeEncounterChange(encounter), [encounter]),
		() => encounterData(encounter),
	);
	const currentJson = useMemo(() => serializeEncounter(encounterJson), [encounterJson]);

	const onLoad = useCallback(
		(entry: SavedDataPanelEntry<SavedEncounterProto>) => {
			encounter.fromProto(entry.data.encounter!);
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[encounter, label],
	);

	const onSave = useCallback(
		(name: string) => {
			save(name, encounterData(encounter));
			trackEvent({ action: 'settings', category: 'save', label });
		},
		[encounter, label, save],
	);

	const onDelete = useCallback(
		(entry: SavedDataPanelEntry<SavedEncounterProto>) => {
			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	return (
		<SavedDataPanel
			title={i18n.t('settings_tab.saved_encounters.title')}
			label={label}
			nameLabel={i18n.t('settings_tab.saved_encounters.encounter_name')}
			saveButtonText={i18n.t('settings_tab.saved_encounters.save_encounter')}
			presets={presets}
			userData={userData}
			currentJson={currentJson}
			onLoad={onLoad}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
};

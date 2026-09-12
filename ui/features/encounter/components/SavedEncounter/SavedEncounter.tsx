import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { subscribeEncounterChange } from '@sim/state/subscriptions';
import { useSavedPanel } from '@features/hooks/useSavedPanel';
import { SavedEncounter as SavedEncounterProto } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useMemo } from 'react';

import { useSavedEncounter } from '../../hooks/useSavedEncounter';
import { encounterData, serializeEncounter } from './utils';

export const SavedEncounter = () => {
	const host = useSimHost();
	const { encounter } = host.sim;
	const config = useSpecPresets();
	const ready = useSimReady();

	const label = i18n.t('settings_tab.saved_encounters.encounter');

	const presets = useMemo<Array<SavedDataPanelEntry<SavedEncounterProto>>>(
		() =>
			ready
				? (config.encounters ?? []).map(preset => {
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

	const current = useStoreSubscribe(subscribeEncounterChange(encounter), () => encounterData(encounter));

	const panel = useSavedPanel({
		label,
		storage: useSavedEncounter(),
		current,
		serialize: serializeEncounter,
		load: entry => encounter.fromProto(entry.data.encounter!),
	});

	return (
		<SavedDataPanel
			container={host.rootElem}
			title={i18n.t('settings_tab.saved_encounters.title')}
			nameLabel={i18n.t('settings_tab.saved_encounters.encounter_name')}
			saveButtonText={i18n.t('settings_tab.saved_encounters.save_encounter')}
			presets={presets}
			{...panel}
		/>
	);
};

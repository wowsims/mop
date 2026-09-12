import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { batch } from '@sim/state/batch';
import { useSavedPanel } from '@features/hooks/useSavedPanel';
import { Glyphs } from '@generated/proto/common';
import type { SavedTalents as SavedTalentsProto } from '@generated/proto/ui';
import i18n from '@i18n/config';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useMemo } from 'react';

import { useSavedTalents } from '../../hooks/useSavedTalents';
import { useTalents } from '../../hooks/useTalents';
import { serializeTalents } from './utils';

export const SavedTalents = () => {
	const host = useSimHost();
	const { player } = host;
	const individualConfig = useSpecPresets();
	const ready = useSimReady();

	const label = i18n.t('talents_tab.saved_talents.label');

	const presets = useMemo<Array<SavedDataPanelEntry<SavedTalentsProto>>>(
		() =>
			ready
				? individualConfig.talents.map(preset => ({
						name: preset.name,
						data: preset.data,
						json: serializeTalents(preset.data),
						isPreset: true,
						afterLoad: () => preset.onLoad?.(player),
					}))
				: [],
		[ready, individualConfig, player],
	);

	const panel = useSavedPanel({
		label,
		storage: useSavedTalents(),
		current: useTalents(),
		serialize: serializeTalents,
		load: entry =>
			batch(() => {
				player.setTalentsString(entry.data.talentsString);
				player.setGlyphs(entry.data.glyphs || Glyphs.create());
			}),
	});

	return (
		<SavedDataPanel
			container={host.rootElem}
			title={i18n.t('talents_tab.saved_talents.title')}
			nameLabel={i18n.t('talents_tab.saved_talents.name_label')}
			saveButtonText={i18n.t('talents_tab.saved_talents.save_button')}
			deleteLabel={i18n.t('talents_tab.saved_talents.delete.tooltip')}
			deleteConfirmMessage={i18n.t('talents_tab.saved_talents.delete.confirm')}
			chooseNameAlert={i18n.t('talents_tab.saved_talents.alerts.choose_name')}
			nameExistsAlert={i18n.t('talents_tab.saved_talents.alerts.name_exists')}
			presets={presets}
			{...panel}
		/>
	);
};

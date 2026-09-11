import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { batch } from '@sim/state/batch';
import { Glyphs } from '@generated/proto/common';
import type { SavedTalents as SavedTalentsProto } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useCallback, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSavedTalents } from '../../hooks/useSavedTalents';
import { serializeTalents, talentsData } from './utils';

export const SavedTalents = () => {
	const host = useSimHost();
	const { player } = host;
	const individualConfig = useSpecPresets();
	const ready = useSimReady();

	const label = i18n.t('talents_tab.saved_talents.label');
	const { entries: userData, save, remove } = useSavedTalents();

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

	const talentsString = usePlayerStore('talentsString');
	const glyphs = usePlayerStore('glyphs');
	// eslint-disable-next-line react-hooks/exhaustive-deps -- `talentsData` reads both through the player facade rather than by name; they are the invalidation keys.
	const talents = useMemo(() => talentsData(player), [player, talentsString, glyphs]);
	const currentJson = useMemo(() => serializeTalents(talents), [talents]);

	const onLoad = useCallback(
		(entry: SavedDataPanelEntry<SavedTalentsProto>) => {
			batch(() => {
				player.setTalentsString(entry.data.talentsString);
				player.setGlyphs(entry.data.glyphs || Glyphs.create());
			});
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[player, label],
	);

	const onSave = useCallback(
		(name: string) => {
			save(name, talentsData(player));
			trackEvent({ action: 'settings', category: 'save', label });
		},
		[player, label, save],
	);

	const onDelete = useCallback(
		(entry: SavedDataPanelEntry<SavedTalentsProto>) => {
			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	return (
		<SavedDataPanel
			container={host.rootElem}
			title={i18n.t('talents_tab.saved_talents.title')}
			label={label}
			nameLabel={i18n.t('talents_tab.saved_talents.name_label')}
			saveButtonText={i18n.t('talents_tab.saved_talents.save_button')}
			deleteLabel={i18n.t('talents_tab.saved_talents.delete.tooltip')}
			deleteConfirmMessage={i18n.t('talents_tab.saved_talents.delete.confirm')}
			chooseNameAlert={i18n.t('talents_tab.saved_talents.alerts.choose_name')}
			nameExistsAlert={i18n.t('talents_tab.saved_talents.alerts.name_exists')}
			presets={presets}
			userData={userData}
			currentJson={currentJson}
			onLoad={onLoad}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
};

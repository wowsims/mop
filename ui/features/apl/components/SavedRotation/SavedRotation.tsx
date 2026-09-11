import { APLRotation } from '@generated/proto/apl';
import { SavedRotation as SavedRotationProto } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { isEqualAPLRotation } from '@sim/proto/apl_utils';
import { batch } from '@sim/state/batch';
import { subscribeAll, subscribePlayerField } from '@sim/state/subscriptions';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useCallback, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSavedRotation } from '../../hooks/useSavedRotation';
import { serializeRotation } from './utils';

export const SavedRotation = () => {
	const host = useSimHost();
	const player = host.player;
	const ready = useSimReady();

	const label = i18n.t('rotation_tab.saved_rotations.label');
	const { entries: userData, save, remove } = useSavedRotation();

	const presets = useMemo<Array<SavedDataPanelEntry<SavedRotationProto>>>(
		() =>
			ready
				? (host.individualConfig.presets.rotations ?? []).map(preset => {
						// Defaulted so the equality check below always has something to compare.
						const data = SavedRotationProto.create({ ...preset.rotation, rotation: preset.rotation.rotation ?? APLRotation.create() });
						return {
							name: preset.name,
							data,
							json: serializeRotation(data),
							tooltip: preset.tooltip,
							isPreset: true,
							disabled: !!preset.enableWhen && !preset.enableWhen(player),
							afterLoad: () => preset.onLoad?.(player),
						};
					})
				: [],
		[ready, host, player],
	);

	const current = useStoreSubscribe(subscribeAll([subscribePlayerField(player, 'rotation'), subscribePlayerField(player, 'talentsString')]), () =>
		SavedRotationProto.create({ rotation: player.getResolvedAplRotation() }),
	);

	// An Auto and an APL rotation can serialise differently and still be the same rotation, so this
	// slot is the one that needs the panel's semantic override rather than its JSON comparison.
	const isActive = useCallback(
		(entry: SavedDataPanelEntry<SavedRotationProto>) => isEqualAPLRotation(player, current.rotation, entry.data.rotation),
		[player, current],
	);

	const currentJson = useMemo(() => serializeRotation(current), [current]);

	const onLoad = useCallback(
		(entry: SavedDataPanelEntry<SavedRotationProto>) => {
			batch(() => player.setAplRotation(entry.data.rotation || APLRotation.create()));
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[player, label],
	);

	const onSave = useCallback(
		(name: string) => {
			save(name, SavedRotationProto.create({ rotation: player.getResolvedAplRotation() }));
			trackEvent({ action: 'settings', category: 'save', label });
		},
		[player, label, save],
	);

	const onDelete = useCallback(
		(entry: SavedDataPanelEntry<SavedRotationProto>) => {
			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	return (
		<SavedDataPanel
			container={host.rootElem}
			title={i18n.t('rotation_tab.saved_rotations.title')}
			label={label}
			nameLabel={i18n.t('rotation_tab.saved_rotations.name_label')}
			saveButtonText={i18n.t('rotation_tab.saved_rotations.save_button')}
			deleteLabel={i18n.t('rotation_tab.saved_rotations.delete.tooltip')}
			deleteConfirmMessage={i18n.t('rotation_tab.saved_rotations.delete.confirm')}
			chooseNameAlert={i18n.t('rotation_tab.saved_rotations.alerts.choose_name')}
			nameExistsAlert={i18n.t('rotation_tab.saved_rotations.alerts.name_exists')}
			presets={presets}
			userData={userData}
			currentJson={currentJson}
			isActive={isActive}
			onLoad={onLoad}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
};

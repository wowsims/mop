import './SavedEpWeights.scss';

import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Stats } from '@sim/proto_utils/stats';
import { subscribePlayerField } from '@sim/state/subscriptions';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { SavedEpWeightsChip } from './SavedEpWeightsChip';
import type { SavedEpWeightsEntry } from './types';
import { useSavedEpWeights } from '../../hooks/useSavedEpWeights';
import { epWeightsData, makeEntry, serializeEpWeights } from './utils';

export const SavedEpWeights = () => {
	const host = useSimHost();
	const { player, sim, individualConfig } = host;
	const ready = useSimReady(sim);
	const tooltipId = useId();
	const nameInputId = useId();

	const label = i18n.t('sidebar.buttons.stat_weights.modal.ep');
	const deleteLabel = `Delete saved ${label}`;

	const [name, setName] = useState('');
	const [loadedName, setLoadedName] = useState<string | null>(null);

	const { entries: userData, save, remove } = useSavedEpWeights();

	const presets = useMemo(
		() =>
			ready
				? individualConfig.presets.epWeights.map(preset => ({
						...makeEntry(preset.name, epWeightsData(preset.epWeights), true),
						enableWhen: preset.enableWhen,
						onLoad: preset.onLoad,
					}))
				: [],
		[ready, individualConfig],
	);

	const epWeights = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'epWeights'), [player]),
		() => player.getEpWeights(),
	);
	const currentJson = useMemo(() => serializeEpWeights(epWeightsData(epWeights)), [epWeights]);

	const activeName = useMemo(() => {
		const matches = [...userData, ...presets].filter(entry => entry.json === currentJson);
		if (loadedName && matches.some(entry => entry.name === loadedName)) return loadedName;
		return matches.at(-1)?.name;
	}, [userData, presets, currentJson, loadedName]);

	useEffect(() => {
		if (activeName) setName(activeName);
	}, [activeName]);

	const onLoad = useCallback(
		(entry: SavedEpWeightsEntry) => {
			player.setEpWeights(Stats.fromProto(entry.data.epWeights));
			entry.onLoad?.(player);
			setLoadedName(entry.name);
			setName(entry.name);
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[player, label],
	);

	const onSave = useCallback(() => {
		if (!name) {
			alert(`Choose a label for your saved ${label}!`);
			return;
		}

		save(name, epWeightsData(player.getEpWeights()));
		trackEvent({ action: 'settings', category: 'save', label });
	}, [name, label, player, save]);

	const onDelete = useCallback(
		(entry: SavedEpWeightsEntry) => {
			if (!confirm(`Delete saved ${label} '${entry.name}'?`)) return;

			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	const renderChip = (entry: SavedEpWeightsEntry) => (
		<SavedEpWeightsChip
			key={entry.name}
			entry={entry}
			active={entry.json === currentJson}
			disabled={!!entry.enableWhen && !entry.enableWhen(player)}
			deleteLabel={deleteLabel}
			deleteTooltipId={tooltipId}
			onLoad={onLoad}
			onDelete={entry.isPreset ? undefined : onDelete}
		/>
	);

	return (
		<div className="saved-data-manager-root">
			<ContentBlock cssClass="saved-data" config={{ header: { title: i18n.t('sidebar.buttons.stat_weights.saved_ep_weights.title') } }}>
				<div className="saved-data-container">
					<div className={clsx('saved-data-presets', !presets.length && 'hide')}>{presets.map(renderChip)}</div>
					<div className={clsx('saved-data-custom', !userData.length && 'hide')}>{userData.map(renderChip)}</div>
				</div>
				<div className="saved-data-create-container">
					<label className="form-label" htmlFor={nameInputId}>
						{i18n.t('sidebar.buttons.stat_weights.title')}
					</label>
					<input
						id={nameInputId}
						className="saved-data-save-input form-control"
						type="text"
						placeholder={i18n.t('common.name')}
						value={name}
						onChange={event => setName(event.target.value)}
					/>
					<Button className="saved-data-save-button" onClick={onSave}>
						{`Save ${label}`}
					</Button>
				</div>
			</ContentBlock>
			<Tooltip id={tooltipId} content={deleteLabel} />
		</div>
	);
};

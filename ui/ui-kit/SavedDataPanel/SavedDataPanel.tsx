import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { SavedDataChip } from './SavedDataChip';
import type { SavedDataPanelEntry } from './types';

export interface SavedDataPanelProps<T> {
	title: string;
	label: string;
	nameLabel?: string;
	saveButtonText?: string;
	deleteLabel?: string;
	deleteConfirmMessage?: string;
	chooseNameAlert?: string;
	nameExistsAlert?: string;
	className?: string;
	presets: Array<SavedDataPanelEntry<T>>;
	userData: Array<SavedDataPanelEntry<T>>;
	// Serialised form of the subject's live value, compared against each entry's `json`.
	currentJson: string;
	loadOnly?: boolean;
	onLoad: (entry: SavedDataPanelEntry<T>) => void;
	onSave: (name: string) => void;
	onDelete: (entry: SavedDataPanelEntry<T>) => void;
}

export const SavedDataPanel = <T,>({
	title,
	label,
	nameLabel,
	saveButtonText,
	deleteLabel,
	deleteConfirmMessage,
	chooseNameAlert,
	nameExistsAlert,
	className,
	presets,
	userData,
	currentJson,
	loadOnly,
	onLoad,
	onSave,
	onDelete,
}: SavedDataPanelProps<T>) => {
	const tooltipId = useId();
	const nameInputId = useId();
	const [name, setName] = useState('');
	const [loadedName, setLoadedName] = useState<string | null>(null);

	const deleteText = deleteLabel ?? `Delete saved ${label}`;

	// The last match wins, so a preset and a user entry holding the same value both light up the one
	// the user actually loaded; without the loaded name a save under a new label would jump the
	// highlight to whichever entry happened to be last.
	const activeName = useMemo(() => {
		const matches = [...userData, ...presets].filter(entry => entry.json === currentJson);
		if (loadedName && matches.some(entry => entry.name === loadedName)) return loadedName;
		return matches.at(-1)?.name;
	}, [userData, presets, currentJson, loadedName]);

	useEffect(() => {
		if (activeName) setName(activeName);
	}, [activeName]);

	const handleLoad = useCallback(
		(entry: SavedDataPanelEntry<T>) => {
			onLoad(entry);
			entry.afterLoad?.();
			setLoadedName(entry.name);
			setName(entry.name);
		},
		[onLoad],
	);

	const handleSave = useCallback(() => {
		if (!name) {
			alert(chooseNameAlert ?? `Choose a label for your saved ${label}!`);
			return;
		}
		if (presets.some(preset => preset.name === name)) {
			alert(nameExistsAlert ?? `${label} with name ${name} already exists.`);
			return;
		}
		onSave(name);
	}, [name, label, chooseNameAlert, nameExistsAlert, presets, onSave]);

	const handleDelete = useCallback(
		(entry: SavedDataPanelEntry<T>) => {
			if (!confirm(deleteConfirmMessage ?? `Delete saved ${label} '${entry.name}'?`)) return;
			onDelete(entry);
		},
		[label, deleteConfirmMessage, onDelete],
	);

	const renderChip = (entry: SavedDataPanelEntry<T>) => (
		<SavedDataChip
			key={entry.name}
			entry={entry}
			active={entry.json === currentJson}
			disabled={!!entry.disabled}
			deleteLabel={deleteText}
			deleteTooltipId={tooltipId}
			onLoad={handleLoad}
			onDelete={entry.isPreset || loadOnly ? undefined : handleDelete}
		/>
	);

	return (
		<div className={clsx('saved-data-manager-root', className)}>
			<ContentBlock cssClass="saved-data" config={{ header: { title } }}>
				<div className="saved-data-container">
					<div className={clsx('saved-data-presets', !presets.length && 'hide')}>{presets.map(renderChip)}</div>
					<div className={clsx('saved-data-custom', !userData.length && 'hide')}>{userData.map(renderChip)}</div>
				</div>
				{!loadOnly && (
					<div className="saved-data-create-container">
						<label className="form-label" htmlFor={nameInputId}>
							{nameLabel ?? label}
						</label>
						<input
							id={nameInputId}
							className="saved-data-save-input form-control"
							type="text"
							placeholder={i18n.t('common.name')}
							value={name}
							onChange={event => setName(event.target.value)}
						/>
						<Button className="saved-data-save-button" onClick={handleSave}>
							{saveButtonText ?? `Save ${label}`}
						</Button>
					</div>
				)}
			</ContentBlock>
			<Tooltip id={tooltipId} content={deleteText} />
		</div>
	);
};

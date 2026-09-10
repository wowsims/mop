import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { ConfirmPopover } from '@ui-kit/ConfirmPopover';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { LocaleHtml, Tooltip } from '@ui-kit/Tooltip';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

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
	className?: ClassValue;
	/** Where the confirmation popovers mount; the default is outside `.sim-ui`, where the spec theme lives. */
	container?: HTMLElement | null;
	presets: Array<SavedDataPanelEntry<T>>;
	userData: Array<SavedDataPanelEntry<T>>;
	// Serialised form of the subject's live value, compared against each entry's `json`.
	currentJson: string;
	// Overrides that comparison where a JSON string cannot decide it. Rotations are the case this
	// exists for: an Auto and an APL rotation can serialise differently and still be the same
	// rotation, which is why `SavedDataManager` carried an optional `equals` of its own.
	isActive?: (entry: SavedDataPanelEntry<T>) => boolean;
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
	container,
	presets,
	userData,
	currentJson,
	isActive,
	loadOnly,
	onLoad,
	onSave,
	onDelete,
}: SavedDataPanelProps<T>) => {
	const tooltipId = useId();
	const chipTooltipId = useId();
	const nameInputId = useId();
	const [name, setName] = useState('');
	const [loadedName, setLoadedName] = useState<string | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const createRef = useRef<HTMLDivElement>(null);

	const deleteText = deleteLabel ?? i18n.t('common.saved_data.delete_title', { label });

	const matchesCurrent = useCallback((entry: SavedDataPanelEntry<T>) => (isActive ? isActive(entry) : entry.json === currentJson), [isActive, currentJson]);

	// `isActive` can be a whole-tree proto comparison (rotations), so the match set is resolved once
	// per change of the entries or of the subject, not once per entry per render.
	const matches = useMemo(() => [...userData, ...presets].filter(matchesCurrent), [userData, presets, matchesCurrent]);

	// The last match wins, so a preset and a user entry holding the same value both light up the one
	// the user actually loaded; without the loaded name a save under a new label would jump the
	// highlight to whichever entry happened to be last.
	const activeName = useMemo(() => {
		if (loadedName && matches.some(entry => entry.name === loadedName)) return loadedName;
		return matches.at(-1)?.name;
	}, [matches, loadedName]);

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
			setProblem(chooseNameAlert ?? i18n.t('common.saved_data.choose_name', { label }));
			return;
		}
		if (presets.some(preset => preset.name === name)) {
			setProblem(nameExistsAlert ? nameExistsAlert.replace('{{name}}', name) : i18n.t('common.saved_data.name_exists', { label, name }));
			return;
		}
		onSave(name);
	}, [name, label, chooseNameAlert, nameExistsAlert, presets, onSave]);

	const deleteMessage = (entry: SavedDataPanelEntry<T>) =>
		deleteConfirmMessage ? deleteConfirmMessage.replace('{{name}}', entry.name) : i18n.t('common.saved_data.delete_confirm', { label, name: entry.name });

	const renderChip = (entry: SavedDataPanelEntry<T>) => (
		<SavedDataChip
			key={entry.name}
			entry={entry}
			active={matches.includes(entry)}
			disabled={!!entry.disabled}
			deleteLabel={deleteText}
			deleteTooltipId={tooltipId}
			chipTooltipId={chipTooltipId}
			deleteMessage={deleteMessage(entry)}
			deleteConfirmLabel={i18n.t('common.delete')}
			container={container}
			onLoad={handleLoad}
			onDelete={entry.isPreset || loadOnly ? undefined : onDelete}
		/>
	);

	return (
		<div className={clsx('saved-data-manager-root', className)}>
			<ContentBlock className="saved-data" config={{ header: { title } }}>
				<div className="saved-data-container">
					<div className={clsx('saved-data-presets', !presets.length && 'hide')}>{presets.map(renderChip)}</div>
					<div className={clsx('saved-data-custom', !userData.length && 'hide')}>{userData.map(renderChip)}</div>
				</div>
				{!loadOnly && (
					<div ref={createRef} className="saved-data-create-container">
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
			<Tooltip
				id={chipTooltipId}
				place="bottom"
				render={({ content }) => (typeof content === 'string' && content ? <LocaleHtml html={content} /> : null)}
			/>
			<ConfirmPopover open={!!problem} onOpenChange={open => !open && setProblem(null)} anchor={createRef} container={container}>
				{problem}
			</ConfirmPopover>
		</div>
	);
};

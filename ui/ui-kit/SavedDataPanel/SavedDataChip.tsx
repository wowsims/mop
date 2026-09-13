import { Chip } from '@ui-kit/Chip';
import type { ReactNode } from 'react';

import type { SavedDataPanelEntry } from './types';

export interface SavedDataChipProps<T> {
	entry: SavedDataPanelEntry<T>;
	active: boolean;
	disabled: boolean;
	deleteLabel?: string;
	deleteTooltipId?: string;
	chipTooltipId?: string;
	deleteMessage?: ReactNode;
	deleteConfirmLabel?: string;
	container?: HTMLElement | null;
	onLoad: (entry: SavedDataPanelEntry<T>) => void;
	onDelete?: (entry: SavedDataPanelEntry<T>) => void;
}

export const SavedDataChip = <T,>({
	entry,
	active,
	disabled,
	deleteLabel,
	deleteTooltipId,
	chipTooltipId,
	deleteMessage,
	deleteConfirmLabel,
	container,
	onLoad,
	onDelete,
}: SavedDataChipProps<T>) => (
	<Chip
		label={entry.name}
		active={active}
		disabled={disabled}
		tooltip={entry.tooltip}
		chipTooltipId={chipTooltipId}
		deleteLabel={deleteLabel}
		deleteTooltipId={deleteTooltipId}
		deleteMessage={deleteMessage}
		deleteConfirmLabel={deleteConfirmLabel}
		container={container}
		onSelect={() => onLoad(entry)}
		onDelete={onDelete ? () => onDelete(entry) : undefined}
	/>
);

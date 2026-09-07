import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { SavedDataPanelEntry } from './types';

export interface SavedDataChipProps<T> {
	entry: SavedDataPanelEntry<T>;
	active: boolean;
	disabled: boolean;
	deleteLabel?: string;
	deleteTooltipId?: string;
	chipTooltipId?: string;
	onLoad: (entry: SavedDataPanelEntry<T>) => void;
	onDelete?: (entry: SavedDataPanelEntry<T>) => void;
}

export const SavedDataChip = <T,>({ entry, active, disabled, deleteLabel, deleteTooltipId, chipTooltipId, onLoad, onDelete }: SavedDataChipProps<T>) => (
	<div className={clsx('saved-data-set-chip badge rounded-pill', active && 'active', disabled && 'disabled')}>
		<Button
			variant="unstyled"
			className="saved-data-set-name"
			onClick={() => onLoad(entry)}
			{...tooltipAnchorProps(entry.tooltip ? chipTooltipId : undefined, entry.tooltip)}>
			{entry.name}
		</Button>
		{onDelete && (
			<Button
				variant="unstyled"
				className="saved-data-set-delete"
				aria-label={deleteLabel}
				onClick={() => onDelete(entry)}
				{...tooltipAnchorProps(deleteTooltipId)}>
				<Icon name="times" style="base" size="lg" />
			</Button>
		)}
	</div>
);

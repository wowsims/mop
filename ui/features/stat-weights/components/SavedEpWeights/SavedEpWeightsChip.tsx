import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { SavedEpWeightsEntry } from './types';

export interface SavedEpWeightsChipProps {
	entry: SavedEpWeightsEntry;
	active: boolean;
	disabled: boolean;
	deleteLabel?: string;
	deleteTooltipId?: string;
	onLoad: (entry: SavedEpWeightsEntry) => void;
	onDelete?: (entry: SavedEpWeightsEntry) => void;
}

export const SavedEpWeightsChip = ({ entry, active, disabled, deleteLabel, deleteTooltipId, onLoad, onDelete }: SavedEpWeightsChipProps) => (
	<div className={clsx('saved-data-set-chip badge rounded-pill', active && 'active', disabled && 'disabled')}>
		<Button variant="unstyled" className="saved-data-set-name" onClick={() => onLoad(entry)}>
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

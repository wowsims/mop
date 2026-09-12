import { Button } from '@ui-kit/Button';
import { ConfirmPopover } from '@ui-kit/ConfirmPopover';
import { Icon } from '@ui-kit/Icon';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useState } from 'react';

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
}: SavedDataChipProps<T>) => {
	const [confirming, setConfirming] = useState(false);

	return (
		<div className={clsx('saved-data-set-chip badge rounded-pill', active && 'active', disabled && 'disabled')}>
			<Button
				variant="unstyled"
				className="saved-data-set-name"
				onClick={() => onLoad(entry)}
				{...tooltipAnchorProps(entry.tooltip ? chipTooltipId : undefined, entry.tooltip)}>
				{entry.name}
			</Button>
			{onDelete && (
				<ConfirmPopover
					open={confirming}
					onOpenChange={setConfirming}
					container={container}
					trigger={<Icon name="times" style="base" size="lg" />}
					triggerClassName="saved-data-set-delete"
					triggerProps={{ 'aria-label': deleteLabel, ...tooltipAnchorProps(deleteTooltipId) }}
					confirmLabel={deleteConfirmLabel}
					onConfirm={() => onDelete(entry)}>
					{deleteMessage}
				</ConfirmPopover>
			)}
		</div>
	);
};

import type { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { getStatName } from '@sim/proto/names';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps, type TooltipRefProps } from '@ui-kit/Tooltip';
import { useCallback, useId, useRef, useState } from 'react';

import { BonusStatsPicker } from './BonusStatsPicker';

export interface BonusStatsLinkProps {
	rootStat: Stat;
}

export const BonusStatsLink = ({ rootStat }: BonusStatsLinkProps) => {
	const id = useId();
	const popover = useRef<TooltipRefProps>(null);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const label = `${i18n.t('sidebar.character_stats.bonus_prefix')} ${getStatName(rootStat)}`;
	const action = i18n.t('sidebar.character_stats.bonus_action', { stat: getStatName(rootStat) });
	const closePopover = useCallback(() => popover.current?.close(), []);

	return (
		<>
			<Button variant="unstyled" data-testid="add-bonus-stats" className="text-white ml-2" aria-label={action} {...tooltipAnchorProps(`${id}-popover`)}>
				<Icon name="plus-minus" {...tooltipAnchorProps(`${id}-icon`)} />
			</Button>
			<Tooltip id={`${id}-icon`} content={label} hidden={popoverOpen} />
			<Tooltip
				ref={popover}
				id={`${id}-popover`}
				className="bonus-stats-popover [&_.number-picker-root]:flex-col [&_.number-picker-input]:w-32 [&_.number-picker-input]:m-0 [&_.number-picker-input]:flex-1"
				align="start"
				place="right"
				openOnClick
				clickable
				onOpenChange={setPopoverOpen}
				content={<BonusStatsPicker rootStat={rootStat} label={label} onCommit={closePopover} />}
			/>
		</>
	);
};

import type { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { getStatName } from '@sim/proto/names';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { NumberPickerConfig } from '@ui-kit/NumberPicker/types';
import { Tooltip, tooltipAnchorProps, type TooltipRefProps } from '@ui-kit/Tooltip';
import { useId, useMemo, useRef, useState } from 'react';

export interface BonusStatsLinkProps {
	rootStat: Stat;
}

export const BonusStatsLink = ({ rootStat }: BonusStatsLinkProps) => {
	const player = usePlayer();
	const id = useId();
	const popover = useRef<TooltipRefProps>(null);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const label = `${i18n.t('sidebar.character_stats.bonus_prefix')} ${getStatName(rootStat)}`;
	const action = i18n.t('sidebar.character_stats.bonus_action', { stat: getStatName(rootStat) });

	const config = useMemo(
		(): NumberPickerConfig<Player<any>> => ({
			id: `character-bonus-stat-${rootStat}`,
			label,
			extraCssClasses: ['mb-0'],
			storeSubscribe: subject => subscribePlayerField(subject, 'bonusStats'),
			getValue: subject => subject.getBonusStats().getStat(rootStat),
			setValue: (subject, newValue) => {
				subject.setBonusStats(subject.getBonusStats().withStat(rootStat, newValue));
				popover.current?.close();
			},
		}),
		[rootStat, label],
	);

	return (
		<>
			<Button variant="unstyled" className="add-bonus-stats text-white ms-2" aria-label={action} {...tooltipAnchorProps(`${id}-popover`)}>
				<Icon name="plus-minus" {...tooltipAnchorProps(`${id}-icon`)} />
			</Button>
			<Tooltip id={`${id}-icon`} content={label} hidden={popoverOpen} />
			<Tooltip
				ref={popover}
				id={`${id}-popover`}
				className="bonus-stats-popover"
				place="right"
				openOnClick
				clickable
				onOpenChange={setPopoverOpen}
				content={<NumberPicker modObject={player} config={config} />}
			/>
		</>
	);
};

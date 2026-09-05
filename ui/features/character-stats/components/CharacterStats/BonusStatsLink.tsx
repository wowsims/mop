import type { Player } from '@domain/player';
import { getStatName } from '@domain/proto_utils/names';
import { subscribePlayerField } from '@domain/state/subscriptions';
import { usePlayer } from '@features/sim_host_context';
import type { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import { Tooltip, type TooltipRefProps } from '@ui-kit/Tooltip';
import { useId, useMemo, useRef, useState } from 'react';

export interface BonusStatsLinkProps {
	rootStat: Stat;
}

/**
 * The `±` affordance in a stat's value cell. It owns two tooltips — the icon's name on hover, and
 * the picker on click — which is why `Icon` has to forward unknown props: the popover anchors on the
 * button and the hover tooltip on the `<i>` inside it.
 */
export const BonusStatsLink = ({ rootStat }: BonusStatsLinkProps) => {
	const player = usePlayer();
	const id = useId();
	const popover = useRef<TooltipRefProps>(null);
	// The icon's hover tooltip says the same thing the open popover's label does, and tippy hid it on
	// any click (`hideOnClick`). react-tooltip's equivalent loses a race on a *cold* click, where the
	// pointer's mouseenter and the click arrive together and its deferred show wins — so suppress it
	// declaratively instead of relying on event order.
	const [popoverOpen, setPopoverOpen] = useState(false);
	const label = `${i18n.t('sidebar.character_stats.bonus_prefix')} ${getStatName(rootStat)}`;

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
			{/* The vanilla button carried an inert `data-bs-toggle="popover"`: Bootstrap popovers are
			    opt-in and nothing in the tree ever constructed one, so it held no behaviour. */}
			<button className="add-bonus-stats text-white ms-2" data-tooltip-id={`${id}-popover`}>
				<Icon name="plus-minus" data-tooltip-id={`${id}-icon`} />
			</button>
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

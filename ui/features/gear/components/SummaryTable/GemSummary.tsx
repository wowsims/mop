import type { UIGem as Gem } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { useIsBlacksmithing } from '@sim/hooks/useIsBlacksmithing';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { ActionId } from '@sim/proto/action_id';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { SummaryTableRow } from '@ui-kit/SummaryTableRow';
import { itemQualityClassName } from '@ui-kit/utils/css';
import clsx from 'clsx';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { gemSummaryRows } from '../../model/summary_totals';
import { SummaryTable } from './SummaryTable';

const GemRow = ({ gem, count }: { gem: Gem; count: number }) => {
	const actionId = ActionId.fromItemId(gem.id);
	const { iconUrl, href } = useActionId(actionId);

	return (
		<SummaryTableRow>
			<a
				className={clsx('flex items-center', itemQualityClassName(gem.quality))}
				data-whtticon="false"
				target="_blank"
				href={href || undefined}
				rel={externalRel(href, undefined)}>
				<img
					className="ui-summary-table-gem-icon static rounded-none inline-block size-gem-inner inset-gem z-1 bg-no-repeat bg-cover bg-center cursor-pointer"
					data-testid="gem-icon"
					src={iconUrl || undefined}
					alt=""
				/>
				<div>{gem.name}</div>
			</a>
			<div>{count.toFixed(0)}</div>
		</SummaryTableRow>
	);
};

export const GemSummary = () => {
	const player = usePlayer();
	const gear = useStoreSubscribe(subscribePlayerField(player, 'gear'), () => player.getGear());
	const isBlacksmithing = useIsBlacksmithing();
	const rows = useMemo(() => gemSummaryRows(gear.getAllGems(isBlacksmithing)), [gear, isBlacksmithing]);

	return (
		<SummaryTable
			title={i18n.t('gear_tab.gem_summary.title')}
			modifier="summary-table--gems"
			empty={!rows.length}
			reset={{
				label: i18n.t('gear_tab.gem_summary.reset_gems'),
				onReset: () => {
					trackEvent({ action: 'click', category: 'gems', label: 'reset' });
					player.setGear(player.getGear().withoutGems(player.canDualWield2H()));
				},
			}}>
			{rows.map(row => (
				<GemRow key={row.gem.name} gem={row.gem} count={row.count} />
			))}
		</SummaryTable>
	);
};

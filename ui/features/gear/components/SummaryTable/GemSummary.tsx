import { usePlayer } from '@sim/context/SimHostContext';
import { externalRel } from '@sim/utils/links';
import { ActionId } from '@sim/proto/action_id';
import { subscribePlayerField } from '@sim/state/subscriptions';
import type { UIGem as Gem } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { itemQualityClassName } from '@ui-kit/utils/css';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import clsx from 'clsx';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { gemSummaryRows } from '../../model/summary_totals';
import { SummaryTable } from './SummaryTable';
import { SummaryTableRow } from './SummaryTableRow';

const GemRow = ({ gem, count }: { gem: Gem; count: number }) => {
	const actionId = useMemo(() => ActionId.fromItemId(gem.id), [gem.id]);
	const { iconUrl, href } = useActionId(actionId);

	return (
		<SummaryTableRow>
			<a
				className={clsx('summary-table-link', itemQualityClassName(gem.quality))}
				data-whtticon="false"
				target="_blank"
				href={href || undefined}
				rel={externalRel(href, undefined)}>
				<img className="gem-icon" src={iconUrl || undefined} alt="" />
				<div>{gem.name}</div>
			</a>
			<div>{count.toFixed(0)}</div>
		</SummaryTableRow>
	);
};

export const GemSummary = () => {
	const player = usePlayer();
	const gearSubscribe = subscribePlayerField(player, 'gear');
	const gear = useStoreSubscribe(gearSubscribe, () => player.getGear());
	const rows = useMemo(() => gemSummaryRows(gear.getAllGems(player.isBlacksmithing())), [gear, player]);

	return (
		<SummaryTable
			title={i18n.t('gear_tab.gem_summary.title')}
			className="summary-table--gems"
			headerClassName="summary-table--gems"
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

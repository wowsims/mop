import { useSimHost } from '@domain/context/SimHostContext';
import { subscribePlayerField } from '@domain/state/subscriptions';
import type { Stat } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translateStat } from '@i18n/localization';
import { CopyButton } from '@ui-kit/copy_button';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { reforgeTotals } from '../../model/summary_totals';
import { SummaryTable } from './SummaryTable';
import { SummaryTableRow } from './SummaryTableRow';

export const ReforgeSummary = () => {
	const host = useSimHost();
	const player = host.player;
	const gearSubscribe = useMemo(() => subscribePlayerField(player, 'gear'), [player]);
	const gear = useStoreSubscribe(gearSubscribe, () => player.getGear());
	const totals = useMemo(() => reforgeTotals(gear.getAllReforges()), [gear]);
	const stats = Object.keys(totals).map(Number) as Stat[];

	const mountCopyButton = useLegacyMount(
		parent =>
			new CopyButton(parent, {
				extraCssClasses: ['btn-outline-primary'],
				getContent: () => {
					trackEvent({ action: 'click', category: 'reforging', label: 'copy' });
					try {
						// Lazy export so we always capture the most current state, matching optimizer button logic.
						const proto = host.toProto();
						return JSON.stringify(proto ? IndividualSimSettings.toJson(proto) : {});
					} catch {
						return '';
					}
				},
				text: i18n.t('gear_tab.reforge_summary.copy_to_reforge_lite'),
			}),
		[host],
	);

	return (
		<SummaryTable
			title={i18n.t('gear_tab.reforge_summary.title')}
			cssClass="summary-table--reforge"
			empty={!stats.length}
			reset={{
				label: i18n.t('gear_tab.reforge_summary.reset_reforges'),
				onReset: () => {
					trackEvent({ action: 'click', category: 'reforging', label: 'reset' });
					player.setGear(player.getGear().withoutReforges(player.canDualWield2H()));
				},
			}}>
			{stats.map(stat => {
				const value = totals[stat];
				if (!value) return null;
				return (
					<SummaryTableRow key={stat}>
						<div>{translateStat(stat)}</div>
						<div className={value > 0 ? 'positive' : 'negative'}>{value}</div>
					</SummaryTableRow>
				);
			})}
			<div className="reforge-summary-footer mt-2">
				<div className="d-flex w-100 justify-content-end" ref={mountCopyButton} />
			</div>
		</SummaryTable>
	);
};

import { useSimHost } from '@domain/context/SimHostContext';
import { subscribePlayerField } from '@domain/state/subscriptions';
import type { Stat } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translateStat } from '@i18n/localization';
import { Button } from '@ui-kit/Button';
import { useCopyToClipboard } from '@ui-kit/hooks/useCopyToClipboard';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Icon } from '@ui-kit/Icon';
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

	const { copy, copied } = useCopyToClipboard(() => {
		trackEvent({ action: 'click', category: 'reforging', label: 'copy' });
		try {
			// Lazy export so we always capture the most current state, matching optimizer button logic.
			const proto = host.toProto();
			return JSON.stringify(proto ? IndividualSimSettings.toJson(proto) : {});
		} catch {
			return '';
		}
	});

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
				<div className="d-flex w-100 justify-content-end">
					<Button variant="outline-primary" className="copy-button" onClick={copy}>
						<Icon name={copied ? 'check' : 'copy'} className="me-1" />
						{copied ? i18n.t('common.copy_button.copied') : i18n.t('gear_tab.reforge_summary.copy_to_reforge_lite')}
					</Button>
				</div>
			</div>
		</SummaryTable>
	);
};

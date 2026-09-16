import type { Stat } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translateStat } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { Button } from '@ui-kit/Button';
import { useCopyToClipboard } from '@ui-kit/hooks/useCopyToClipboard';
import { Icon } from '@ui-kit/Icon';
import { SummaryTableRow } from '@ui-kit/SummaryTableRow';
import { toneTextClass } from '@ui-kit/utils/css';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { reforgeTotals } from '../../model/summary_totals';
import { SummaryTable } from './SummaryTable';

export const ReforgeSummary = () => {
	const host = useSimHost();
	const player = host.player;
	const gear = usePlayerStore('gear');
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
			modifier="summary-table--reforge"
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
				const tone = value > 0 ? 'positive' : 'negative';
				return (
					<SummaryTableRow key={stat}>
						<div>{translateStat(stat)}</div>
						<div className={toneTextClass(tone)} data-sign={tone}>
							{value}
						</div>
					</SummaryTableRow>
				);
			})}
			<div className="mt-2" data-testid="reforge-summary-footer">
				<div className="flex w-full justify-end">
					<Button variant="outline-primary" data-testid="copy-button" onClick={copy}>
						<Icon name={copied ? 'check' : 'copy'} className="mr-1" />
						{copied ? i18n.t('common.copy_button.copied') : i18n.t('gear_tab.reforge_summary.copy_to_reforge_lite')}
					</Button>
				</div>
			</div>
		</SummaryTable>
	);
};

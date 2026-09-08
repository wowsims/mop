import { usePlayer } from '@sim/context/SimHostContext';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { Faction } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Icon } from '@ui-kit/Icon';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { itemsWithUpgradeOptions, upgradeCostTotals, type UpgradeSummaryTotal } from '../../model/summary_totals';
import { SummaryTable } from './SummaryTable';
import { SummaryTableRow } from './SummaryTableRow';

const currencyIconUrl = (key: string, faction: Faction) => {
	if (key === 'justicePoints') return 'https://wow.zamimg.com/images/wow/icons/small/pvecurrency-justice.jpg';
	if (key === 'valorPoints') return 'https://wow.zamimg.com/images/wow/icons/small/pvecurrency-valor.jpg';
	return `https://wow.zamimg.com/images/wow/icons/small/pvpcurrency-honor-${faction === Faction.Horde ? 'horde' : 'alliance'}.jpg`;
};

export const UpgradeCostsSummary = () => {
	const player = usePlayer();
	const gearSubscribe = useMemo(() => subscribePlayerField(player, 'gear'), [player]);
	const raceSubscribe = useMemo(() => subscribePlayerField(player, 'race'), [player]);
	const gear = useStoreSubscribe(gearSubscribe, () => player.getGear());
	const faction = useStoreSubscribe(raceSubscribe, () => player.getFaction());
	const upgradeable = useMemo(() => itemsWithUpgradeOptions(gear.asArray()), [gear]);
	const totals = useMemo(() => upgradeCostTotals(upgradeable), [upgradeable]);

	return (
		<SummaryTable
			title={i18n.t('gear_tab.upgrade_summary.title')}
			className="summary-table--upgrade-costs"
			empty={!upgradeable.length}
			reset={{
				label: i18n.t('gear_tab.upgrade_summary.reset_upgrades'),
				onReset: () => {
					trackEvent({ action: 'click', category: 'upgrades', label: 'reset' });
					player.setGear(player.getGear().withoutUpgrades(player.canDualWield2H()));
				},
			}}>
			{(Object.entries(totals) as Array<[keyof UpgradeSummaryTotal, number]>).map(([key, points]) =>
				points > 0 ? (
					<div key={key}>
						<SummaryTableRow>
							<div className="d-flex align-items-center">
								<img className="gem-icon" src={currencyIconUrl(key, faction)} alt="" />
								<div>{i18n.t(`common.currency.${key}`)}</div>
							</div>
							<div>{points}</div>
						</SummaryTableRow>
					</div>
				) : null,
			)}
			<div className="upgrade-costs-summary-footer mt-2">
				<div className="d-flex w-100 justify-content-end">
					<Button
						variant="outline-primary"
						onClick={() => {
							trackEvent({ action: 'click', category: 'upgrades', label: 'upgrade_all' });
							let curGear = player.getGear();
							for (const slot of curGear.getItemSlots()) {
								const item = curGear.getEquippedItem(slot);
								if (item) curGear = curGear.withEquippedItem(slot, item.withUpgrade(item.getMaxUpgradeCount()), player.canDualWield2H());
							}
							player.setGear(curGear);
						}}>
						<Icon name="arrow-up" className="me-1" />
						{i18n.t('gear_tab.upgrade_summary.upgrade_all_items')}
					</Button>
				</div>
			</div>
		</SummaryTable>
	);
};

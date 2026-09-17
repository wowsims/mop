import { Faction, type Race } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { raceToFaction } from '@sim/proto/utils';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { SummaryTableRow } from '@ui-kit/SummaryTableRow';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { itemsWithUpgradeOptions, upgradeCostTotals, type UpgradeSummaryTotal } from '../../model/summary_totals';
import { SummaryTable } from './SummaryTable';

const currencyIconUrl = (key: string, faction: Faction) => {
	if (key === 'justicePoints') return 'https://wow.zamimg.com/images/wow/icons/small/pvecurrency-justice.jpg';
	if (key === 'valorPoints') return 'https://wow.zamimg.com/images/wow/icons/small/pvecurrency-valor.jpg';
	return `https://wow.zamimg.com/images/wow/icons/small/pvpcurrency-honor-${faction === Faction.Horde ? 'horde' : 'alliance'}.jpg`;
};

export const UpgradeCostsSummary = () => {
	const player = usePlayer();
	const gear = usePlayerStore('gear');
	const faction = raceToFaction[usePlayerStore('race') as Race];
	const upgradeable = useMemo(() => itemsWithUpgradeOptions(gear.asArray()), [gear]);
	const totals = useMemo(() => upgradeCostTotals(upgradeable), [upgradeable]);

	return (
		<SummaryTable
			title={i18n.t('gear_tab.upgrade_summary.title')}
			modifier="summary-table--upgrade-costs"
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
							<div className="flex items-center">
								<img
									className="ui-summary-table-gem-icon static inset-gem z-1 inline-block size-gem-inner cursor-default rounded-none bg-cover bg-center bg-no-repeat"
									data-testid="gem-icon"
									src={currencyIconUrl(key, faction)}
									alt=""
								/>
								<div>{i18n.t(`common.currency.${key}`)}</div>
							</div>
							<div>{points}</div>
						</SummaryTableRow>
					</div>
				) : null,
			)}
			<div className="mt-2" data-testid="upgrade-costs-summary-footer">
				<div className="flex w-full justify-end">
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
						<Icon name="arrow-up" className="mr-1" />
						{i18n.t('gear_tab.upgrade_summary.upgrade_all_items')}
					</Button>
				</div>
			</div>
		</SummaryTable>
	);
};

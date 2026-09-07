/** @jsxImportSource @jsx-vanilla */
import { Player } from '@domain/player';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import type { IndividualSimHost } from '@features/sim_host';
import { Faction } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { ContentBlock } from '@ui-kit/content_block';

import { trackEvent } from '../../../tracking/analytics';
import { itemsWithUpgradeOptions, upgradeCostTotals } from '../model/summary_totals';

export class UpgradeCostsSummary extends Component {
	private readonly simUI: IndividualSimHost<any>;
	private readonly player: Player<any>;

	private readonly container: ContentBlock;

	constructor(parent: HTMLElement, simUI: IndividualSimHost<any>, player: Player<any>) {
		super(parent, 'summary-table-root');
		this.rootElem.classList.add('hide');

		this.simUI = simUI;
		this.player = player;

		this.container = new ContentBlock(this.rootElem, 'summary-table-container', {
			header: { title: i18n.t('gear_tab.upgrade_summary.title') },
			extraCssClasses: ['summary-table--upgrade-costs'],
		});

		this.addOnDisposeCallback(subscribeAll([subscribePlayerField(player, 'gear'), subscribePlayerField(player, 'race')])(() => this.updateTable()));
	}

	private updateTable() {
		const body = <></>;
		const itemsWithUpgrade = itemsWithUpgradeOptions(this.player.getGear().asArray());

		const hasUpgradeItems = !!Object.keys(itemsWithUpgrade).length;
		this.rootElem.classList[!hasUpgradeItems ? 'add' : 'remove']('hide');

		if (hasUpgradeItems) {
			const totals = upgradeCostTotals(itemsWithUpgrade);

			Object.entries(totals).forEach(([key, points]) => {
				if (points > 0) {
					body.appendChild(
						<div>
							<div className="summary-table-row d-flex align-items-center">
								<div className="d-flex align-items-center">
									<img
										className="gem-icon"
										src={
											key === 'justicePoints'
												? 'https://wow.zamimg.com/images/wow/icons/small/pvecurrency-justice.jpg'
												: key === 'valorPoints'
													? 'https://wow.zamimg.com/images/wow/icons/small/pvecurrency-valor.jpg'
													: `https://wow.zamimg.com/images/wow/icons/small/pvpcurrency-honor-${this.player.getFaction() === Faction.Horde ? 'horde' : 'alliance'}.jpg`
										}
									/>
									<div>{i18n.t(`common.currency.${key}`)}</div>
								</div>
								<div>{points}</div>
							</div>
						</div>,
					);
				}
			});

			// Replace rows in body
			this.container.bodyElement.replaceChildren(body);

			// Add / replace footer action area with copy button
			const existingFooter = this.container.bodyElement.querySelector('.upgrade-costs-summary-footer');
			if (existingFooter) existingFooter.remove();

			this.container.bodyElement.appendChild(
				<div className="upgrade-costs-summary-footer mt-2">
					<div className="d-flex w-100 justify-content-end">
						<button
							className="btn btn-outline-primary"
							onclick={() => {
								trackEvent({
									action: 'click',
									category: 'upgrades',
									label: 'upgrade_all',
								});
								let curGear = this.player.getGear();

								for (const slot of curGear.getItemSlots()) {
									const item = curGear.getEquippedItem(slot);

									if (item) {
										curGear = curGear.withEquippedItem(slot, item.withUpgrade(item.getMaxUpgradeCount()), this.player.canDualWield2H());
									}
								}

								this.player.setGear(curGear);
							}}>
							<i className="fas fa-arrow-up me-1"></i>
							{i18n.t('gear_tab.upgrade_summary.upgrade_all_items')}
						</button>
					</div>
				</div>,
			);

			if (!this.container.headerElement) return;
			const existingResetButton = this.container.headerElement.querySelector('.summary-table-reset-button');
			const resetButton = (
				<button
					className="btn btn-sm btn-link btn-reset summary-table-reset-button"
					onclick={() => {
						trackEvent({
							action: 'click',
							category: 'upgrades',
							label: 'reset',
						});
						const gear = this.player.getGear().withoutUpgrades(this.player.canDualWield2H());
						this.player.setGear(gear);
					}}>
					<i className="fas fa-times me-1"></i>
					{i18n.t('gear_tab.upgrade_summary.reset_upgrades')}
				</button>
			);

			if (existingResetButton) {
				this.container.headerElement.replaceChild(resetButton, existingResetButton);
			} else {
				this.container.headerElement.appendChild(resetButton);
			}
		}
	}
}

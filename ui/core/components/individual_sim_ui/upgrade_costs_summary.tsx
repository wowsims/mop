import { Player } from '../../player';
import { Faction, ItemQuality } from '../../proto/common';
import i18n from '../../../i18n/config';
import { TypedEvent } from '../../typed_event';
import { Component } from '../component';
import { ContentBlock } from '../content_block';
import { IndividualSimUI } from '../../individual_sim_ui';
import { EquippedItem } from '../../proto_utils/equipped_item';
import { trackEvent } from '../../../tracking/utils';

export const COSTS = new Map<ItemQuality, number>([
	[ItemQuality.ItemQualityRare, 750],
	[ItemQuality.ItemQualityEpic, 1000],
	[ItemQuality.ItemQualityLegendary, 1000],
]);

export class UpgradeCostsSummary extends Component {
	private readonly simUI: IndividualSimUI<any>;
	private readonly player: Player<any>;

	private readonly container: ContentBlock;

	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>, player: Player<any>) {
		super(parent, 'summary-table-root');
		this.rootElem.classList.add('hide');

		this.simUI = simUI;
		this.player = player;

		this.container = new ContentBlock(this.rootElem, 'summary-table-container', {
			header: { title: i18n.t('gear_tab.upgrade_summary.title') },
			extraCssClasses: ['summary-table--upgrade-costs'],
		});

		TypedEvent.onAny([player.gearChangeEmitter, player.raceChangeEmitter]).on(() => this.updateTable());
	}

	private updateTable() {
		const body = <></>;
		const itemsWithUpgrade = this.player
			.getGear()
			.asArray()
			// Ensure to only pick items that have scaling options
			.filter((item): item is EquippedItem => !!(item?._item.scalingOptions && item.getMaxUpgradeCount() > 0));

		const hasUpgradeItems = !!Object.keys(itemsWithUpgrade).length;
		this.rootElem.classList[!hasUpgradeItems ? 'add' : 'remove']('hide');

		if (hasUpgradeItems) {
			const total = itemsWithUpgrade.reduce<number>(
				(acc, item) => (acc += (COSTS.get(item._item.quality) || 0) * (item.getMaxUpgradeCount() - item.upgrade)),
				0,
			);

			body.appendChild(
				<div className="summary-table-row d-flex align-items-center">
					<div className="d-flex align-items-center">
						<img className="gem-icon" src={'https://wow.zamimg.com/images/wow/icons/small/pvecurrency-justice.jpg'} />
						<div>{i18n.t(`common.currency.justicePoints`)}</div>
					</div>
					<div>{total}</div>
				</div>,
			);

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

								this.player.setGear(TypedEvent.nextEventID(), curGear);
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
						this.player.setGear(TypedEvent.nextEventID(), gear);
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

import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { nextEventID } from '@domain/state/batch';
import { subscribePlayerField } from '@domain/state/subscriptions';
import type { SimHost } from '@features/sim_host';
import { UIGem as Gem } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { ContentBlock } from '@ui-kit/content_block';
import { setItemQualityCssClass } from '@ui-kit/css_utils';
import { ref } from 'tsx-vanilla';

import { trackEvent } from '../../../tracking/utils';
import { setActionIdWowheadHref } from './action_id_dom';
interface GemSummaryData {
	gem: Gem;
	count: number;
}

export class GemSummary extends Component {
	private readonly simUI: SimHost;
	private readonly player: Player<any>;

	private readonly container: ContentBlock;

	constructor(parent: HTMLElement, simUI: SimHost, player: Player<any>) {
		super(parent, 'summary-table-root');
		this.rootElem.classList.add('hide');

		this.simUI = simUI;
		this.player = player;

		this.container = new ContentBlock(this.rootElem, 'summary-table-container', {
			header: { title: i18n.t('gear_tab.gem_summary.title'), extraCssClasses: ['summary-table--gems'] },
			extraCssClasses: ['summary-table--gems'],
		});
		this.addOnDisposeCallback(subscribePlayerField(player, 'gear')(() => this.updateTable()));
	}

	private updateTable() {
		const body = <></>;
		const fullGemList = this.player.getGear().getAllGems(this.player.isBlacksmithing());
		const hasGems = !!fullGemList.length;
		this.rootElem.classList[!hasGems ? 'add' : 'remove']('hide');

		if (hasGems) {
			const gemCounts: Record<string, GemSummaryData> = {};

			for (const gem of fullGemList) {
				if (gemCounts[gem.name]) {
					gemCounts[gem.name].count += 1;
				} else {
					gemCounts[gem.name] = {
						gem: gem,
						count: 1,
					};
				}
			}

			const sortedGemNames = Object.keys(gemCounts).sort((a, b) => a.localeCompare(b));

			for (const gemName of sortedGemNames) {
				const gemData = gemCounts[gemName];
				const linkRef = ref<HTMLAnchorElement>();
				const iconRef = ref<HTMLImageElement>();
				const row = (
					<div className="summary-table-row d-flex align-items-center">
						<a ref={linkRef} className="summary-table-link" data-whtticon="false" target="_blank">
							<img ref={iconRef} className="gem-icon" />
							<div>{gemName}</div>
						</a>
						<div>{gemData.count.toFixed(0)}</div>
					</div>
				);
				body.appendChild(row);

				const itemLinkElem = linkRef.value!;
				const iconElem = iconRef.value!;

				setItemQualityCssClass(itemLinkElem, gemData.gem.quality);

				ActionId.fromItemId(gemData.gem.id)
					.fill()
					.then(filledId => {
						iconElem.src = filledId.iconUrl;
						setActionIdWowheadHref(filledId, itemLinkElem);
					});
			}

			this.container.bodyElement.replaceChildren(body);

			if (!this.container.headerElement) return;
			const existingResetButton = this.container.headerElement.querySelector('.summary-table-reset-button');
			const resetButton = (
				<button
					className="btn btn-sm btn-link btn-reset summary-table-reset-button"
					onclick={() => {
						trackEvent({
							action: 'click',
							category: 'gems',
							label: 'reset',
						});
						this.player.setGear(nextEventID(), this.player.getGear().withoutGems(this.player.canDualWield2H()));
					}}>
					<i className="fas fa-times me-1"></i>
					{i18n.t('gear_tab.gem_summary.reset_gems')}
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

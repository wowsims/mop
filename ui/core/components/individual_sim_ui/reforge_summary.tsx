import { Player } from '../../player.js';
import { Stat } from '../../proto/common.js';
import { IndividualSimSettings } from '../../proto/ui.js';
import { TypedEvent } from '../../typed_event.js';
import { Component } from '../component.js';
import { ContentBlock } from '../content_block.jsx';
import { CopyButton } from '../copy_button';
import { IndividualSimUI } from '../../individual_sim_ui.jsx';
import i18n from '../../../i18n/config';
import { translateStat } from '../../../i18n/localization';
import { trackEvent } from '../../../tracking/utils';

type ReforgeSummaryTotal = {
	[key in Stat]?: number;
};

export class ReforgeSummary extends Component {
	private readonly simUI: IndividualSimUI<any>;
	private readonly player: Player<any>;

	private readonly container: ContentBlock;

	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>, player: Player<any>) {
		super(parent, 'summary-table-root');
		this.rootElem.classList.add('hide');

		this.simUI = simUI;
		this.player = player;

		this.container = new ContentBlock(this.rootElem, 'summary-table-container', {
			header: { title: i18n.t('gear_tab.reforge_summary.title') },
			extraCssClasses: ['summary-table--reforge'],
		});

		player.gearChangeEmitter.on(() => this.updateTable());
	}

	private updateTable() {
		const body = <></>;
		const reforges = this.player.getGear().getAllReforges();
		const totals: ReforgeSummaryTotal = {};

		for (const [_, reforgeData] of reforges) {
			const { fromStat, toStat, fromAmount, toAmount } = reforgeData;

			if (typeof totals[fromStat] !== 'number') {
				totals[fromStat] = 0;
			}
			if (typeof totals[toStat] !== 'number') {
				totals[toStat] = 0;
			}
			if (fromAmount) totals[fromStat]! += fromAmount;
			if (toAmount) totals[toStat]! += toAmount;
		}

		const hasReforgedItems = !!Object.keys(totals).length;
		this.rootElem.classList[!hasReforgedItems ? 'add' : 'remove']('hide');

		if (hasReforgedItems) {
			Object.keys(totals).forEach(key => {
				const stat: Stat = Number(key);
				const value = totals[stat];
				if (!value) return;

				body.appendChild(
					<div className="summary-table-row d-flex align-items-center">
						<div>{translateStat(stat)}</div>
						<div className={`${value === 0 ? '' : value > 0 ? 'positive' : 'negative'}`}>{value}</div>
					</div>,
				);
			});

			// Replace rows in body
			this.container.bodyElement.replaceChildren(body);

			// Add / replace footer action area with copy button
			const existingFooter = this.container.bodyElement.querySelector('.reforge-summary-footer');
			if (existingFooter) existingFooter.remove();

			const footer = <div className="reforge-summary-footer mt-2"></div>;
			const copyContainer = <div className="d-flex w-100 justify-content-end"></div>;
			footer.appendChild(copyContainer);

			new CopyButton(copyContainer as HTMLElement, {
				extraCssClasses: ['btn-outline-primary'],
				getContent: () => {
					trackEvent({
						action: 'click',
						category: 'reforging',
						label: 'copy',
					});
					try {
						// Lazy export so we always capture the most current state, matching optimizer button logic.
						const proto = this.simUI.toProto();
						const jsonObj = proto ? IndividualSimSettings.toJson(proto) : {};
						return JSON.stringify(jsonObj);
					} catch (_e) {
						return '';
					}
				},
				text: i18n.t('gear_tab.reforge_summary.copy_to_reforge_lite'),
			});

			this.container.bodyElement.appendChild(footer);

			if (!this.container.headerElement) return;
			const existingResetButton = this.container.headerElement.querySelector('.summary-table-reset-button');
			const resetButton = (
				<button
					className="btn btn-sm btn-link btn-reset summary-table-reset-button"
					onclick={() => {
						trackEvent({
							action: 'click',
							category: 'reforging',
							label: 'reset',
						});
						const gear = this.player.getGear().withoutReforges(this.player.canDualWield2H());
						this.player.setGear(TypedEvent.nextEventID(), gear);
					}}>
					<i className="fas fa-times me-1"></i>
					{i18n.t('gear_tab.reforge_summary.reset_reforges')}
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

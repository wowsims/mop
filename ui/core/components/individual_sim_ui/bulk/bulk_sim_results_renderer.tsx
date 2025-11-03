import clsx from 'clsx';
import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { TypedEvent } from '../../../typed_event';
import { formatDeltaTextElem, formatToNumber } from '../../../utils';
import { Component } from '../../component';
import { ItemRenderer } from '../../gear_picker/gear_picker';
import Toast from '../../toast';
import { TopGearResult } from '../bulk_tab';
import { RaidSimResultsManager } from '../../raid_sim_action';
import { ItemSlot, ItemSpec } from '../../../proto/common';

export default class BulkSimResultRenderer extends Component {
	readonly simUI: IndividualSimUI<any>;

	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>, result: TopGearResult, baseResult: TopGearResult) {
		super(parent, 'bulk-sim-result-root');

		this.simUI = simUI;

		const iterations = this.simUI.sim.getIterations();
		const isBaseResult = result.gear.equals(baseResult.gear);

		const equipButtonRef = ref<HTMLButtonElement>();
		const dpsDeltaRef = ref<HTMLDivElement>();
		const itemsContainerRef = ref<HTMLDivElement>();
		this.rootElem.appendChild(
			<>
				<div className="results-sim">
					<div className="results-sim-dps damage-metrics">
						<span className="topline-result-avg">{this.formatDps(result.dpsMetrics.avg)}</span>
						<div className="results-reference">
							{isBaseResult ? <span className="fw-bold">{i18n.t('bulk_tab.results.current_gear')}</span> : <span ref={dpsDeltaRef} className="results-reference-diff" />}
						</div>
					</div>
				</div>
				<div ref={itemsContainerRef} className="bulk-gear-combo" />
				<div className="bulk-results-actions">
					<button ref={equipButtonRef} className={clsx('btn btn-primary bulk-equip-btn', isBaseResult && 'd-none')}>
						{i18n.t('bulk_tab.results.equip_button')}
					</button>
				</div>
			</>,
		);

		if (isBaseResult) return;

		if (dpsDeltaRef.value) {
			const isDiff = RaidSimResultsManager.applyZTestTooltip(
				dpsDeltaRef.value,
				iterations,
				result.dpsMetrics.avg,
				result.dpsMetrics.stdev,
				iterations,
				baseResult.dpsMetrics.avg,
				baseResult.dpsMetrics.stdev,
				false,
			);
			formatDeltaTextElem(dpsDeltaRef.value, baseResult.dpsMetrics.avg, result.dpsMetrics.avg, 2, undefined, !isDiff, true);
		}

		equipButtonRef.value?.addEventListener('click', () => {
			simUI.player.setGear(TypedEvent.nextEventID(), result.gear);
			simUI.simHeader.activateTab('gear-tab');
			new Toast({
				variant: 'success',
				body: i18n.t('bulk_tab.results.gear_equipped'),
			});
		});

		const items = (<></>) as HTMLElement;
		const resultAsSpec = result.gear.asSpec();
		const originalEquipmentSpec = baseResult.gear.asSpec();
		for (const [idx, spec] of resultAsSpec.items.entries()) {
			const itemContainer = (<div className="bulk-result-item" />) as HTMLElement;

			if (spec.id != originalEquipmentSpec.items[idx].id) {
				itemContainer.style.border = '3px solid red';
			} else {
				itemContainer.style.border = '3px solid transparent';
			}

			const renderer = new ItemRenderer(items, itemContainer, simUI.player);

			var shouldRenderItem: boolean;

			if (spec.id == 0) {
				shouldRenderItem = false;
			} else if (!ItemSpec.equals(spec, originalEquipmentSpec.items[idx])) {
				shouldRenderItem = true;
			} else if ([ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotTrinket1].includes(idx) && !ItemSpec.equals(resultAsSpec.items[idx + 1], originalEquipmentSpec.items[idx + 1])) {
				shouldRenderItem = true;
			} else if ([ItemSlot.ItemSlotFinger2, ItemSlot.ItemSlotTrinket2].includes(idx) && !ItemSpec.equals(resultAsSpec.items[idx - 1], originalEquipmentSpec.items[idx - 1])) {
				shouldRenderItem = true;
			} else {
				shouldRenderItem = false;
			}

			if (shouldRenderItem) {
				const item = simUI.sim.db.lookupItemSpec(spec);
				renderer.update(item!);
			} else {
				renderer.clear(idx);
			}
			items.appendChild(itemContainer);
		}
		itemsContainerRef.value!.appendChild(items);
	}

	private formatDps(dps: number): string {
		return formatToNumber(dps);
	}
}

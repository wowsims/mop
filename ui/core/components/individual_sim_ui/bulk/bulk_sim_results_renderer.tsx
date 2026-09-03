import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { ItemSlot, ItemSpec } from '../../../proto/common';
import { TypedEvent } from '../../../typed_event';
import { formatDeltaTextElem, formatToNumber, stDevToConf95 } from '../../../utils';
import { Component } from '../../component';
import { buildGearChangeIcon } from '../../gear_change_icon';
import { ItemRenderer } from '../../gear_picker/item_renderer';
import { SimResultsManager } from '../../sim_action';
import Toast from '../../toast';
import { TopGearResult } from './types';
import { BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS, getBulkItemSlotFromSlot, getBulkPlayerCanDualWield } from './utils';

const getSwappableItemSlotPair = (slot: number, canDualWield: boolean): [ItemSlot, ItemSlot] | undefined =>
	BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(getBulkItemSlotFromSlot(slot, canDualWield));

const itemSpecPairsEqualUnordered = (resultItems: ItemSpec[], originalItems: ItemSpec[], [slot1, slot2]: [ItemSlot, ItemSlot]): boolean =>
	(ItemSpec.equals(resultItems[slot1], originalItems[slot1]) && ItemSpec.equals(resultItems[slot2], originalItems[slot2])) ||
	(ItemSpec.equals(resultItems[slot1], originalItems[slot2]) && ItemSpec.equals(resultItems[slot2], originalItems[slot1]));

export default class BulkSimResultRenderer extends Component {
	readonly simUI: IndividualSimUI<any>;

	constructor(parent: HTMLElement | DocumentFragment, simUI: IndividualSimUI<any>, result: TopGearResult, baseResult: TopGearResult) {
		super(parent, 'bulk-sim-result-root');

		this.simUI = simUI;

		const iterations = Math.max(1, this.simUI.sim.getIterations());
		// Displayed per-row uncertainty (95% CI of the mean). Deliberately the UNPAIRED error:
		// it describes this row's own mean; tie grouping uses the much tighter paired error of
		// the difference between rows - both are correct, they answer different questions.
		const plusMinusDps = stDevToConf95(result.dpsMetrics.stdev, iterations);
		const isBaseResult = result.gear.equals(baseResult.gear);

		const equipButtonRef = ref<HTMLButtonElement>();
		const dpsDeltaRef = ref<HTMLDivElement>();
		const itemsContainerRef = ref<HTMLDivElement>();
		const marginRef = ref<HTMLSpanElement>();
		this.rootElem.appendChild(
			<>
				<div className="results-sim">
					<div className="results-sim-dps damage-metrics">
						<span className="topline-result-avg">{this.formatDps(result.dpsMetrics.avg)}</span>
						{plusMinusDps > 0 && (
							<span ref={marginRef} className="text-muted small">
								{' ±' + formatToNumber(plusMinusDps, { maximumFractionDigits: 0 })}
							</span>
						)}
						<div className="results-reference">
							{isBaseResult ? (
								<span className="fw-bold">{i18n.t('bulk_tab.results.current_gear')}</span>
							) : (
								<span ref={dpsDeltaRef} className="results-reference-diff" />
							)}
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

		if (marginRef.value) {
			tippy(marginRef.value, { content: i18n.t('bulk_tab.results.margin_of_error') });
		}

		if (isBaseResult) return;

		if (dpsDeltaRef.value) {
			const isDiff = SimResultsManager.applyZTestTooltip(
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
		const canDualWield = getBulkPlayerCanDualWield(simUI.player);
		const resultAsSpec = result.gear.asSpec();
		const originalEquipmentSpec = baseResult.gear.asSpec();
		for (const [idx, spec] of resultAsSpec.items.entries()) {
			const itemContainer = (<div className="bulk-result-item" />) as HTMLElement;
			const swappableItemSlotPair = getSwappableItemSlotPair(idx, canDualWield);
			const itemChanged = swappableItemSlotPair
				? !itemSpecPairsEqualUnordered(resultAsSpec.items, originalEquipmentSpec.items, swappableItemSlotPair)
				: !ItemSpec.equals(spec, originalEquipmentSpec.items[idx]);

			// Three display states per slot:
			// 1. Unchanged -  slots stay empty
			// 2. Same - Item with a different reforge/gems shows the compact change icon (reforge + socket markers);
			// 3. New - The item appearing at all already says the slot changed.
			const isSameItemModified = itemChanged && spec.id !== 0 && spec.id === originalEquipmentSpec.items[idx]?.id;

			if (isSameItemModified) {
				itemContainer.appendChild(
					buildGearChangeIcon(simUI.player, idx, simUI.sim.db.lookupItemSpec(spec) ?? undefined, baseResult.gear.getEquippedItem(idx) ?? undefined),
				);
				items.appendChild(itemContainer);
				continue;
			}

			const renderer = new ItemRenderer(items, itemContainer, simUI.player, { slot: idx });
			renderer.render(itemChanged && spec.id !== 0 ? simUI.sim.db.lookupItemSpec(spec) : null);
			items.appendChild(itemContainer);
		}
		itemsContainerRef.value!.appendChild(items);
	}

	private formatDps(dps: number): string {
		return formatToNumber(dps);
	}
}

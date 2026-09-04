import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import { ResourceType } from '../../../proto/spell';
import { ActionId, buffAuraToSpellIdMap, resourceTypeToIcon } from '../../../proto_utils/action_id';
import { AuraUptimeLog, CastLog, ResourceChangedLogGroup } from '../../../proto_utils/logs_parser';
import { resourceNames } from '../../../proto_utils/names';
import SecondaryResource from '../../../proto_utils/secondary_resource';
import { UnitMetrics } from '../../../proto_utils/sim_result';
import { orderedResourceTypes } from '../../../proto_utils/utils';
import { TypedEvent } from '../../../typed_event';
import { bucket, stringComparator } from '../../../utils';
import { ResultComponent, SimResultData } from '../result_component';
import { multiPlayerChartSpec, singlePlayerChartSpec } from './chart/build';
import { TimelineChart } from './chart/timeline_chart';
import { ChartViewPicker } from './chart_view_picker';
import {
	auraAsResource,
	cachedSpellCastIcon,
	DEFAULT_ACTION_CATEGORY,
	idsToGroupForRotation,
	idToCategoryMap,
	MELEE_ACTION_CATEGORY,
	percentageResources,
	ROW_WINDOW_PADDING_PX,
	SPELL_ACTION_CATEGORY,
} from './constants';
import { resourceTooltip } from './tooltip_content';
import { addTooltip, delegateTooltips } from './tooltips';
import { RotationSlot, TimelineConfig } from './types';
import { WindowedRow } from './windowed_row';

export class Timeline extends ResultComponent {
	private readonly dpsResourcesPlotElem: HTMLElement;
	private readonly chart: TimelineChart;

	private readonly rotationPlotElem: HTMLElement;
	private readonly rotationLabels: HTMLElement;
	private readonly rotationTimeline: HTMLElement;
	private readonly rotationHiddenIdsContainer: HTMLElement;
	// Rebuilt with the rotation subtree, so it is captured where it is created.
	private rotationCanvas: HTMLCanvasElement | null = null;
	private readonly chartPicker: ChartViewPicker;

	private resultData: SimResultData | null;
	// A rendered rotation timeline for one (result, filter, chart) key. The DOM
	// nodes are kept LIVE (moved in and out of the containers, never cloned) so
	// their tippy instances, click handlers and emitter subscriptions survive a
	// switch between the current result and a saved reference. Eviction runs the
	// slot's reset callbacks (tooltip destroy, listener removal).
	private liveSlot: RotationSlot | null = null;
	// The most recently stashed slot. One is enough for the current <-> reference
	// swap, and each parked slot keeps its full tippy instance set alive.
	private parkedSlot: RotationSlot | null = null;

	// Hidden rows are keyed by section (player '', pet name, target label) plus
	// action, so ids shared across sections (e.g. main-hand Attack) hide independently.
	private hiddenIds: Array<{ scope: string; actionId: ActionId }>;

	private rowWindowFrame: number | null = null;

	private secondaryResource?: SecondaryResource | null;

	constructor(config: TimelineConfig) {
		config.rootCssClass = 'timeline-root';
		super(config);
		this.resultData = null;
		this.hiddenIds = [];
		this.addOnDisposeCallback(() => {
			if (this.rowWindowFrame != null) cancelAnimationFrame(this.rowWindowFrame);
			this.chart.dispose();
			this.reset();
		});
		this.secondaryResource = config.secondaryResource;

		const chartPickerRef = ref<HTMLDivElement>();
		const chartViewRefs = (['rotation', 'dps', 'threat'] as const).map(value => ({
			value,
			input: ref<HTMLInputElement>(),
			label: ref<HTMLLabelElement>(),
		}));
		const chartViewLabels: Record<string, string> = {
			rotation: i18n.t('results_tab.details.timeline.chart_types.rotation'),
			dps: i18n.t('results_tab.details.timeline.chart_types.dps'),
			threat: i18n.t('results_tab.details.timeline.chart_types.threat'),
		};

		this.rootElem.appendChild(
			<div className="timeline-disclaimer">
				<div className="d-flex flex-column">
					<p>
						<i className="warning fa fa-exclamation-triangle fa-xl me-2"></i>
						{i18n.t('results_tab.details.timeline.disclaimer')}
					</p>
					<p>{i18n.t('results_tab.details.timeline.note')}</p>
				</div>
				{/* Two of the three are ever offered at once - rotation and threat swap depending
				    on whether the result has one player - so a radio group reads better than a
				    dropdown for what is always a two-way choice. */}
				<div ref={chartPickerRef} className="timeline-chart-picker btn-group" attributes={{ role: 'group' }}>
					{chartViewRefs.map(({ value, input, label }) => (
						<>
							<input
								ref={input}
								type="radio"
								className={`btn-check ${value}-option`}
								name="timeline-chart-view"
								id={`timeline-chart-view-${value}`}
								value={value}
								autocomplete="off"
								checked={value === 'rotation'}
							/>
							<label ref={label} className={`btn btn-sm btn-outline-primary ${value}-option`} htmlFor={`timeline-chart-view-${value}`}>
								{chartViewLabels[value]}
							</label>
						</>
					))}
				</div>
			</div>,
		);

		const dpsResourcesPlotRef = ref<HTMLDivElement>();
		const rotationPlotRef = ref<HTMLDivElement>();
		const rotationLabelsRef = ref<HTMLDivElement>();
		const rotationTimelineRef = ref<HTMLDivElement>();
		const rotationHiddenIdsRef = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<div className="timeline-plots-container">
				<div ref={dpsResourcesPlotRef} className="timeline-plot dps-resources-plot hide"></div>
				<div ref={rotationPlotRef} className="timeline-plot rotation-plot">
					<div className="rotation-container">
						<div ref={rotationLabelsRef} className="rotation-labels"></div>
						<div ref={rotationTimelineRef} className="rotation-timeline" draggable={true}></div>
					</div>
					<div ref={rotationHiddenIdsRef} className="rotation-hidden-ids"></div>
				</div>
			</div>,
		);

		this.chartPicker = new ChartViewPicker(
			chartPickerRef.value!,
			chartViewRefs.map(({ value, input, label }) => ({ value, input: input.value!, elems: [input.value!, label.value!] })),
		);
		this.chartPicker.onChange(() => this.onChartPickerSelectHandler());

		this.dpsResourcesPlotElem = dpsResourcesPlotRef.value!;
		this.chart = new TimelineChart(this.dpsResourcesPlotElem);

		this.rotationPlotElem = rotationPlotRef.value!;
		this.rotationLabels = rotationLabelsRef.value!;
		this.rotationTimeline = rotationTimelineRef.value!;
		this.rotationHiddenIdsContainer = rotationHiddenIdsRef.value!;

		let isMouseDown = false;
		let startX = 0;
		this.rotationTimeline.addEventListener('scroll', () => this.scheduleRowWindow(), { passive: true });

		if (typeof ResizeObserver !== 'undefined') {
			const observer = new ResizeObserver(() => this.scheduleRowWindow());
			observer.observe(this.rotationTimeline);
			this.addOnDisposeCallback(() => observer.disconnect());
		}

		let scrollLeft = 0;
		this.rotationTimeline.addEventListener('dragstart', event => {
			event.preventDefault();
		});
		this.rotationTimeline.addEventListener('mousedown', event => {
			isMouseDown = true;
			startX = event.pageX - this.rotationTimeline.offsetLeft;
			scrollLeft = this.rotationTimeline.scrollLeft;
		});
		this.rotationTimeline.addEventListener('mouseleave', () => {
			isMouseDown = false;
			this.rotationTimeline.classList.remove('active');
		});
		this.rotationTimeline.addEventListener('mouseup', () => {
			isMouseDown = false;
			this.rotationTimeline.classList.remove('active');
		});
		this.rotationTimeline.addEventListener('mousemove', event => {
			if (!isMouseDown) return;
			event.preventDefault();
			const x = event.pageX - this.rotationTimeline.offsetLeft;
			const walk = (x - startX) * 3; //scroll-fast
			this.rotationTimeline.scrollLeft = scrollLeft - walk;
		});
	}

	// Pane visibility only. Split out from the change handler so updatePlot's programmatic
	// switch to 'dps' does not re-enter updatePlot through it.
	private syncChartPanes() {
		const showRotation = this.chartPicker.value === 'rotation';
		this.dpsResourcesPlotElem.classList.toggle('hide', showRotation);
		this.rotationPlotElem.classList.toggle('hide', !showRotation);
		this.chart.setVisible(!showRotation);
	}

	onChartPickerSelectHandler() {
		this.syncChartPanes();
		// Series are not built while the chart is hidden, so build them now. updatePlot is
		// keyed and cached, so this is a no-op if they are already current.
		if (this.isChartVisible()) this.update();
	}

	// The rotation view and the chart are alternatives, and the rotation is the default for a
	// single player. Building the chart's series while it is hidden costs a pass over the
	// unit's dps logs, mana group and threat logs - and forces those lazy derives to
	// materialise - for something nobody is looking at.
	private isChartVisible(): boolean {
		return this.chartPicker.value !== 'rotation';
	}

	onSimResult(resultData: SimResultData) {
		this.resultData = resultData;
		this.update();
	}

	private updatePlot() {
		if (this.resultData == null) {
			return;
		}

		const players = this.resultData.result.getRaidIndexedPlayers(this.resultData.filter);
		const singlePlayer = players.length == 1;
		if (!singlePlayer && this.chartPicker.value == 'rotation') {
			// Programmatic select changes fire no 'change' event: sync the plot containers by hand.
			this.chartPicker.value = 'dps';
			this.syncChartPanes();
		}

		// Fast path: this result was rendered before and its slot is either live
		// or parked in the cache.
		const key = this.resultKey(!singlePlayer);
		const hit = this.liveSlot?.key === key ? this.liveSlot : this.parkedSlot?.key === key ? this.parkedSlot : null;
		if (hit?.chartSpec) {
			if (hit !== this.liveSlot) {
				this.parkedSlot = null;
				this.stashLiveSlot();
				this.attachSlot(hit);
			}
			this.setRotationOptionVisible(singlePlayer);
			this.chart.render(hit.chartSpec);
			return;
		}

		const duration = this.resultData!.result.result.firstIterationDuration || 1;
		let spec;

		if (singlePlayer) {
			const player = players[0];

			this.setRotationOptionVisible(true);

			try {
				this.updateRotationChart(player, duration);
			} catch (e) {
				console.log('Failed to update rotation chart: ', e);
			}

			if (!this.isChartVisible()) {
				// Nothing else to do: the rotation is what is on screen.
				return;
			}

			spec = singlePlayerChartSpec(player, duration, this.secondaryResource);
		} else {
			this.setRotationOptionVisible(false);

			this.stashLiveSlot();
			this.clearRotationChart();
			// No rotation subtree, but the (expensive) per-player series are worth caching for swaps.
			this.liveSlot = Timeline.newSlot(key);

			spec = multiPlayerChartSpec(players, duration, this.chartPicker.value == 'dps' ? 'dps' : 'threat');
		}

		if (this.liveSlot?.key === key) this.liveSlot.chartSpec = spec;
		this.chart.render(spec);
	}

	private clearRotationChart() {
		this.rotationLabels.replaceChildren(<div className="rotation-label-header"></div>);
		this.rotationTimeline.replaceChildren(
			<div className="rotation-timeline-header">
				<canvas ref={elem => (this.rotationCanvas = elem)} className="rotation-timeline-canvas" />
			</div>,
		);
		this.rotationHiddenIdsContainer.replaceChildren();
	}

	private updateRotationChart(player: UnitMetrics, duration: number) {
		const targets = this.resultData!.result.getTargets(this.resultData!.filter);
		if (targets.length == 0) {
			return;
		}

		const key = this.resultKey();
		if (this.liveSlot?.key === key) {
			return;
		}
		// Take before stashing so the stash can't evict the slot we want.
		const parked = this.takeParkedSlot(key);
		this.stashLiveSlot();
		if (parked) {
			this.attachSlot(parked);
			return;
		}
		this.liveSlot = Timeline.newSlot(key);
		this.clearRotationChart();

		try {
			this.drawRotationTimeRuler(this.rotationCanvas!, duration);
		} catch (e) {
			console.log('Failed to draw rotation: ', e);
		}

		orderedResourceTypes.forEach(resourceType => this.addResourceRow(resourceType, player.groupedResourceLogs[resourceType], duration));

		const buffsById = Object.values(bucket(player.auraUptimeLogs, log => log.actionId!.toString()));
		buffsById.sort((a, b) => stringComparator(a[0].actionId!.name, b[0].actionId!.name));
		const debuffsByTargetById = targets.map(target =>
			Object.values(bucket(target.auraUptimeLogs, log => log.actionId!.toString())).sort((a, b) =>
				stringComparator(a[0].actionId!.name, b[0].actionId!.name),
			),
		);

		const buffsAndDebuffsById = buffsById.concat(
			// Only pick target 0 to prevent overlapping cast rows
			debuffsByTargetById[0],
		);

		auraAsResource.forEach(actionId => {
			const auraIndex = buffsById.findIndex(auraUptimeLogs => auraUptimeLogs?.[0].actionId!.equals(actionId));
			if (auraIndex !== -1) {
				this.addAuraRow(buffsById[auraIndex], duration);
			}
		});

		const playerCastsByAbility = this.getSortedCastsByAbility(player);
		playerCastsByAbility.forEach(castLogs => this.addCastRow(castLogs, buffsAndDebuffsById, duration));

		if (player.pets.length > 0) {
			// Keep the casts from the first pass rather than sorting each pet's twice - the
			// first pass only needed to know whether the list was empty. Demonology fields 27
			// pets, so that was 54 bucket-and-sort passes.
			const playerPets = new Map<string, { pet: UnitMetrics; castsByAbility: Array<Array<CastLog>> }>();
			player.pets.forEach(petsLog => {
				const petCastsByAbility = this.getSortedCastsByAbility(petsLog);
				if (petCastsByAbility.length > 0) {
					// Because multiple pets can have the same name and we parse cast logs
					// by pet name each individual pet ends up with all the casts of pets
					// with the same name. Because of this we can just grab the first pet
					// of each name and visualize only that.
					if (!playerPets.has(petsLog.name)) {
						playerPets.set(petsLog.name, { pet: petsLog, castsByAbility: petCastsByAbility });
					}
				}
			});

			playerPets.forEach(({ pet, castsByAbility }) => {
				this.addSeparatorRow(duration);
				this.addPetRow(pet.name, duration);
				orderedResourceTypes.forEach(resourceType => this.addResourceRow(resourceType, pet.groupedResourceLogs[resourceType], duration));
				castsByAbility.forEach(castLogs => this.addCastRow(castLogs, buffsAndDebuffsById, duration, pet.name));
			});
		}

		// Don't add a row for buffs that were already visualized in a cast row or are prioritized.
		const buffsToShow = buffsById.filter(
			auraUptimeLogs =>
				!playerCastsByAbility.some(casts => {
					const actionId = auraUptimeLogs[0].actionId;
					return actionId && (casts[0].actionId!.equalsIgnoringTag(actionId) || auraAsResource.find(auraId => auraId.equals(actionId)));
				}),
		);
		if (buffsToShow.length > 0) {
			this.addSeparatorRow(duration);
			buffsToShow.forEach(auraUptimeLogs => this.addAuraRow(auraUptimeLogs, duration));
		}

		targets.forEach(target => {
			const targetCastsByAbility = this.getSortedCastsByAbility(target);
			if (targetCastsByAbility.length > 0) {
				this.addSeparatorRow(duration);
				this.addTargetRow(target.label, duration);
				targetCastsByAbility.forEach(castLogs => this.addCastRow(castLogs, buffsAndDebuffsById, duration, target.label));
			}
		});

		// Add a row for all debuffs, even those which have already been visualized in a cast row.
		debuffsByTargetById.forEach((debuffsToShow, index) => {
			if (debuffsToShow.length > 0) {
				this.addSeparatorRow(duration);
				this.addTargetRow(targets?.[index]?.label, duration);
				debuffsToShow.forEach(auraUptimeLogs => this.addAuraRow(auraUptimeLogs, duration, targets?.[index]?.label ?? ''));
			}
		});

		// Rows are registered empty; this fills whatever the viewport currently covers.
		this.applyRowWindow();
	}

	private getSortedCastsByAbility(player: UnitMetrics): Array<Array<CastLog>> {
		// Sets, so the two linear scans the sort comparator used to run per comparison become
		// lookups.
		const meleeActionKeys = new Set(player.getMeleeActions().map(action => action.actionId.equalityKey()));
		const spellActionKeys = new Set(player.getSpellActions().map(action => action.actionId.equalityKey()));
		const getActionCategory = (actionId: ActionId): number => {
			const fixedCategory = idToCategoryMap[actionId.anyId()];
			if (fixedCategory != null) return fixedCategory;
			const key = actionId.equalityKey();
			if (meleeActionKeys.has(key)) return MELEE_ACTION_CATEGORY;
			if (spellActionKeys.has(key)) return SPELL_ACTION_CATEGORY;
			return DEFAULT_ACTION_CATEGORY;
		};

		const castsByAbility = Object.values(
			bucket(player.castLogs, log => {
				if (idsToGroupForRotation.includes(log.actionId!.spellId)) {
					return log.actionId!.toStringIgnoringTag();
				} else {
					return log.actionId!.toString();
				}
			}),
		);

		// Category once per bucket rather than once per comparison.
		const categories = new Map<Array<CastLog>, number>();
		castsByAbility.forEach(casts => categories.set(casts, getActionCategory(casts[0].actionId!)));

		castsByAbility.sort((a, b) => {
			const categoryA = categories.get(a)!;
			const categoryB = categories.get(b)!;
			if (categoryA != categoryB) {
				return categoryA - categoryB;
			} else if (a[0].actionId!.anyId() == b[0].actionId!.anyId()) {
				return a[0].actionId!.tag - b[0].actionId!.tag;
			} else {
				return stringComparator(a[0].actionId!.name, b[0].actionId!.name);
			}
		});

		return castsByAbility;
	}

	private hiddenIndex(scope: string, actionId: ActionId): number {
		return this.hiddenIds.findIndex(hidden => hidden.scope === scope && hidden.actionId.equals(actionId));
	}

	private makeLabelElem(actionId: ActionId, isHiddenLabel: boolean, isAura: boolean, scope: string): JSX.Element {
		const baseText = idsToGroupForRotation.includes(actionId.spellId) ? actionId.baseName : actionId.name;
		// Hidden chips for pet/target rows name their section so two "Attack" chips are telling apart.
		const labelText = isHiddenLabel && scope ? `${baseText} (${scope})` : baseText;
		const labelIcon = ref<HTMLAnchorElement>();
		const hideElem = ref<HTMLElement>();
		const labelElem = (
			<div className={clsx('rotation-label rotation-row', isHiddenLabel && 'rotation-label-hidden')}>
				<span ref={hideElem} className={clsx('fas', isHiddenLabel ? 'fa-eye' : 'fa-eye-slash')}></span>
				<a ref={labelIcon} className="rotation-label-icon"></a>
				<span className="rotation-label-text">{labelText}</span>
			</div>
		);
		// The whole hidden chip un-hides; on the visible label only the eye hides.
		const clickTarget = isHiddenLabel ? labelElem : hideElem.value!;
		const onClickHandler = (event: Event) => {
			// The spell icon keeps its own link + Wowhead tooltip.
			if (isHiddenLabel && (event.target as Element).closest('.rotation-label-icon')) return;
			if (isHiddenLabel) {
				const index = this.hiddenIndex(scope, actionId);
				if (index != -1) {
					this.hiddenIds.splice(index, 1);
				}
			} else {
				this.hiddenIds.push({ scope, actionId });
			}
			this.liveSlot?.emitter.emit(TypedEvent.nextEventID());
		};
		clickTarget.addEventListener('click', onClickHandler);
		const tooltip = tippy(hideElem.value!, {
			theme: 'timeline-tooltip',
			placement: 'auto-end',
			content: isHiddenLabel ? 'Show Row' : 'Hide Row',
		});

		const updateHidden = () => {
			if (isHiddenLabel == (this.hiddenIndex(scope, actionId) != -1)) {
				labelElem.classList.remove('hide');
			} else {
				labelElem.classList.add('hide');
			}
		};
		const event = this.liveSlot!.emitter.on(updateHidden);
		updateHidden();
		actionId.setBackgroundAndHref(labelIcon.value!);
		actionId.setWowheadDataset(labelIcon.value!, { useBuffAura: isAura });

		this.addOnResetCallback(() => {
			clickTarget.removeEventListener('click', onClickHandler);
			tooltip.destroy();
			event.dispose();
		});

		return labelElem;
	}

	// A timeline row that is never hidden (section headers: pet name, target name).
	// Rows built through here have their items mounted and unmounted by the horizontal
	// window; call it for any row that positions children along the time axis.
	private makeWindowedRow(rowElem: Element): WindowedRow {
		const windowed = new WindowedRow(rowElem);
		this.liveSlot!.windowedRows.push(windowed);
		// Rows that position content along the time axis are exactly the rows that hold
		// tooltip targets; separator, pet-name and target-name rows hold neither.
		const delegated = delegateTooltips(rowElem);
		this.addOnResetCallback(() => delegated.destroy());
		return windowed;
	}

	private scheduleRowWindow() {
		if (this.rowWindowFrame != null) return;
		this.rowWindowFrame = requestAnimationFrame(() => {
			this.rowWindowFrame = null;
			this.applyRowWindow();
		});
	}

	private applyRowWindow() {
		const rows = this.liveSlot?.windowedRows;
		if (!rows?.length) return;

		const width = this.rotationTimeline.clientWidth;
		if (!width) return;
		const left = this.rotationTimeline.scrollLeft - ROW_WINDOW_PADDING_PX;
		const right = this.rotationTimeline.scrollLeft + width + ROW_WINDOW_PADDING_PX;
		for (const row of rows) row.mount(left, right);
	}

	private makePlainRowElem(duration: number): JSX.Element {
		return (
			<div
				className="rotation-timeline-row rotation-row"
				style={{
					width: this.timeToPx(duration),
				}}></div>
		);
	}

	private makeRowElem(actionId: ActionId, duration: number, scope: string): JSX.Element {
		const rowElem = this.makePlainRowElem(duration);

		const updateHidden = () => {
			if (this.hiddenIndex(scope, actionId) != -1) {
				rowElem.classList.add('hide');
			} else {
				rowElem.classList.remove('hide');
			}
		};
		const event = this.liveSlot!.emitter.on(updateHidden);
		updateHidden();
		this.addOnResetCallback(() => event.dispose());
		return rowElem;
	}

	private addPetRow(petName: string, duration: number) {
		const actionId = ActionId.fromPetName(petName);
		// Header row: must not follow hiddenIds. fromPetName resolves to the summon
		// spell's id, so hiding e.g. the "Dire Beast" cast row used to hide this
		// row but not its label, shifting every row below it.
		const rowElem = this.makePlainRowElem(duration);

		const iconElem = document.createElement('div');
		this.rotationLabels.appendChild(iconElem);

		actionId.fill().then(filledActionId => {
			const labelText = idsToGroupForRotation.includes(filledActionId.spellId) ? filledActionId.baseName : filledActionId.name;
			const labelIcon = ref<HTMLAnchorElement>();
			const labelElem = (
				<div className="rotation-label rotation-row">
					<a ref={labelIcon} className="rotation-label-icon"></a>
					<span className="rotation-label-text">{labelText}</span>
				</div>
			);
			filledActionId.setBackgroundAndHref(labelIcon.value!);
			iconElem.appendChild(labelElem);
		});

		this.rotationTimeline.appendChild(rowElem);
	}

	private addTargetRow(targetName: string, duration: number) {
		const rowElem = this.makePlainRowElem(duration);
		this.rotationLabels.appendChild(
			<div>
				<div className="rotation-label rotation-row">
					<span className="rotation-label-text">{targetName}</span>
				</div>
			</div>,
		);
		this.rotationTimeline.appendChild(rowElem);
	}

	private addSeparatorRow(duration: number) {
		const separatorElem = <div className="rotation-timeline-separator"></div>;
		this.rotationLabels.appendChild(separatorElem.cloneNode());
		separatorElem.style.width = this.timeToPx(duration);
		this.rotationTimeline.appendChild(separatorElem);
	}

	private addResourceRow(resourceType: ResourceType, resourceLogs: Array<ResourceChangedLogGroup>, duration: number) {
		if (resourceLogs.length == 0) {
			return;
		}
		const startValue = function (group: ResourceChangedLogGroup): number {
			if (group.maxValue == null) {
				return resourceLogs[0].valueBefore;
			}

			return group.maxValue;
		};

		let resourceName = resourceNames.get(resourceType);
		let resourceIcon = resourceTypeToIcon[resourceType];
		if (resourceType == ResourceType.ResourceTypeGenericResource && !!this.secondaryResource) {
			resourceName = this.secondaryResource.name;
			resourceIcon = this.secondaryResource.icon || '';
		}

		const labelElem = (
			<div className="rotation-label rotation-row">
				<a
					className="rotation-label-icon"
					style={{
						backgroundImage: `url('${resourceIcon}')`,
					}}></a>
				<span className="rotation-label-text">{resourceName}</span>
			</div>
		);

		this.rotationLabels.appendChild(labelElem);

		const rowElem = this.makePlainRowElem(duration);
		const windowed = this.makeWindowedRow(rowElem);

		const cNames = resourceNames.get(resourceType)!.toLowerCase().replaceAll(' ', '-');
		resourceLogs.forEach((resourceLogGroup, i) => {
			const left = this.timeToPxValue(resourceLogGroup.timestamp);
			const width = this.timeToPxValue((resourceLogs[i + 1]?.timestamp || duration) - resourceLogGroup.timestamp);
			windowed.add(left, width, () => {
				const resourceElem = (
					<div
						className={`rotation-timeline-resource series-color ${cNames}`}
						style={{
							left: `${left}px`,
							width: `${width}px`,
						}}></div>
				);

				if (percentageResources.includes(resourceType)) {
					resourceElem.textContent = ((resourceLogGroup.valueAfter / startValue(resourceLogGroup)) * 100).toFixed(0) + '%';
				} else {
					if (
						resourceType == ResourceType.ResourceTypeEnergy ||
						resourceType == ResourceType.ResourceTypeFocus ||
						resourceType == ResourceType.ResourceTypeSolarEnergy ||
						resourceType == ResourceType.ResourceTypeLunarEnergy
					) {
						const bgElem = document.createElement('div');
						bgElem.classList.add('rotation-timeline-resource-fill');
						bgElem.classList.add(cNames);
						bgElem.style.height = ((resourceLogGroup.valueAfter / startValue(resourceLogGroup)) * 100).toFixed(0) + '%';
						resourceElem.appendChild(bgElem);
					} else {
						resourceElem.textContent = Math.floor(resourceLogGroup.valueAfter).toFixed(0);
					}
				}
				addTooltip(resourceElem, () => resourceTooltip(resourceLogGroup, startValue(resourceLogGroup), false));
				return resourceElem;
			});
		});
		this.rotationTimeline.appendChild(rowElem);
	}

	private addCastRow(castLogs: Array<CastLog>, aurasById: Array<Array<AuraUptimeLog>>, duration: number, scope = '') {
		const actionId = castLogs[0].actionId!;

		this.rotationLabels.appendChild(this.makeLabelElem(actionId, false, false, scope));
		this.rotationHiddenIdsContainer.appendChild(this.makeLabelElem(actionId, true, false, scope));

		const rowElem = this.makeRowElem(actionId, duration, scope);
		const windowed = this.makeWindowedRow(rowElem);
		// Invariant for the row; it was recomputed inside every cast's build closure.
		const actionIdAsString = actionId.toString();
		castLogs.forEach(castLog => {
			const castLeft = this.timeToPxValue(castLog.timestamp);
			const castWidth = this.timeToPxValue(castLog.cancelTime || castLog.castTime + castLog.travelTime);
			windowed.add(castLeft, castWidth, () => {
				const castElem = (
					<div
						className="rotation-timeline-cast"
						style={{
							left: `${castLeft}px`,
							minWidth: `${castWidth}px`,
						}}
					/>
				);

				if (castLog.cancelTime) {
					castElem.classList.add('cast-cancelled');
				} else if (castLog.travelTime != 0) {
					const travelTimeElem = (
						<div
							className="rotation-timeline-travel-time"
							style={{
								left: this.timeToPx(castLog.castTime),
								minWidth: this.timeToPx(castLog.travelTime),
							}}
						/>
					);
					castElem.appendChild(travelTimeElem);
				}

				if (castLog.damageDealtLogs.length > 0) {
					const ddl = castLog.damageDealtLogs[0];
					if (ddl.miss || ddl.dodge || ddl.parry) {
						castElem.classList.add('outcome-miss');
					} else if (ddl.glance || ddl.block || ddl.partialResist1_4 || ddl.partialResist2_4 || ddl.partialResist3_4) {
						castElem.classList.add('outcome-partial');
					} else if (ddl.crit) {
						castElem.classList.add('outcome-crit');
					} else {
						castElem.classList.add('outcome-hit');
					}
				}

				const cachedIconElem = cachedSpellCastIcon.get(actionIdAsString)?.cloneNode() as HTMLAnchorElement | undefined;
				let iconElem = cachedIconElem;
				if (!iconElem) {
					iconElem = (<a className="rotation-timeline-cast-icon" />) as HTMLAnchorElement;
					actionId.setBackground(iconElem);
					cachedSpellCastIcon.set(actionIdAsString, iconElem);
				}
				castElem.appendChild(iconElem);

				const travelTimeStr = castLog.travelTime == 0 ? '' : ` + ${castLog.travelTime.toFixed(2)}s travel time`;
				const totalDamage = castLog.totalDamage();

				const buildCastTooltip = () => (
					<div className="timeline-tooltip">
						<span>
							{castLog.actionId!.name} from {castLog.timestamp.toFixed(2)}s to{' '}
							{(castLog.castCancelledLog?.timestamp || castLog.timestamp + castLog.castTime).toFixed(2)}s
							{castLog.castCancelledLog?.timestamp
								? ` (Cancelled after ${castLog.cancelTime.toFixed(2)}s)`
								: ` (${castLog.castTime > 0 ? `${castLog.castTime.toFixed(2)}s, ` : ''}${castLog.effectiveTime.toFixed(2)}s GCD Time)`}
							{travelTimeStr.length > 0 && travelTimeStr}
						</span>
						{totalDamage > 0 && (
							<span>
								Total: {totalDamage.toFixed(2)} ({(totalDamage / (castLog.effectiveTime || 1)).toFixed(2)} DPET)
							</span>
						)}
						{castLog.damageDealtLogs.length > 0 && (
							<ul className="rotation-timeline-cast-damage-list">
								{castLog.damageDealtLogs.map(ddl => (
									<li>
										<span>
											{ddl.timestamp.toFixed(2)}s - {ddl.result()}
										</span>
										{ddl.source?.isTarget && (
											<span className="threat-metrics">
												{' '}
												({ddl.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
											</span>
										)}
									</li>
								))}
							</ul>
						)}
					</div>
				);

				addTooltip(castElem, buildCastTooltip);
				return castElem;
			});

			castLog.damageDealtLogs
				.filter(ddl => ddl.tick)
				.forEach(ddl => {
					const tickLeft = this.timeToPxValue(ddl.timestamp);
					windowed.add(tickLeft, 0, () => {
						const tickElem = (
							<div
								className="rotation-timeline-tick"
								style={{
									left: `${tickLeft}px`,
								}}
							/>
						);

						const buildTickTooltip = () => (
							<div className="timeline-tooltip">
								<span>
									{ddl.timestamp.toFixed(2)}s - {ddl.actionId!.name} {ddl.result()}
								</span>
								{ddl.source?.isTarget && (
									<span className="threat-metrics">
										{' '}
										({ddl.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
									</span>
								)}
							</div>
						);

						addTooltip(tickElem, buildTickTooltip);
						return tickElem;
					});
				});
		});

		// If there are any auras that correspond to this cast, visualize them in the same row.
		aurasById
			.filter(auraUptimeLogs => {
				return idsToGroupForRotation.includes(actionId.spellId)
					? actionId.equalsIgnoringTag(buffAuraToSpellIdMap[auraUptimeLogs[0].actionId!.spellId] ?? auraUptimeLogs[0].actionId!)
					: actionId.equals(buffAuraToSpellIdMap[auraUptimeLogs[0].actionId!.spellId] ?? auraUptimeLogs[0].actionId!);
			})
			.forEach(auraUptimeLogs => this.applyAuraUptimeLogsToRow(auraUptimeLogs, windowed, true));

		this.rotationTimeline.appendChild(rowElem);
	}

	private addAuraRow(auraUptimeLogs: Array<AuraUptimeLog>, duration: number, scope = '') {
		const actionId = auraUptimeLogs[0].actionId!;

		const rowElem = this.makeRowElem(actionId, duration, scope);
		this.rotationLabels.appendChild(this.makeLabelElem(actionId, false, true, scope));
		this.rotationHiddenIdsContainer.appendChild(this.makeLabelElem(actionId, true, true, scope));
		this.rotationTimeline.appendChild(rowElem);

		this.applyAuraUptimeLogsToRow(auraUptimeLogs, this.makeWindowedRow(rowElem), false);
	}

	private applyAuraUptimeLogsToRow(auraUptimeLogs: Array<AuraUptimeLog>, windowed: WindowedRow, hasCast: boolean) {
		auraUptimeLogs.forEach(aul => {
			const auraLeft = this.timeToPxValue(aul.gainedAt);
			const auraWidth = this.timeToPxValue(aul.fadedAt === aul.gainedAt ? 0.001 : aul.fadedAt - aul.gainedAt);
			windowed.add(auraLeft, auraWidth, () => {
				const auraElem = (
					<div
						className="rotation-timeline-aura"
						style={{
							left: `${auraLeft}px`,
							minWidth: `${auraWidth}px`,
						}}
					/>
				);

				addTooltip(auraElem, () => (
					<div className="timeline-tooltip">
						<span>
							{aul.actionId!.name}: {aul.gainedAt.toFixed(2)}s - {aul.fadedAt.toFixed(2)}s
						</span>
					</div>
				));

				aul.stacksChange.forEach((scl, i) => {
					if (scl.timestamp == aul.fadedAt) {
						return;
					}

					const stacksChangeElem = (
						<div
							className="rotation-timeline-stacks-change"
							style={{
								left: this.timeToPx(scl.timestamp - aul.timestamp),
								width: this.timeToPx(aul.stacksChange[i + 1] ? aul.stacksChange[i + 1].timestamp - scl.timestamp : aul.fadedAt - scl.timestamp),
								textIndent: hasCast ? '30px' : undefined,
							}}>
							{String(scl.newStacks)}
						</div>
					);
					auraElem.appendChild(stacksChangeElem);
				});
				// Stack markers live inside the aura element, so they come and go with it.
				return auraElem;
			});
		});
	}

	private timeToPxValue(time: number): number {
		return time * 100;
	}
	private timeToPx(time: number): string {
		return this.timeToPxValue(time) + 'px';
	}

	private drawRotationTimeRuler(canvas: HTMLCanvasElement, duration: number) {
		const height = 30;
		canvas.width = this.timeToPxValue(duration);
		canvas.height = height;

		const ctx = canvas.getContext('2d')!;
		ctx.strokeStyle = 'white';

		ctx.font = 'bold 14px SimDefaultFont';
		ctx.fillStyle = 'white';
		ctx.lineWidth = 2;
		ctx.beginPath();

		// Bottom border line
		ctx.moveTo(0, height);
		ctx.lineTo(canvas.width, height);

		// Tick lines
		const numTicks = 1 + Math.floor(duration * 10);
		for (let i = 0; i <= numTicks; i++) {
			const time = i * 0.1;
			let x = this.timeToPxValue(time);
			if (i == 0) {
				ctx.textAlign = 'left';
				x++;
			} else if (i % 10 == 0 && time + 1 > duration) {
				ctx.textAlign = 'right';
				x--;
			} else {
				ctx.textAlign = 'center';
			}

			let lineHeight = 0;
			if (i % 10 == 0) {
				lineHeight = height * 0.5;
				ctx.fillText(time + 's', x, height - height * 0.6);
			} else if (i % 5 == 0) {
				lineHeight = height * 0.25;
			} else {
				lineHeight = height * 0.125;
			}
			ctx.moveTo(x, height);
			ctx.lineTo(x, height - lineHeight);
		}
		ctx.stroke();
	}

	update() {
		this.updatePlot();
	}

	// Per-render resources (tooltips, listeners) belong to the slot being
	// rendered so a parked slot can be destroyed independently. Rows are only
	// ever built under a live slot (see updateRotationChart).
	addOnResetCallback(callback: () => void) {
		this.liveSlot!.resetCallbacks.push(callback);
	}

	// A single player's slot holds the rotation subtree plus every series, so the
	// chart choice is irrelevant to it; multi-player options depend on the chart.
	private resultKey(includeChart = false): string {
		const rd = this.resultData!;
		return [rd.result.request.requestId, JSON.stringify(rd.filter), includeChart ? this.chartPicker.value : ''].join('|');
	}

	// Single-player results offer the rotation chart; multi-player ones the threat chart.
	private setRotationOptionVisible(visible: boolean) {
		this.chartPicker.setOptionVisible('rotation', visible);
		this.chartPicker.setOptionVisible('threat', !visible);
	}

	private static newSlot(key: string): RotationSlot {
		return { key, labels: [], timeline: [], hiddenIdsNodes: [], emitter: new TypedEvent<void>(), resetCallbacks: [], chartSpec: null, windowedRows: [] };
	}

	private takeParkedSlot(key: string): RotationSlot | null {
		if (this.parkedSlot?.key !== key) return null;
		const slot = this.parkedSlot;
		this.parkedSlot = null;
		return slot;
	}

	// Parks the on-screen subtree (nodes moved, tooltips kept alive), destroying
	// the previously parked slot.
	private stashLiveSlot() {
		const slot = this.liveSlot;
		if (!slot) return;
		slot.labels = Array.from(this.rotationLabels.childNodes);
		slot.timeline = Array.from(this.rotationTimeline.childNodes);
		slot.hiddenIdsNodes = Array.from(this.rotationHiddenIdsContainer.childNodes);
		this.rotationLabels.replaceChildren();
		this.rotationTimeline.replaceChildren();
		this.rotationHiddenIdsContainer.replaceChildren();
		this.liveSlot = null;
		if (this.parkedSlot) this.destroySlot(this.parkedSlot);
		this.parkedSlot = slot;
	}

	private attachSlot(slot: RotationSlot) {
		this.rotationLabels.replaceChildren(...slot.labels);
		this.rotationTimeline.replaceChildren(...slot.timeline);
		this.rotationHiddenIdsContainer.replaceChildren(...slot.hiddenIdsNodes);
		this.liveSlot = slot;
		// hiddenIds is global across results: re-apply it to the restored rows.
		slot.emitter.emit(TypedEvent.nextEventID());
		this.applyRowWindow();
	}

	private destroySlot(slot: RotationSlot) {
		slot.resetCallbacks.forEach(callback => callback());
	}

	reset() {
		if (this.liveSlot) this.destroySlot(this.liveSlot);
		if (this.parkedSlot) this.destroySlot(this.parkedSlot);
		this.liveSlot = null;
		this.parkedSlot = null;
		super.reset();
	}
}

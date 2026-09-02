import { ResourceType } from '@core/proto/spell';
import { CacheHandler } from '@domain/cache_handler';
import { ActionId, buffAuraToSpellIdMap, resourceTypeToIcon } from '@domain/proto_utils/action_id';
import { AuraUptimeLog, CastLog, DpsLog, ResourceChangedLogGroup, SimLog, ThreatLogGroup } from '@domain/proto_utils/logs';
import { resourceNames } from '@domain/proto_utils/names';
import SecondaryResource from '@domain/proto_utils/secondary_resource';
import { UnitMetrics } from '@domain/proto_utils/sim_result';
import { orderedResourceTypes } from '@domain/proto_utils/utils';
import { Emitter } from '@domain/state/events';
import { bucket, distinct, maxIndex, stringComparator } from '@domain/utils';
import {
	auraAsResource,
	DEFAULT_ACTION_CATEGORY,
	idsToGroupForRotation,
	idToCategoryMap,
	MELEE_ACTION_CATEGORY,
	percentageResources,
	SPELL_ACTION_CATEGORY,
} from '@features/results/model/timeline_categories';
import i18n from '@i18n/config';
import { setActionIdBackground, setActionIdBackgroundAndHref, setActionIdWowheadDataset } from '@ui-kit/action_id_dom';
import { fragmentToString } from '@ui-kit/dom_utils';
import ApexCharts from 'apexcharts';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { actionColors } from '../model/color_settings';
import { renderDamageResult } from './log_lines';
import { ResultComponent, ResultComponentConfig, SimResultData } from './result_component';

type TooltipHandler = (dataPointIndex: number) => Element;

const dpsColor = '#ed5653';
const manaColor = '#2E93fA';
const threatColor = '#b56d07';

const cachedSpellCastIcon = new CacheHandler<HTMLAnchorElement>();

interface TimelineConfig extends ResultComponentConfig {
	secondaryResource?: SecondaryResource | null;
}

interface RotationSlot {
	key: string;
	labels: Array<Node>;
	timeline: Array<Node>;
	hiddenIdsNodes: Array<Node>;
	emitter: Emitter<void>;
	resetCallbacks: Array<() => void>;
	plotOptions: any | null;
}

export class Timeline extends ResultComponent {
	private readonly dpsResourcesPlotElem: HTMLElement;
	private dpsResourcesPlot: any;

	private readonly rotationPlotElem: HTMLElement;
	private readonly rotationLabels: HTMLElement;
	private readonly rotationTimeline: HTMLElement;
	private readonly rotationHiddenIdsContainer: HTMLElement;
	private readonly chartPicker: HTMLSelectElement;

	private resultData: SimResultData | null;
	rendered: boolean;

	// A rendered rotation timeline for one (result, filter, chart) key. The DOM
	// nodes are kept LIVE (moved in and out of the containers, never cloned) so
	// their tippy instances, click handlers and emitter subscriptions survive a
	// switch between the current result and a saved reference. Eviction runs the
	// slot's reset callbacks (tooltip destroy, listener removal).
	private liveSlot: RotationSlot | null = null;
	private cachedSlots: Array<RotationSlot> = [];
	private static readonly MAX_CACHED_SLOTS = 2;

	private hiddenIds: Array<ActionId>;

	private secondaryResource?: SecondaryResource | null;

	constructor(config: TimelineConfig) {
		config.rootCssClass = 'timeline-root';
		super(config);
		this.resultData = null;
		this.rendered = false;
		this.hiddenIds = [];
		this.addOnDisposeCallback(() => this.reset());
		this.secondaryResource = config.secondaryResource;

		this.rootElem.appendChild(
			<div className="timeline-disclaimer">
				<div className="d-flex flex-column">
					<p>
						<i className="warning fa fa-exclamation-triangle fa-xl me-2"></i>
						{i18n.t('results_tab.details.timeline.disclaimer')}
					</p>
					<p>{i18n.t('results_tab.details.timeline.note')}</p>
				</div>
				<select className="timeline-chart-picker form-select">
					<option className="rotation-option" value="rotation">
						{i18n.t('results_tab.details.timeline.chart_types.rotation')}
					</option>
					<option className="dps-option" value="dps">
						{i18n.t('results_tab.details.timeline.chart_types.dps')}
					</option>
					<option className="threat-option" value="threat">
						{i18n.t('results_tab.details.timeline.chart_types.threat')}
					</option>
				</select>
			</div>,
		);

		this.rootElem.appendChild(
			<div className="timeline-plots-container">
				<div className="timeline-plot dps-resources-plot hide"></div>
				<div className="timeline-plot rotation-plot">
					<div className="rotation-container">
						<div className="rotation-labels"></div>
						<div className="rotation-timeline" draggable={true}></div>
					</div>
					<div className="rotation-hidden-ids"></div>
				</div>
			</div>,
		);

		this.chartPicker = this.rootElem.querySelector('.timeline-chart-picker')!;
		this.chartPicker.addEventListener('change', () => this.onChartPickerSelectHandler());

		this.dpsResourcesPlotElem = this.rootElem.querySelector('.dps-resources-plot')!;
		this.dpsResourcesPlot = new ApexCharts(this.dpsResourcesPlotElem, {
			chart: {
				animations: {
					enabled: false,
				},
				background: 'transparent',
				foreColor: 'white',
				height: '100%',
				id: 'dpsResources',
				type: 'line',
				zoom: {
					enabled: true,
					allowMouseWheelZoom: false,
				},
			},
			series: [], // Set dynamically
			xaxis: {
				title: {
					text: i18n.t('results_tab.details.timeline.chart_options.time_axis'),
				},
			},
			noData: {
				text: i18n.t('results_tab.details.timeline.chart_options.waiting_for_data'),
			},
			stroke: {
				width: 2,
				curve: 'straight',
			},
		});

		this.rotationPlotElem = this.rootElem.querySelector('.rotation-plot')!;
		this.rotationLabels = this.rootElem.querySelector('.rotation-labels')!;
		this.rotationTimeline = this.rootElem.querySelector('.rotation-timeline')!;
		this.rotationHiddenIdsContainer = this.rootElem.querySelector('.rotation-hidden-ids')!;

		let isMouseDown = false;
		let startX = 0;
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

	onChartPickerSelectHandler() {
		if (this.chartPicker.value === 'rotation') {
			this.dpsResourcesPlotElem.classList.add('hide');
			this.rotationPlotElem.classList.remove('hide');
		} else {
			this.dpsResourcesPlotElem.classList.remove('hide');
			this.rotationPlotElem.classList.add('hide');
		}
	}

	onSimResult(resultData: SimResultData) {
		this.resultData = resultData;
		this.update();
	}

	private updatePlot() {
		if (this.resultData == null) {
			return;
		}

		// Fast path: this (result, filter, chart) was rendered before and its live
		// subtree is either on screen or parked in the cache.
		const key = this.resultKey();
		const hit = this.liveSlot?.key === key ? this.liveSlot : this.cachedSlots.find(slot => slot.key === key);
		if (hit?.plotOptions) {
			if (hit !== this.liveSlot) {
				this.takeCachedSlot(key);
				this.stashLiveSlot();
				this.attachSlot(hit);
			}
			this.setRotationOptionVisible(true);
			this.dpsResourcesPlot.updateOptions(hit.plotOptions);
			return;
		}

		const duration = this.resultData!.result.result.firstIterationDuration || 1;
		const options: any = {
			theme: {
				mode: 'dark',
			},
			series: [],
			colors: [],
			xaxis: {
				min: 0,
				max: duration,
				tickAmount: 10,
				decimalsInFloat: 1,
				labels: {
					show: true,
				},
				title: {
					text: 'Time (s)',
				},
			},
			yaxis: [],
			chart: {
				events: {
					beforeResetZoom: () => {
						return {
							xaxis: {
								min: 0,
								max: duration,
							},
						};
					},
				},
				toolbar: {
					show: false,
				},
			},
		};

		let tooltipHandlers: Array<TooltipHandler | null> = [];
		options.tooltip = {
			enabled: true,
			custom: (data: { series: any; seriesIndex: number; dataPointIndex: number; w: any }) => {
				if (tooltipHandlers[data.seriesIndex]) {
					return fragmentToString(tooltipHandlers[data.seriesIndex]!(data.dataPointIndex));
				} else {
					throw new Error('No tooltip handler for series ' + data.seriesIndex);
				}
			},
		};

		const players = this.resultData!.result.getRaidIndexedPlayers(this.resultData!.filter);
		if (players.length == 1) {
			const player = players[0];

			this.setRotationOptionVisible(true);

			try {
				this.updateRotationChart(player, duration);
			} catch (e) {
				console.log('Failed to update rotation chart: ', e);
			}

			const dpsData = this.addDpsSeries(player, options, '');
			this.addDpsYAxis(dpsData.maxDps, options);
			tooltipHandlers.push(dpsData.tooltipHandler);
			tooltipHandlers.push(this.addManaSeries(player, options));
			tooltipHandlers.push(this.addThreatSeries(player, options, ''));
			tooltipHandlers = tooltipHandlers.filter(handler => !!handler);

			this.addMajorCooldownAnnotations(player, options);
			if (this.liveSlot && this.liveSlot.key === key) this.liveSlot.plotOptions = options;
		} else {
			if (this.chartPicker.value == 'rotation') {
				this.chartPicker.value = 'dps';
				return;
			}
			this.setRotationOptionVisible(false);

			this.stashLiveSlot();
			this.clearRotationChart();

			if (this.chartPicker.value == 'dps') {
				let maxDps = 0;
				players.forEach(player => {
					const dpsData = this.addDpsSeries(player, options, `var(--bs-${player.classColor}`);
					maxDps = Math.max(maxDps, dpsData.maxDps);
					tooltipHandlers.push(dpsData.tooltipHandler);
				});
				this.addDpsYAxis(maxDps, options);
			} else {
				// threat
				let maxThreat = 0;
				players.forEach(player => {
					tooltipHandlers.push(this.addThreatSeries(player, options, player.classColor));
					maxThreat = Math.max(maxThreat, player.maxThreat);
				});
				this.addThreatYAxis(maxThreat, options);
			}
		}

		this.dpsResourcesPlot.updateOptions(options);
	}

	private addDpsYAxis(maxDps: number, options: any) {
		const dpsAxisMax = Math.ceil(maxDps / 100) * 100;
		options.yaxis.push({
			color: dpsColor,
			seriesName: 'DPS',
			min: 0,
			max: dpsAxisMax,
			tickAmount: 10,
			decimalsInFloat: 0,
			title: {
				text: 'DPS',
				style: {
					color: dpsColor,
				},
			},
			axisBorder: {
				show: true,
				color: dpsColor,
			},
			axisTicks: {
				color: dpsColor,
			},
			labels: {
				minWidth: 30,
				style: {
					colors: [dpsColor],
				},
			},
		});
	}

	private addThreatYAxis(maxThreat: number, options: any) {
		const axisMax = Math.ceil(maxThreat / 10000) * 10000;
		options.yaxis.push({
			color: threatColor,
			seriesName: i18n.t('results_tab.details.timeline.tooltips.threat'),
			min: 0,
			max: axisMax,
			tickAmount: 10,
			decimalsInFloat: 0,
			title: {
				text: i18n.t('results_tab.details.timeline.tooltips.threat'),
				style: {
					color: threatColor,
				},
			},
			axisBorder: {
				show: true,
				color: threatColor,
			},
			axisTicks: {
				color: threatColor,
			},
			labels: {
				minWidth: 30,
				style: {
					colors: [threatColor],
				},
			},
		});
	}

	// Returns a function for drawing the tooltip, or null if no series was added.
	private addDpsSeries(unit: UnitMetrics, options: any, colorOverride: string): { maxDps: number; tooltipHandler: TooltipHandler } {
		const dpsLogs = unit.dpsLogs.filter(log => log.timestamp >= 0);

		options.colors.push(colorOverride || dpsColor);
		options.series.push({
			name: 'DPS',
			type: 'line',
			data: dpsLogs.map(log => {
				return {
					x: log.timestamp,
					y: log.dps,
				};
			}),
		});

		return {
			maxDps: dpsLogs[maxIndex(dpsLogs.map(l => l.dps))!]?.dps,
			tooltipHandler: (dataPointIndex: number) => {
				const log = dpsLogs[dataPointIndex];
				return this.dpsTooltip(log, true, unit, colorOverride);
			},
		};
	}

	// Returns a function for drawing the tooltip, or null if no series was added.
	private addManaSeries(unit: UnitMetrics, options: any): TooltipHandler | null {
		const manaLogs = unit.groupedResourceLogs[ResourceType.ResourceTypeMana].filter(log => log.timestamp >= 0);
		if (manaLogs.length == 0) {
			return null;
		}
		const maxMana = manaLogs[0].valueBefore;

		options.colors.push(manaColor);
		options.series.push({
			name: 'Mana',
			type: 'line',
			data: manaLogs.map(log => {
				return {
					x: log.timestamp,
					y: log.valueAfter,
				};
			}),
		});
		options.yaxis.push({
			seriesName: 'Mana',
			opposite: true, // Appear on right side
			min: 0,
			max: maxMana,
			tickAmount: 10,
			title: {
				text: 'Mana',
				style: {
					color: manaColor,
				},
			},
			axisBorder: {
				show: true,
				color: manaColor,
			},
			axisTicks: {
				color: manaColor,
			},
			labels: {
				minWidth: 30,
				style: {
					colors: [manaColor],
				},
				formatter: (val: string) => {
					const v = parseFloat(val);
					return `${v.toFixed(0)} (${((v / maxMana) * 100).toFixed(0)}%)`;
				},
			},
		} as any);

		return (dataPointIndex: number) => {
			const log = manaLogs[dataPointIndex];
			return this.resourceTooltip(log, maxMana, true);
		};
	}

	// Returns a function for drawing the tooltip, or null if no series was added.
	private addThreatSeries(unit: UnitMetrics, options: any, colorOverride: string): TooltipHandler | null {
		options.colors.push(colorOverride || threatColor);
		options.series.push({
			name: i18n.t('results_tab.details.timeline.tooltips.threat'),
			type: 'line',
			data: unit.threatLogs
				.filter(log => log.timestamp >= 0)
				.map(log => {
					return {
						x: log.timestamp,
						y: log.threatAfter,
					};
				}),
		});

		return (dataPointIndex: number) => {
			const log = unit.threatLogs[dataPointIndex];
			return this.threatTooltip(log, true, unit, colorOverride);
		};
	}

	private addMajorCooldownAnnotations(unit: UnitMetrics, options: any) {
		const mcdLogs = unit.majorCooldownLogs;
		const mcdAuraLogs = unit.majorCooldownAuraUptimeLogs;

		// Figure out how much to vertically offset cooldown icons, for cooldowns
		// used very close to each other. This is so the icons don't overlap.
		const MAX_ALLOWED_DIST = 10;
		const cooldownIconOffsets = mcdLogs.map(
			(mcdLog, mcdIdx) => mcdLogs.filter((cdLog, cdIdx) => cdIdx < mcdIdx && cdLog.timestamp > mcdLog.timestamp - MAX_ALLOWED_DIST).length,
		);

		const distinctMcdAuras = distinct(mcdAuraLogs, (a, b) => a.actionId!.equalsIgnoringTag(b.actionId!));
		// Sort by name so auras keep their same colors even if timings change.
		distinctMcdAuras.sort((a, b) => stringComparator(a.actionId!.name, b.actionId!.name));
		const mcdAuraColors = mcdAuraLogs.map(
			mcdAuraLog => actionColors[distinctMcdAuras.findIndex(dAura => dAura.actionId!.equalsIgnoringTag(mcdAuraLog.actionId!))],
		);

		options.annotations = {
			position: 'back',
			xaxis: mcdAuraLogs.map((log, i) => {
				return {
					x: log.gainedAt,
					x2: log.fadedAt,
					fillColor: mcdAuraColors[i],
				};
			}),
			points: mcdLogs.map((log, i) => {
				return {
					x: log.timestamp,
					y: 0,
					image: {
						path: log.actionId!.iconUrl,
						width: 20,
						height: 20,
						offsetY: cooldownIconOffsets[i] * -25,
					},
				};
			}),
		};
	}

	private clearRotationChart() {
		this.rotationLabels.replaceChildren(<div className="rotation-label-header"></div>);
		const canvasRef = ref<HTMLCanvasElement>();
		this.rotationTimeline.replaceChildren(
			<div className="rotation-timeline-header">
				<canvas ref={canvasRef} className="rotation-timeline-canvas" />
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
		this.stashLiveSlot();
		const cached = this.takeCachedSlot(key);
		if (cached) {
			this.attachSlot(cached);
			return;
		}
		this.liveSlot = { key, labels: [], timeline: [], hiddenIdsNodes: [], emitter: new Emitter<void>(), resetCallbacks: [], plotOptions: null };
		this.clearRotationChart();

		try {
			this.drawRotationTimeRuler(this.rotationTimeline.querySelector('.rotation-timeline-canvas')!, duration);
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
			const playerPets = new Map<string, UnitMetrics>();
			player.pets.forEach(petsLog => {
				const petCastsByAbility = this.getSortedCastsByAbility(petsLog);
				if (petCastsByAbility.length > 0) {
					// Because multiple pets can have the same name and we parse cast logs
					// by pet name each individual pet ends up with all the casts of pets
					// with the same name. Because of this we can just grab the first pet
					// of each name and visualize only that.
					if (!playerPets.has(petsLog.name)) {
						playerPets.set(petsLog.name, petsLog);
					}
				}
			});

			playerPets.forEach(pet => {
				this.addSeparatorRow(duration);
				this.addPetRow(pet.name, duration);
				orderedResourceTypes.forEach(resourceType => this.addResourceRow(resourceType, pet.groupedResourceLogs[resourceType], duration));
				const petCastsByAbility = this.getSortedCastsByAbility(pet);
				petCastsByAbility.forEach(castLogs => this.addCastRow(castLogs, buffsAndDebuffsById, duration));
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
				targetCastsByAbility.forEach(castLogs => this.addCastRow(castLogs, buffsAndDebuffsById, duration));
			}
		});

		// Add a row for all debuffs, even those which have already been visualized in a cast row.
		debuffsByTargetById.forEach((debuffsToShow, index) => {
			if (debuffsToShow.length > 0) {
				this.addSeparatorRow(duration);
				this.addTargetRow(targets?.[index]?.label, duration);
				debuffsToShow.forEach(auraUptimeLogs => this.addAuraRow(auraUptimeLogs, duration));
			}
		});
	}

	private getSortedCastsByAbility(player: UnitMetrics): Array<Array<CastLog>> {
		const meleeActionIds = player.getMeleeActions().map(action => action.actionId);
		const spellActionIds = player.getSpellActions().map(action => action.actionId);
		const getActionCategory = (actionId: ActionId): number => {
			const fixedCategory = idToCategoryMap[actionId.anyId()];
			if (fixedCategory != null) {
				return fixedCategory;
			} else if (meleeActionIds.find(meleeActionId => meleeActionId.equals(actionId))) {
				return MELEE_ACTION_CATEGORY;
			} else if (spellActionIds.find(spellActionId => spellActionId.equals(actionId))) {
				return SPELL_ACTION_CATEGORY;
			} else {
				return DEFAULT_ACTION_CATEGORY;
			}
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

		castsByAbility.sort((a, b) => {
			const categoryA = getActionCategory(a[0].actionId!);
			const categoryB = getActionCategory(b[0].actionId!);
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

	private makeLabelElem(actionId: ActionId, isHiddenLabel: boolean, isAura?: boolean): JSX.Element {
		const labelText = idsToGroupForRotation.includes(actionId.spellId) ? actionId.baseName : actionId.name;
		const labelIcon = ref<HTMLAnchorElement>();
		const hideElem = ref<HTMLElement>();
		const labelElem = (
			<div className={clsx('rotation-label rotation-row', isHiddenLabel && 'rotation-label-hidden')}>
				<span ref={hideElem} className={clsx('fas', isHiddenLabel ? 'fa-eye' : 'fa-eye-slash')}></span>
				<a ref={labelIcon} className="rotation-label-icon"></a>
				<span className="rotation-label-text">{labelText}</span>
			</div>
		);
		const onClickHandler = () => {
			if (isHiddenLabel) {
				const index = this.hiddenIds.findIndex(hiddenId => hiddenId.equals(actionId));
				if (index != -1) {
					this.hiddenIds.splice(index, 1);
				}
			} else {
				this.hiddenIds.push(actionId);
			}
			this.liveSlot?.emitter.emit();
		};
		hideElem.value!.addEventListener('click', onClickHandler);
		const tooltip = tippy(hideElem.value!, {
			theme: 'timeline-tooltip',
			placement: 'auto-end',
			content: isHiddenLabel ? 'Show Row' : 'Hide Row',
		});

		const updateHidden = () => {
			if (isHiddenLabel == Boolean(this.hiddenIds.find(hiddenId => hiddenId.equals(actionId)))) {
				labelElem.classList.remove('hide');
			} else {
				labelElem.classList.add('hide');
			}
		};
		const unsubHidden = this.liveSlot!.emitter.on(updateHidden);
		updateHidden();
		setActionIdBackgroundAndHref(actionId, labelIcon.value!);
		setActionIdWowheadDataset(actionId, labelIcon.value!, { useBuffAura: isAura });

		this.addOnResetCallback(() => {
			hideElem.value?.removeEventListener('click', onClickHandler);
			tooltip.destroy();
			unsubHidden();
		});

		return labelElem;
	}

	private makeRowElem(actionId: ActionId, duration: number): JSX.Element {
		const rowElem = (
			<div
				className="rotation-timeline-row rotation-row"
				style={{
					width: this.timeToPx(duration),
				}}></div>
		);

		const updateHidden = () => {
			if (this.hiddenIds.find(hiddenId => hiddenId.equals(actionId))) {
				rowElem.classList.add('hide');
			} else {
				rowElem.classList.remove('hide');
			}
		};
		const unsubHidden = this.liveSlot!.emitter.on(updateHidden);
		updateHidden();
		this.addOnResetCallback(() => unsubHidden());
		return rowElem;
	}

	private addPetRow(petName: string, duration: number) {
		const actionId = ActionId.fromPetName(petName);
		const rowElem = this.makeRowElem(actionId, duration);

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
			setActionIdBackgroundAndHref(filledActionId, labelIcon.value!);
			iconElem.appendChild(labelElem);
		});

		this.rotationTimeline.appendChild(rowElem);
	}

	private addTargetRow(targetName: string, duration: number) {
		const rowElem = this.makeRowElem(ActionId.fromEmpty(), duration);
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

		const rowElem = (
			<div
				className="rotation-timeline-row rotation-row"
				style={{
					width: this.timeToPx(duration),
				}}></div>
		);

		resourceLogs.forEach((resourceLogGroup, i) => {
			const cNames = resourceNames.get(resourceType)!.toLowerCase().replaceAll(' ', '-');
			const resourceElem = (
				<div
					className={`rotation-timeline-resource series-color ${cNames}`}
					style={{
						left: this.timeToPx(resourceLogGroup.timestamp),
						width: this.timeToPx((resourceLogs[i + 1]?.timestamp || duration) - resourceLogGroup.timestamp),
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
			rowElem.appendChild(resourceElem);

			const tooltip = tippy(resourceElem, {
				placement: 'bottom',
				content: this.resourceTooltipElem(resourceLogGroup, startValue(resourceLogGroup), false),
			});
			this.addOnResetCallback(() => tooltip.destroy());
		});
		this.rotationTimeline.appendChild(rowElem);
	}

	private addCastRow(castLogs: Array<CastLog>, aurasById: Array<Array<AuraUptimeLog>>, duration: number) {
		const actionId = castLogs[0].actionId!;

		this.rotationLabels.appendChild(this.makeLabelElem(actionId, false));
		this.rotationHiddenIdsContainer.appendChild(this.makeLabelElem(actionId, true));

		const rowElem = this.makeRowElem(actionId, duration);
		castLogs.forEach(castLog => {
			const castElem = (
				<div
					className="rotation-timeline-cast"
					style={{
						left: this.timeToPx(castLog.timestamp),
						minWidth: this.timeToPx(castLog.cancelTime || castLog.castTime + castLog.travelTime),
					}}
				/>
			);
			rowElem.appendChild(castElem);

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

			const actionIdAsString = actionId.toString();
			const cachedIconElem = cachedSpellCastIcon.get(actionIdAsString)?.cloneNode() as HTMLAnchorElement | undefined;
			let iconElem = cachedIconElem;
			if (!iconElem) {
				iconElem = (<a className="rotation-timeline-cast-icon" />) as HTMLAnchorElement;
				setActionIdBackground(actionId, iconElem);
				cachedSpellCastIcon.set(actionIdAsString, iconElem);
			}
			castElem.appendChild(iconElem);

			const travelTimeStr = castLog.travelTime == 0 ? '' : ` + ${castLog.travelTime.toFixed(2)}s travel time`;
			const totalDamage = castLog.totalDamage();

			const tt = (
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
										{ddl.timestamp.toFixed(2)}s - {renderDamageResult(ddl)}
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

			const tooltip = tippy(castElem, {
				placement: 'bottom',
				content: tt,
			});
			this.addOnResetCallback(() => tooltip.destroy());

			castLog.damageDealtLogs
				.filter(ddl => ddl.tick)
				.forEach(ddl => {
					const tickElem = (
						<div
							className="rotation-timeline-tick"
							style={{
								left: this.timeToPx(ddl.timestamp),
							}}
						/>
					);
					rowElem.appendChild(tickElem);

					const tt = (
						<div className="timeline-tooltip">
							<span>
								{ddl.timestamp.toFixed(2)}s - {ddl.actionId!.name} {renderDamageResult(ddl)}
							</span>
							{ddl.source?.isTarget && (
								<span className="threat-metrics">
									{' '}
									({ddl.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
								</span>
							)}
						</div>
					);

					const tooltip = tippy(tickElem, {
						placement: 'bottom',
						content: tt,
					});
					this.addOnResetCallback(() => tooltip.destroy());
				});
		});

		// If there are any auras that correspond to this cast, visualize them in the same row.
		aurasById
			.filter(auraUptimeLogs => {
				return idsToGroupForRotation.includes(actionId.spellId)
					? actionId.equalsIgnoringTag(buffAuraToSpellIdMap[auraUptimeLogs[0].actionId!.spellId] ?? auraUptimeLogs[0].actionId!)
					: actionId.equals(buffAuraToSpellIdMap[auraUptimeLogs[0].actionId!.spellId] ?? auraUptimeLogs[0].actionId!);
			})
			.forEach(auraUptimeLogs => this.applyAuraUptimeLogsToRow(auraUptimeLogs, rowElem, true));

		this.rotationTimeline.appendChild(rowElem);
	}

	private addAuraRow(auraUptimeLogs: Array<AuraUptimeLog>, duration: number) {
		const actionId = auraUptimeLogs[0].actionId!;

		const rowElem = this.makeRowElem(actionId, duration);
		this.rotationLabels.appendChild(this.makeLabelElem(actionId, false, true));
		this.rotationHiddenIdsContainer.appendChild(this.makeLabelElem(actionId, true, true));
		this.rotationTimeline.appendChild(rowElem);

		this.applyAuraUptimeLogsToRow(auraUptimeLogs, rowElem, false);
	}

	private applyAuraUptimeLogsToRow(auraUptimeLogs: Array<AuraUptimeLog>, rowElem: JSX.Element, hasCast: boolean) {
		auraUptimeLogs.forEach(aul => {
			const auraElem = (
				<div
					className="rotation-timeline-aura"
					style={{
						left: this.timeToPx(aul.gainedAt),
						minWidth: this.timeToPx(aul.fadedAt === aul.gainedAt ? 0.001 : aul.fadedAt - aul.gainedAt),
					}}
				/>
			);
			rowElem.appendChild(auraElem);

			const tt = (
				<div className="timeline-tooltip">
					<span>
						{aul.actionId!.name}: {aul.gainedAt.toFixed(2)}s - {aul.fadedAt.toFixed(2)}s
					</span>
				</div>
			);

			const tooltip = tippy(auraElem, {
				placement: 'bottom',
				content: tt,
			});
			this.addOnResetCallback(() => tooltip.destroy());

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

	private dpsTooltip(log: DpsLog, _includeAuras: boolean, player: UnitMetrics, colorOverride: string) {
		const showPlayerLabel = colorOverride != '';
		return (
			<div className="timeline-tooltip dps">
				<div className="timeline-tooltip-header">
					{showPlayerLabel ? (
						<>
							<img className="timeline-tooltip-icon" src="${player.iconUrl}" />
							<span className="" style="color: ${colorOverride}">
								{player.label}
							</span>
							<span> - </span>
						</>
					) : null}
					<span className="bold">{log.timestamp.toFixed(2)}s</span>
				</div>
				<div className="timeline-tooltip-body">
					<ul className="timeline-dps-events">{log.damageLogs.map(damageLog => this.tooltipLogItem(damageLog, renderDamageResult(damageLog)))}</ul>
					<div className="timeline-tooltip-body-row">
						<span className="series-color">
							{i18n.t('results_tab.details.timeline.tooltips.dps')}: {log.dps.toFixed(2)}
						</span>
					</div>
				</div>
				{this.tooltipAurasSection(log)}
			</div>
		);
	}

	private threatTooltip(log: ThreatLogGroup, includeAuras: boolean, player: UnitMetrics, colorOverride: string) {
		const showPlayerLabel = colorOverride != '';
		return (
			<div className="timeline-tooltip threat">
				<div className="timeline-tooltip-header">
					{showPlayerLabel ? (
						<>
							<img className="timeline-tooltip-icon" src={player.iconUrl} />
							<span className="" style={{ color: colorOverride }}>
								{player.label}
							</span>
							<span> - </span>
						</>
					) : null}
					<span className="bold">{log.timestamp.toFixed(2)}s</span>
				</div>
				<div className="timeline-tooltip-body">
					<div className="timeline-tooltip-body-row">
						<span className="series-color">
							{i18n.t('results_tab.details.timeline.tooltips.before')}: {log.threatBefore.toFixed(1)}
						</span>
					</div>
					<ul className="timeline-threat-events">
						{log.logs.map(log =>
							this.tooltipLogItem(
								log,
								<>
									{log.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')}
								</>,
							),
						)}
					</ul>
					<div className="timeline-tooltip-body-row">
						<span className="series-color">
							{i18n.t('results_tab.details.timeline.tooltips.after')}: {log.threatAfter.toFixed(1)}
						</span>
					</div>
				</div>
				{includeAuras ? this.tooltipAurasSection(log) : null}
			</div>
		);
	}

	private resourceTooltipElem(log: ResourceChangedLogGroup, maxValue: number, includeAuras: boolean) {
		const valToDisplayString = percentageResources.includes(log.resourceType)
			? (val: number) => `${val.toFixed(1)} (${((val / maxValue) * 100).toFixed(0)}%)`
			: (val: number) => `${val.toFixed(1)}`;

		return (
			<div className={`timeline-tooltip ${resourceNames.get(log.resourceType)!.toLowerCase().replaceAll(' ', '-')}`}>
				<div className="timeline-tooltip-header">
					<span className="bold">{log.timestamp.toFixed(2)}s</span>
				</div>
				<div className="timeline-tooltip-body">
					<div className="timeline-tooltip-body-row">
						<span className="series-color">
							{i18n.t('results_tab.details.timeline.tooltips.before')}: {valToDisplayString(log.valueBefore)}
						</span>
					</div>
					<ul className="timeline-mana-events">
						{log.logs.map(manaChangedLog => this.tooltipLogItemElem(manaChangedLog, <>{manaChangedLog.resultString()}</>))}
					</ul>
					<div className="timeline-tooltip-body-row">
						<span className="series-color">
							{i18n.t('results_tab.details.timeline.tooltips.after')}: {valToDisplayString(log.valueAfter)}
						</span>
					</div>
				</div>
				{includeAuras && this.tooltipAurasSectionElem(log)}
			</div>
		);
	}

	private resourceTooltip(log: ResourceChangedLogGroup, maxValue: number, includeAuras: boolean) {
		return this.resourceTooltipElem(log, maxValue, includeAuras);
	}

	private tooltipLogItem(log: SimLog, value: Element) {
		return this.tooltipLogItemElem(log, value);
	}

	private tooltipLogItemElem(log: SimLog, value: Element): JSX.Element {
		return (
			<li>
				{log.actionId && log.actionId.iconUrl && <img className="timeline-tooltip-icon" src={log.actionId.iconUrl}></img>}
				{log.actionId && <span>{log.actionId.name}</span>}
				<span className="series-color">{value}</span>
			</li>
		);
	}

	private tooltipAurasSection(log: SimLog) {
		if (log.activeAuras.length == 0) {
			return '';
		}
		return this.tooltipAurasSectionElem(log);
	}

	private tooltipAurasSectionElem(log: SimLog): JSX.Element {
		if (log.activeAuras.length == 0) {
			return <></>;
		}

		return (
			<div className="timeline-tooltip-auras">
				<div className="timeline-tooltip-body-row">
					<span className="bold">{i18n.t('results_tab.details.timeline.tooltips.active_auras')}</span>
				</div>
				<ul className="timeline-active-auras">
					{log.activeAuras.map(auraLog => (
						<li>
							{auraLog.actionId!.iconUrl && <img className="timeline-tooltip-icon" src={auraLog.actionId!.iconUrl}></img>}
							<span>{auraLog.actionId!.name}</span>
						</li>
					))}
				</ul>
			</div>
		);
	}

	update() {
		if (!this.rendered) this.dpsResourcesPlot.render();
		this.updatePlot();
		this.rendered = true;
	}

	// Per-render resources (tooltips, listeners) belong to the slot being
	// rendered so a parked slot can be destroyed independently.
	addOnResetCallback(callback: () => void) {
		if (this.liveSlot) {
			this.liveSlot.resetCallbacks.push(callback);
		} else {
			super.addOnResetCallback(callback);
		}
	}

	private resultKey(): string {
		const rd = this.resultData!;
		return [rd.result.request.requestId, JSON.stringify(rd.filter), this.chartPicker.value].join('|');
	}

	// Single-player results offer the rotation chart; multi-player ones the threat chart.
	private setRotationOptionVisible(visible: boolean) {
		this.rootElem.querySelector('.rotation-option')!.classList.toggle('hide', !visible);
		this.rootElem.querySelector('.threat-option')!.classList.toggle('hide', visible);
	}

	private takeCachedSlot(key: string): RotationSlot | null {
		const idx = this.cachedSlots.findIndex(slot => slot.key === key);
		return idx < 0 ? null : this.cachedSlots.splice(idx, 1)[0];
	}

	// Parks the on-screen subtree (nodes moved, tooltips kept alive) and evicts
	// the least recently used slot beyond the cache size.
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
		this.cachedSlots.push(slot);
		while (this.cachedSlots.length > Timeline.MAX_CACHED_SLOTS) {
			this.destroySlot(this.cachedSlots.shift()!);
		}
	}

	private attachSlot(slot: RotationSlot) {
		this.rotationLabels.replaceChildren(...slot.labels);
		this.rotationTimeline.replaceChildren(...slot.timeline);
		this.rotationHiddenIdsContainer.replaceChildren(...slot.hiddenIdsNodes);
		this.liveSlot = slot;
		// hiddenIds is global across results: re-apply it to the restored rows.
		slot.emitter.emit();
	}

	private destroySlot(slot: RotationSlot) {
		slot.resetCallbacks.forEach(callback => callback());
		slot.resetCallbacks = [];
	}

	render() {
		if (this.rendered) return;
		this.update();
	}

	reset() {
		if (this.liveSlot) this.destroySlot(this.liveSlot);
		this.cachedSlots.forEach(slot => this.destroySlot(slot));
		this.liveSlot = null;
		this.cachedSlots = [];
		super.reset();
	}
}

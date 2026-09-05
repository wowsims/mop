import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import SecondaryResource from '../../../proto_utils/secondary_resource';
import { UnitMetrics } from '../../../proto_utils/sim_result';
import { ResultComponent, SimResultData } from '../result_component';
import { chartSpec } from './chart/build';
import { TimelineChart } from './chart/timeline_chart';
import { ChartViewPicker } from './chart_view_picker';
import { buildRotationModel } from './rotation/model';
import { RotationView } from './rotation/rotation_view';
import { TimelineConfig } from './types';

export class Timeline extends ResultComponent {
	private readonly dpsResourcesPlotElem: HTMLElement;
	private readonly chart: TimelineChart;

	private readonly rotationPlotElem: HTMLElement;
	private readonly rotationView: RotationView;
	private readonly chartPicker: ChartViewPicker;

	private resultData: SimResultData | null;
	private rotationModelKey: string | null = null;

	private secondaryResource?: SecondaryResource | null;

	constructor(config: TimelineConfig) {
		config.rootCssClass = 'timeline-root';
		super(config);
		this.resultData = null;
		this.addOnDisposeCallback(() => {
			this.chart.dispose();
			this.reset();
		});
		this.secondaryResource = config.secondaryResource;

		const chartPickerRef = ref<HTMLDivElement>();
		const chartViewRefs = (['rotation', 'dps'] as const).map(value => ({
			value,
			input: ref<HTMLInputElement>(),
		}));
		const chartViewLabels: Record<string, string> = {
			rotation: i18n.t('results_tab.details.timeline.chart_types.rotation'),
			dps: i18n.t('results_tab.details.timeline.chart_types.dps'),
		};

		this.rootElem.appendChild(
			<div className="timeline-disclaimer">
				<div className="timeline-disclaimer-text d-flex flex-column">
					<p>
						<i className="warning fa fa-exclamation-triangle fa-xl me-2"></i>
						{i18n.t('results_tab.details.timeline.disclaimer')}
					</p>
					<p>{i18n.t('results_tab.details.timeline.note')}</p>
				</div>
				<div ref={chartPickerRef} className="timeline-chart-picker btn-group" attributes={{ role: 'group' }}>
					{chartViewRefs.map(({ value, input }) => (
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
							<label className={`btn btn-sm btn-outline-primary ${value}-option`} htmlFor={`timeline-chart-view-${value}`}>
								{chartViewLabels[value]}
							</label>
						</>
					))}
				</div>
			</div>,
		);

		const dpsResourcesPlotRef = ref<HTMLDivElement>();
		const rotationPlotRef = ref<HTMLDivElement>();
		const rotationPaneRef = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<div className="timeline-plots-container">
				<div ref={dpsResourcesPlotRef} className="timeline-plot dps-resources-plot hide"></div>
				<div ref={rotationPlotRef} className="timeline-plot rotation-plot">
					<div ref={rotationPaneRef} className="rotation-next"></div>
				</div>
			</div>,
		);

		this.chartPicker = new ChartViewPicker(
			chartPickerRef.value!,
			chartViewRefs.map(({ value, input }) => ({ value, input: input.value! })),
		);
		this.chartPicker.onChange(() => this.onChartPickerSelectHandler());

		this.dpsResourcesPlotElem = dpsResourcesPlotRef.value!;
		this.chart = new TimelineChart(this.dpsResourcesPlotElem);

		this.rotationPlotElem = rotationPlotRef.value!;
		this.rotationView = this.addChild(new RotationView(rotationPaneRef.value!));
	}

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
		if (this.isChartVisible()) this.updatePlot();
	}

	// The rotation view and the chart are alternatives, and the rotation is the default.
	// Building the chart's series while it is hidden costs a pass over the unit's dps logs,
	// mana group and threat logs - and forces those lazy derives to materialise - for
	// something nobody is looking at.
	private isChartVisible(): boolean {
		return this.chartPicker.value !== 'rotation';
	}

	onSimResult(resultData: SimResultData) {
		this.resultData = resultData;
		this.updatePlot();
	}

	private updatePlot() {
		if (this.resultData == null) {
			return;
		}

		// A cleared result still emits, with an empty raid.
		const player = this.resultData.result.getRaidIndexedPlayers(this.resultData.filter)[0];
		if (!player) {
			this.rotationModelKey = null;
			this.rotationView.setModel(null);
			this.chart.render(null);
			return;
		}

		const duration = this.resultData.result.result.firstIterationDuration || 1;

		try {
			this.updateRotation(player, duration);
		} catch (e) {
			console.log('Failed to update rotation chart: ', e);
		}

		if (!this.isChartVisible()) {
			// Nothing else to do: the rotation is what is on screen.
			return;
		}

		this.chart.render(chartSpec(player, duration, this.secondaryResource));
	}

	private updateRotation(player: UnitMetrics, duration: number) {
		const targets = this.resultData!.result.getTargets(this.resultData!.filter);
		if (targets.length == 0) {
			return;
		}
		const key = this.resultKey();
		if (this.rotationModelKey === key) {
			return;
		}
		this.rotationModelKey = key;
		this.rotationView.setModel(buildRotationModel({ player, targets, duration, secondaryResource: this.secondaryResource }));
	}

	private resultKey(): string {
		const rd = this.resultData!;
		return [rd.result.request.requestId, JSON.stringify(rd.filter)].join('|');
	}

	reset() {
		this.rotationModelKey = null;
		super.reset();
	}
}

import { SimResult, SimResultFilter } from '@domain/proto_utils/sim_result';
import { EventID } from '@domain/state/batch';
import { Emitter } from '@domain/state/events';
import { UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import i18n from '@i18n/config';
import { UnitPicker, UnitValue, UnitValueConfig } from '@ui-kit/pickers/unit_picker';

import { ResultComponent, ResultComponentConfig, SimResultData } from './result_component';
const ALL_UNITS = -1;

interface FilterData {
	target: number;
}

export class ResultsFilter extends ResultComponent {
	private readonly currentFilter: FilterData;

	// UI-local state signal (filter selection lives on this component).
	readonly changeEmitter: Emitter<void>;

	private readonly targetFilter: UnitPicker<FilterData>;

	constructor(config: ResultComponentConfig) {
		config.rootCssClass = 'results-filter-root';
		super(config);
		this.currentFilter = {
			target: ALL_UNITS,
		};
		this.changeEmitter = new Emitter<void>();

		this.targetFilter = new UnitPicker(this.rootElem, this.currentFilter, {
			id: 'results-filter-target-filter',
			extraCssClasses: ['target-filter-root', 'd-none'],
			storeSubscribe: () => this.changeEmitter.on,
			sourceToValue: (src: UnitReference | undefined) => this.refToValue(src),
			valueToSource: (val: UnitValue) => val.value,
			getValue: (filterData: FilterData) => this.numToRef(filterData.target),
			setValue: (eventID: EventID, filterData: FilterData, newValue: UnitReference | undefined) => this.setTarget(eventID, this.refToNum(newValue)),
			values: [],
		});
	}

	getFilter(): SimResultFilter {
		return {
			target: this.currentFilter.target == ALL_UNITS ? null : this.currentFilter.target,
		};
	}

	onSimResult(resultData: SimResultData) {
		this.targetFilter.setOptions(this.getUnitOptions(resultData.eventID, resultData.result));
		this.targetFilter.rootElem.classList.remove('d-none');
	}

	setTarget(eventID: EventID, newTarget: number | null) {
		this.currentFilter.target = newTarget === null ? ALL_UNITS : newTarget;
		this.changeEmitter.emit();
	}

	private refToValue(ref: UnitReference | undefined): UnitValue {
		if (!ref || ref.type == UnitType.Unknown) {
			return {
				value: ref,
			};
		} else if (ref.type == UnitType.AllTargets) {
			return {
				iconUrl: '',
				text: i18n.t('results_tab.details.all_targets'),
				value: ref,
			};
		} else if (this.hasLastSimResult()) {
			const simResult = this.getLastSimResult();
			const unit = ref.type == UnitType.Target ? simResult.result.getTargetWithEncounterIndex(ref.index) : null;

			if (unit) {
				return {
					iconUrl: unit.iconUrl || '',
					text: i18n.t('results_tab.details.target_number', { number: ref.index + 1 }),
					color: unit.classColor || '',
					value: ref,
				};
			}
		}

		return {
			value: ref,
		};
	}

	private refToNum(ref: UnitReference | undefined): number {
		return !ref || ref.type == UnitType.AllTargets ? ALL_UNITS : ref.index;
	}

	private numToRef(idx: number): UnitReference {
		return idx == ALL_UNITS ? UnitReference.create({ type: UnitType.AllTargets }) : UnitReference.create({ type: UnitType.Target, index: idx });
	}

	private getUnitOptions(eventID: EventID, simResult: SimResult): Array<UnitValueConfig> {
		const allUnitsOption = UnitReference.create({ type: UnitType.AllTargets });

		const unitOptions = simResult.getTargets().map(unit => UnitReference.create({ type: UnitType.Target, index: unit.index }));

		const options = [allUnitsOption].concat(unitOptions);

		const curRef = this.numToRef(this.currentFilter.target);
		const hasSameOption = options.find(option => UnitReference.equals(option, curRef)) != null;
		if (!hasSameOption) {
			this.currentFilter.target = ALL_UNITS;
			this.changeEmitter.emit();
		}

		return options.map(o => {
			return {
				value: this.refToValue(o),
			};
		});
	}
}

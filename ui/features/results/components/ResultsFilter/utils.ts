import { UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { SimResult, SimResultFilter } from '@sim/proto/sim_result';
import type { UnitValue } from '@ui-kit/UnitPicker/types';

/** No target picked: every target's damage is counted. */
export const ALL_UNITS = -1;

export const numToRef = (index: number): UnitReference =>
	index === ALL_UNITS ? UnitReference.create({ type: UnitType.AllTargets }) : UnitReference.create({ type: UnitType.Target, index });

export const refToNum = (ref: UnitReference | undefined): number => (!ref || ref.type === UnitType.AllTargets ? ALL_UNITS : ref.index);

export const simResultFilter = (target: number): SimResultFilter => ({ target: target === ALL_UNITS ? null : target });

/** False once a run has fewer targets than the one the filter is pointing at. */
export const hasTarget = (result: SimResult, target: number): boolean => target === ALL_UNITS || result.getTargets().some(unit => unit.index === target);

const refToValue = (ref: UnitReference, result: SimResult): UnitValue => {
	if (ref.type === UnitType.AllTargets) return { iconUrl: '', text: i18n.t('results_tab.details.all_targets'), value: ref };

	const unit = ref.type === UnitType.Target ? result.getTargetWithEncounterIndex(ref.index) : null;
	if (!unit) return { value: ref };

	return {
		iconUrl: unit.iconUrl || '',
		text: i18n.t('results_tab.details.target_number', { number: ref.index + 1 }),
		color: unit.classColor || '',
		value: ref,
	};
};

/** All targets, then one option per target of the run. */
export const unitOptions = (result: SimResult): Array<UnitValue> =>
	[numToRef(ALL_UNITS), ...result.getTargets().map(unit => numToRef(unit.index))].map(ref => refToValue(ref, result));

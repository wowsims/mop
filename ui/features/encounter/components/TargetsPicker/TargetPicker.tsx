import { Target as TargetProto } from '@generated/proto/common';
import type { Encounter } from '@sim/raid/encounter';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { useMemo } from 'react';

import { TargetInputsPicker } from './TargetInputsPicker';
import {
	aiConfig,
	ALL_TARGET_STATS,
	booleanConfigs,
	levelConfig,
	mobTypeConfig,
	npcConfig,
	numberConfigs,
	spellSchoolConfig,
	statConfig,
	tankIndexConfig,
	type TargetFieldContext,
} from './utils/configs';

export interface TargetPickerProps {
	encounter: Encounter;
	targetIndex: number;
}

/**
 * One target: three picker sections in the order the vanilla constructor built them.
 *
 * The vanilla class wrote its three sections with `rootElem.innerHTML`, which also erased anything
 * the `Input` base had already appended into that root — harmless only because the list never
 * passes an item a label or a description.
 */
export const TargetPicker = ({ encounter, targetIndex }: TargetPickerProps) => {
	const context = useMemo(
		(): TargetFieldContext => ({
			encounter,
			targetIndex,
			getTarget: () => encounter.getTarget(targetIndex) || TargetProto.create(),
		}),
		[encounter, targetIndex],
	);

	const npc = useMemo(() => npcConfig(context), [context]);
	const ai = useMemo(() => aiConfig(context), [context]);
	const level = useMemo(() => levelConfig(context), [context]);
	const mobType = useMemo(() => mobTypeConfig(context), [context]);
	const tankIndex = useMemo(() => tankIndexConfig(context), [context]);
	const stats = useMemo(() => ALL_TARGET_STATS.map(entry => statConfig(context, entry.stat, entry.tooltip, entry.extraClassNames)), [context]);
	const numbers = useMemo(() => numberConfigs(context), [context]);
	const booleans = useMemo(() => booleanConfigs(context), [context]);
	const spellSchool = useMemo(() => spellSchoolConfig(context), [context]);

	return (
		<div className="input-root target-picker-root">
			<div className="picker-group target-picker-section target-picker-section1">
				<EnumPicker modObject={null} config={npc} />
				<EnumPicker modObject={null} config={ai} />
				<EnumPicker modObject={null} config={level} />
				<EnumPicker modObject={null} config={mobType} />
				<EnumPicker modObject={null} config={tankIndex} />
				<TargetInputsPicker encounter={encounter} targetIndex={targetIndex} />
			</div>
			<div className="picker-group target-picker-section target-picker-section2">
				{stats.map(config => (
					<NumberPicker key={config.id} modObject={null} config={config} />
				))}
			</div>
			<div className="picker-group target-picker-section target-picker-section3 threat-metrics">
				{numbers.map(config => (
					<NumberPicker key={config.id} modObject={null} config={config} />
				))}
				{booleans.map(config => (
					<BooleanPicker key={config.id} modObject={null} config={config} />
				))}
				<EnumPicker modObject={null} config={spellSchool} />
			</div>
		</div>
	);
};

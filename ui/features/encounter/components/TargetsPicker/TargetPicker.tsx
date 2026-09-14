import { Stat, Target as TargetProto } from '@generated/proto/common';
import type { Encounter } from '@sim/raid/encounter';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { PickerGroup } from '@ui-kit/PickerGroup';
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
 * One target: three picker sections, in order.
 */
export const TargetPicker = ({ encounter, targetIndex }: TargetPickerProps) => {
	const { threat: showThreatMetrics } = useDisplayMetrics(encounter.sim);
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
	const stats = useMemo(
		() =>
			ALL_TARGET_STATS.filter(entry => showThreatMetrics || entry.stat !== Stat.StatAttackPower).map(entry =>
				statConfig(context, entry.stat, entry.tooltip, entry.extraClassNames),
			),
		[context, showThreatMetrics],
	);
	const numbers = useMemo(() => numberConfigs(context), [context]);
	const booleans = useMemo(() => booleanConfigs(context), [context]);
	const spellSchool = useMemo(() => spellSchoolConfig(context), [context]);

	return (
		<div
			className="ui-field grid gap-3 grid-cols-1 xl:grid-cols-3 [&_[data-input-root]:is(:only-child)]:mb-0 [&_[data-input-root]:is(:last-child)]:mb-0"
			data-testid="target-picker-root">
			<PickerGroup data-testid="target-picker-section">
				<EnumPicker modObject={null} config={npc} />
				<EnumPicker modObject={null} config={ai} />
				<EnumPicker modObject={null} config={level} />
				<EnumPicker modObject={null} config={mobType} />
				{showThreatMetrics && <EnumPicker modObject={null} config={tankIndex} />}
				<TargetInputsPicker encounter={encounter} targetIndex={targetIndex} />
			</PickerGroup>
			<PickerGroup data-testid="target-picker-section">
				{stats.map(config => (
					<NumberPicker key={config.id} modObject={null} config={config} />
				))}
			</PickerGroup>
			{showThreatMetrics ? (
				<PickerGroup data-testid="target-picker-section">
					{numbers.map(config => (
						<NumberPicker key={config.id} modObject={null} config={config} />
					))}
					{booleans.map(config => (
						<BooleanPicker key={config.id} modObject={null} config={config} />
					))}
					<EnumPicker modObject={null} config={spellSchool} />
				</PickerGroup>
			) : (
				<div className="hidden xl:block" data-testid="target-picker-section-placeholder" aria-hidden="true" />
			)}
		</div>
	);
};

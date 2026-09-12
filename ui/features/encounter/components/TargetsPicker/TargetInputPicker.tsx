import type { TargetInput } from '@generated/proto/common';
import type { Encounter } from '@sim/raid/encounter';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { useMemo } from 'react';

import { targetInputConfig } from './utils/configs';

export interface TargetInputPickerProps {
	encounter: Encounter;
	targetIndex: number;
	inputIndex: number;
	input: TargetInput | undefined;
}

/**
 * One AI-declared target input, rendered as the picker its `InputType` names.
 *
 * Rendering it declaratively removes any need to guard against redundant rebuilds.
 */
export const TargetInputPicker = ({ encounter, targetIndex, inputIndex, input }: TargetInputPickerProps) => {
	const picker = useMemo(
		() => (input ? targetInputConfig(encounter, targetIndex, inputIndex, input) : { kind: 'none' as const }),
		[encounter, targetIndex, inputIndex, input],
	);

	return (
		<div className="input-root target-input-picker-root">
			{picker.kind === 'number' && <NumberPicker modObject={null} config={picker.config} />}
			{picker.kind === 'boolean' && <BooleanPicker modObject={null} config={picker.config} />}
			{picker.kind === 'enum' && <EnumPicker modObject={null} config={picker.config} />}
		</div>
	);
};

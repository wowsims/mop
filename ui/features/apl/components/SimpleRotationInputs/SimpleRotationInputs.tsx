import { InputPicker } from '@features/settings/components/InputPicker';
import { useSimHost } from '@sim/context/SimHostContext';

import { RotationIconGroup } from './RotationIconGroup';

/**
 * The simple-rotation block: the spec's icon row, then its inputs.
 *
 * Vanilla's `configureInputSection` pushed `'input-inline'` onto each `InputConfig.extraClassNames`
 * — a **write into the frozen spec object**, so a second construction appended the class again.
 * `inline` on the picker renders the same class through `PickerShell` and touches nothing.
 */
export const SimpleRotationInputs = () => {
	const host = useSimHost();
	const config = host.individualConfig;

	return (
		<>
			<RotationIconGroup inputs={config.rotationIconInputs ?? []} />
			{(config.rotationInputs?.inputs ?? []).map((input, index) => (
				<InputPicker key={index} config={input} inline />
			))}
		</>
	);
};

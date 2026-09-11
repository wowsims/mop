import { InputPicker } from '@features/settings/components/InputPicker';
import { useSimHost } from '@sim/context/SimHostContext';

import { RotationIconGroup } from './RotationIconGroup';

/**
 * The simple-rotation block: the spec's icon row, then its inputs.
 *
 * `inline` on the picker adds the class through `PickerShell` without writing into the spec
 * object, so a second construction doesn't append it again.
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

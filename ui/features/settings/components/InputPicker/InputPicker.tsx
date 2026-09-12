import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { InputConfig } from '@sim/spec_config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';

export interface InputPickerProps {
	config: InputConfig<Player<any>>;
	/**
	 * Lay the label and the control on one line. The rotation tab's simple-rotation section sets it
	 * for every input; the settings blocks do not.
	 */
	inline?: boolean;
}

export const InputPicker = ({ config, inline }: InputPickerProps) => {
	const player = usePlayer();
	const shared = inline ? { ...config, inline: true } : config;

	switch (shared.type) {
		case 'number':
			return <NumberPicker modObject={player} config={shared} />;
		case 'boolean':
			return <BooleanPicker modObject={player} config={{ ...shared, reverse: true }} />;
		case 'enum':
			return <EnumPicker modObject={player} config={shared} />;
	}
};

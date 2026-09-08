import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { InputConfig } from '@sim/spec_config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';

export interface InputPickerProps {
	config: InputConfig<Player<any>>;
}

export const InputPicker = ({ config }: InputPickerProps) => {
	const player = usePlayer();

	switch (config.type) {
		case 'number':
			return <NumberPicker modObject={player} config={config} />;
		case 'boolean':
			return <BooleanPicker modObject={player} config={{ ...config, reverse: true }} />;
		case 'enum':
			return <EnumPicker modObject={player} config={config} />;
	}
};

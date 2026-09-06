import type { Player } from '@domain/player';
import { usePlayer } from '@features/SimHostContext';
import type { InputConfig } from '@features/spec_config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';

export interface InputPickerProps {
	config: InputConfig<Player<any>>;
}

/**
 * One picker for one `InputConfig`, dispatched on the config's own `type` — the React shape of
 * `buildInputPickers` in `app/tabs/settings_tab.tsx`, which every generic section walks its
 * `InputSection` through.
 *
 * It parameterises the config and fixes nothing else: the modObject is always the player, because
 * `InputSection.inputs` is typed `InputConfig<Player<any>>`, so it comes from the host rather than
 * from a prop. `reverse` on the boolean branch is not a choice either — `buildInputPickers` passes it
 * for both of its callers.
 */
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

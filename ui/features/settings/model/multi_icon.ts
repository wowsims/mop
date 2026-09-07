import type { Player } from '@sim/player';
import { batch } from '@sim/state/batch';
import type { MultiIconPickerConfig } from '@ui-kit/pickers/multi_icon_picker';

export const clearMultiIconInputs = (player: Player<any>, config: MultiIconPickerConfig<Player<any>>) => {
	batch(() => {
		for (const input of config.inputs) {
			input.setValue(player, input.states === 2 ? false : 0);
		}
	});
};

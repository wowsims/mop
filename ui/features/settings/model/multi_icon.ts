import type { Player } from '@domain/player';
import { batch } from '@domain/state/batch';
import type { MultiIconPickerConfig } from '@ui-kit/pickers/multi_icon_picker';

/**
 * `MultiIconPicker.clearPicker()`: switch every child input off, in one batch.
 *
 * Vanilla did it through the child pickers — `setInputValue(null)` then `inputChanged()` — so the
 * value written is `IconPicker.getInputValue()` after `Number(null)`, which is `false` on the
 * bi-state configs (`states === 2`) and `0` on the rest.
 */
export const clearMultiIconInputs = (player: Player<any>, config: MultiIconPickerConfig<Player<any>>) => {
	batch(() => {
		for (const input of config.inputs) {
			input.setValue(player, input.states === 2 ? false : 0);
		}
	});
};

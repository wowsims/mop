import type { Player } from '@domain/player';
import { ItemSwapPicker } from '@features/item-swap';
import type { InputConfig } from '@features/spec_config';
import type { ItemSlot } from '@generated/proto/common';

import { InputPicker } from '../InputPicker';

export interface OtherSettingsProps {
	/** `individualConfig.otherInputs.inputs`, after the shell has prepended Challenge Mode. */
	inputs: ReadonlyArray<InputConfig<Player<any>>>;
	/** Empty on the specs that do not support swapping, which is where the swap block is absent. */
	itemSlots: ReadonlyArray<ItemSlot>;
}

/**
 * The other-settings block: the spec's generic inputs, then item swap.
 *
 * The two halves are one component because they share a `ContentBlock` body. While the inputs were
 * vanilla, item swap had to be portalled in *after* them and the settings tab carried a comment
 * saying so — an append-ordering dependency between two stacks. Rendering both here makes the order
 * the order they are written in.
 *
 * Item swap is a conditional render rather than a `hide` class, and that is not a departure from the
 * rule the pickers follow: vanilla never constructed the picker on a spec with no swap slots, so its
 * elements are absent there on both builds.
 */
export const OtherSettings = ({ inputs, itemSlots }: OtherSettingsProps) => (
	<>
		{inputs.map(config => (
			// `inline` forced rather than read off the config. Vanilla added `input-inline` to every
			// `.input-root` in this body with a `querySelectorAll` walk after construction, so a config
			// that sets `inline: false` still got the class — and `PickerShell` de-duplicates, so the
			// configs that also carry it in `extraCssClasses` are unaffected.
			<InputPicker key={config.id} config={{ ...config, inline: true }} />
		))}
		{itemSlots.length > 0 && <ItemSwapPicker itemSlots={itemSlots} />}
	</>
);

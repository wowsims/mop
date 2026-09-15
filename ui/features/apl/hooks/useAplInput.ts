import { useApl } from '@features/apl/context/AplContext';
import type { Player } from '@sim/player/player';
import { type InputState, useInput } from '@ui-kit/hooks/useInput';
import type { InputConfig } from '@ui-kit/input';
import { useId } from 'react';

export interface AplInput<T> extends InputState<T> {
	/** The caller's config with the two things every APL shell needs filled in. */
	shellConfig: InputConfig<Player<any>, T> & { id: string };
}

/**
 * `useInput` for a picker inside the APL tree.
 *
 * It fills in the two things every one of them needs and none of them is given:
 *
 * - **the rotation as the change source**, or inside a list row that row's `rowSource`. A config arrives from a field group, from a list's item
 *   binding or from a list item, and none of those carries one. Without it `useStoreSubscribe`
 *   never re-reads and the picker freezes at its first render, silently.
 * - **an id.** `PickerShell` puts it on the label's `htmlFor`, and a nested picker is handed a
 *   config that has none.
 */
export const useAplInput = <T>(player: Player<any>, config: InputConfig<Player<any>, T>): AplInput<T> => {
	const generatedId = useId();
	const { changeSource } = useApl();
	const shellConfig = { ...config, storeSubscribe: changeSource, id: config.id || generatedId };
	return { ...useInput(player, shellConfig), shellConfig };
};

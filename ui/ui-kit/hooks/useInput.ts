import type { InputConfig } from '@ui-kit/input';
import { useCallback, useRef, useState } from 'react';

import { useStoreSubscribe } from './useStoreSubscribe';

export interface InputState<T, V = T> {
	value: V;
	setValue: (next: V) => void;
	/** `showWhen` said no. Rendered as the `hide` class, not unmounted — see the skill. */
	hidden: boolean;
	disabled: boolean;
	/**
	 * Increments on every notification, including ones that leave the value unchanged. An input that
	 * holds text the user is editing re-syncs on this, because that is what `Input.refresh()` does —
	 * a picker showing half-typed input is reset by any notification, not only by a real change.
	 */
	revision: number;
}

/**
 * Binds one `InputConfig` — the frozen picker contract every spec is written against — to a React
 * component.
 *
 * `getValue` is re-read once per notification and held in between (see `useStoreSubscribe`), which
 * matches the vanilla Input's refresh() and is what makes configs like the encounter target list —
 * `getTargets().slice()`, a new array every call — safe to bind.
 */
export const useInput = <ModObject, T, V = T>(modObject: ModObject, config: InputConfig<ModObject, T, V>): InputState<T, V> => {
	const configRef = useRef(config);
	configRef.current = config;

	// `defaultValue` seeds the input without writing to the source, and the source takes over at the
	// first notification — vanilla does the same through init() then refresh(), which re-reads
	// whether or not the value actually changed. Vanilla tests it for truthiness, so a defaultValue
	// of 0 (a real enum value) is ignored; matched here rather than corrected.
	const [seed, setSeed] = useState(() => (config.defaultValue ? config.defaultValue : undefined));
	const revision = useRef(0);

	// An input with no `storeSubscribe` — the contract names UI-local toggles — has nothing to tell
	// it a write happened, so `setValue` rings this itself. Without it a controlled input reverts on
	// its own click: React restores the rendered value and the snapshot is never re-read.
	const notify = useRef<() => void>(() => {});

	const subscribe = useCallback(
		(onChange: () => void) => {
			const ring = () => {
				revision.current++;
				setSeed(undefined);
				onChange();
			};
			notify.current = ring;
			const source = configRef.current.storeSubscribe?.(modObject);
			return source ? source(ring) : () => {};
		},
		[modObject],
	);

	// One object per notification, so a notification that does not change the value still re-renders.
	const snapshot = useStoreSubscribe(subscribe, () => ({ value: configRef.current.getValue(modObject), revision: revision.current }));

	const toValue = (src: T): V => (configRef.current.sourceToValue ? configRef.current.sourceToValue(src) : (src as unknown as V));

	const setValue = useCallback(
		(next: V) => {
			setSeed(undefined);
			const { setValue: write, valueToSource, storeSubscribe } = configRef.current;
			write(modObject, valueToSource ? valueToSource(next) : (next as unknown as T));
			// A sourced write notifies on its own; ringing here too would re-read before the store has
			// committed.
			if (!storeSubscribe) notify.current();
		},
		[modObject],
	);

	return {
		value: toValue(seed !== undefined ? seed : snapshot.value),
		setValue,
		hidden: !!config.showWhen && !config.showWhen(modObject),
		disabled: !!config.enableWhen && !config.enableWhen(modObject),
		revision: snapshot.revision,
	};
};

import type { InputConfig } from '@ui-kit/input';
import { useCallback, useRef, useState } from 'react';

import { useStoreSubscribe } from './store';

export interface InputState<T, V = T> {
	value: V;
	setValue: (next: V) => void;
	/** `showWhen` said no. Rendered as the `hide` class, not unmounted — see the skill. */
	hidden: boolean;
	disabled: boolean;
}

/**
 * Binds one `InputConfig` — the frozen picker contract every spec is written against — to a React
 * component.
 *
 * `getValue` is re-read once per notification and held in between (see `useStoreSubscribe`), which
 * matches the vanilla Input's refresh() and is what makes configs like the encounter target list —
 * `getTargets().slice()`, a new array every call — safe to bind.
 */
export function useInput<ModObject, T, V = T>(modObject: ModObject, config: InputConfig<ModObject, T, V>): InputState<T, V> {
	const configRef = useRef(config);
	configRef.current = config;

	// `defaultValue` seeds the input without writing to the source, and the source takes over at the
	// first notification — vanilla does the same through init() then refresh(), which re-reads
	// whether or not the value actually changed.
	const [seed, setSeed] = useState(config.defaultValue);

	const subscribe = useCallback(
		(onChange: () => void) => {
			const source = configRef.current.storeSubscribe?.(modObject);
			return source
				? source(() => {
						setSeed(undefined);
						onChange();
					})
				: () => {};
		},
		[modObject],
	);

	const source = useStoreSubscribe(subscribe, () => configRef.current.getValue(modObject));

	const toValue = (src: T): V => (configRef.current.sourceToValue ? configRef.current.sourceToValue(src) : (src as unknown as V));

	const setValue = useCallback(
		(next: V) => {
			setSeed(undefined);
			const { setValue: write, valueToSource } = configRef.current;
			write(modObject, valueToSource ? valueToSource(next) : (next as unknown as T));
		},
		[modObject],
	);

	return {
		value: toValue(seed !== undefined ? seed : source),
		setValue,
		hidden: !!config.showWhen && !config.showWhen(modObject),
		disabled: !!config.enableWhen && !config.enableWhen(modObject),
	};
}

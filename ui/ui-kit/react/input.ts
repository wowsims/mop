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
 * `getValue` is re-read only when the source notifies, and its result is held between notifications.
 * That matches the vanilla Input, which re-reads in refresh(), and it is required rather than an
 * optimisation: configs like the encounter target list return `getTargets().slice()`, a new array
 * every call, which useSyncExternalStore would otherwise see as a new snapshot on every render.
 */
export function useInput<ModObject, T, V = T>(modObject: ModObject, config: InputConfig<ModObject, T, V>): InputState<T, V> {
	const configRef = useRef(config);
	configRef.current = config;

	// `defaultValue` seeds the input without writing to the source, and the source takes over at the
	// first notification — vanilla does the same through init() then refresh(), which re-reads
	// whether or not the value actually changed.
	const [seed, setSeed] = useState(config.defaultValue);

	const snapshot = useRef<{ mod: ModObject; value: T } | null>(null);
	const stale = useRef(true);

	const subscribe = useCallback(
		(onChange: () => void) => {
			const source = configRef.current.storeSubscribe?.(modObject);
			return source
				? source(() => {
						stale.current = true;
						setSeed(undefined);
						onChange();
					})
				: () => {};
		},
		[modObject],
	);

	const source = useStoreSubscribe(subscribe, () => {
		if (stale.current || snapshot.current?.mod !== modObject) {
			snapshot.current = { mod: modObject, value: configRef.current.getValue(modObject) };
			stale.current = false;
		}
		return snapshot.current.value;
	});

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

import { useStoreField } from '@sim/hooks/useStoreField';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { InputConfig } from '@ui-kit/input';
import { useCallback, useRef, useState } from 'react';

export interface InputState<T, V = T> {
	value: V;
	setValue: (next: V) => void;
	/** `showWhen` said no. Rendered as the `hide` class, not unmounted — see the skill. */
	hidden: boolean;
	disabled: boolean;
	/** Increments on every notification, including ones that leave the value unchanged. */
	revision: number;
}

export const useInput = <ModObject, T, V = T>(modObject: ModObject, config: InputConfig<ModObject, T, V>): InputState<T, V> => {
	const configRef = useRef(config);
	configRef.current = config;

	// `defaultValue` seeds the input without writing to the source, and the source takes over at the first notification.
	const [seed, setSeed] = useState(() => (config.defaultValue ? config.defaultValue : undefined));
	const revision = useRef(0);

	const notify = useRef<() => void>(() => {});
	const fieldSource = useStoreField(config.storeField);

	const subscribe = useCallback(
		(onChange: () => void) => {
			const ring = () => {
				revision.current++;
				setSeed(undefined);
				onChange();
			};
			notify.current = ring;
			const source = configRef.current.storeSubscribe?.(modObject) ?? fieldSource;
			return source ? source(ring) : () => {};
		},
		[modObject, fieldSource],
	);

	const snapshot = useStoreSubscribe(subscribe, () => ({ value: configRef.current.getValue(modObject), revision: revision.current }));

	const toValue = (src: T): V => (configRef.current.sourceToValue ? configRef.current.sourceToValue(src) : (src as unknown as V));

	const setValue = useCallback(
		(next: V) => {
			setSeed(undefined);
			const { setValue: write, valueToSource, storeSubscribe, storeField } = configRef.current;
			write(modObject, valueToSource ? valueToSource(next) : (next as unknown as T));
			// A sourced write notifies on its own; ringing here too would re-read before the store has committed.
			if (!storeSubscribe && !storeField) notify.current();
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

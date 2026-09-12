import { useStoreField } from '@sim/hooks/useStoreField';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { AnyInputConfig } from '@ui-kit/input';
import { useCallback, useRef, useState } from 'react';

export interface InputState<T, V = T> {
	value: V;
	setValue: (next: V) => void;
	/** `showWhen` said no, so the picker renders nothing. */
	hidden: boolean;
	disabled: boolean;
	/** Increments on every notification, including ones that leave the value unchanged. */
	revision: number;
}

/** One identity for every controlled input: `useStoreSubscribe` caches whatever its read returns, and a fresh object per read is the loop React warns about. */
const CONTROLLED_SNAPSHOT: { value: unknown; revision: number } = Object.freeze({ value: undefined, revision: 0 });

export const useInput = <ModObject, T, V = T>(modObject: ModObject, config: AnyInputConfig<ModObject, T, V>): InputState<T, V> => {
	const configRef = useRef(config);
	configRef.current = config;

	// `defaultValue` seeds the input without writing to the source, and the source takes over at the first notification.
	const [seed, setSeed] = useState(() => (config.defaultValue ? config.defaultValue : undefined));
	const revision = useRef(0);
	// Controlled mode has no notification to count, and the pickers that re-assert their DOM value
	// off `revision` still have to do it when a pick leaves the parent's value where it was.
	const [controlledRevision, setControlledRevision] = useState(0);

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

	const snapshot = useStoreSubscribe(subscribe, () => {
		const current = configRef.current;
		return current.getValue ? { value: current.getValue(modObject) as unknown, revision: revision.current } : CONTROLLED_SNAPSHOT;
	});

	const toValue = (src: T): V => (configRef.current.sourceToValue ? configRef.current.sourceToValue(src) : (src as unknown as V));

	const setValue = useCallback(
		(next: V) => {
			const current = configRef.current;
			if (current.onChange) {
				setControlledRevision(previous => previous + 1);
				current.onChange(next);
				return;
			}
			setSeed(undefined);
			const { setValue: write, valueToSource, storeSubscribe, storeField } = current;
			write(modObject, valueToSource ? valueToSource(next) : (next as unknown as T));
			// A sourced write notifies on its own; ringing here too would re-read before the store has committed.
			if (!storeSubscribe && !storeField) notify.current();
		},
		[modObject],
	);

	return {
		value: config.onChange ? config.value : toValue(seed !== undefined ? seed : (snapshot.value as T)),
		setValue,
		hidden: !!config.showWhen && !config.showWhen(modObject),
		disabled: !!config.enableWhen && !config.enableWhen(modObject),
		revision: config.onChange ? controlledRevision : snapshot.revision,
	};
};

// Store-level batching for direct store subscribers.
//
// While a batch is open (depth > 0), listeners registered through
// subscribeGated() are deferred; when the outermost batch closes each pending
// listener fires once, seeing final state. Because subscribeWithSelector only
// invokes a listener when its selected value changed, this yields exactly one
// fire per changed field per batch — freezeAllAndDo semantics without EventIDs.
//
// No imports here on purpose: this module sits at the bottom of the graph.

let depth = 0;
let pending = new Set<() => void>();

function beginBatch() {
	depth++;
}

function endBatch() {
	depth--;
	if (depth > 0) return;
	if (depth < 0) depth = 0;
	const toFire = pending;
	pending = new Set();
	// One failing listener must not starve the others.
	toFire.forEach(fn => {
		try {
			fn();
		} catch (e) {
			console.error('Caught error in batch listener:', e);
		}
	});
}

// Errors inside func are logged, not propagated (same contract as the old
// freezeAllAndDo), and pending listeners are still flushed.
export function batch<T>(func: () => T): T | undefined {
	beginBatch();
	try {
		return func();
	} catch (e) {
		console.error('Caught error in batch:', e);
		return undefined;
	} finally {
		endBatch();
	}
}

type SubscribeWithSelector<S> = <U>(
	selector: (state: S) => U,
	listener: (value: U, prev: U) => void,
	options?: { equalityFn?: (a: U, b: U) => boolean },
) => () => void;

// Subscribes to selector(state) changes; the listener is deferred to the end
// of the enclosing batch (once), or fires immediately when no batch is open.
export function subscribeGated<S, U>(
	subscribe: SubscribeWithSelector<S>,
	selector: (state: S) => U,
	listener: () => void,
	equalityFn: (a: U, b: U) => boolean = Object.is,
): () => void {
	let disposed = false;
	const gated = () => {
		if (disposed) return;
		listener();
	};
	const unsub = subscribe(
		selector,
		() => {
			if (depth > 0) {
				pending.add(gated);
			} else {
				gated();
			}
		},
		{ equalityFn },
	);
	return () => {
		disposed = true;
		pending.delete(gated);
		unsub();
	};
}

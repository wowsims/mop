// Mounts a not-yet-ported `Component` inside the React tree.
import type { Component } from '@ui-kit/component';
import { useEffect, useRef } from 'react';

const NO_DEPS: ReadonlyArray<unknown> = [];

export interface LegacyHostProps<C extends Component> {
	/** Constructs the legacy component into the given parent element. */
	create: (parent: HTMLElement) => C;
	/** Rebuild the component when these change. Defaults to building once. */
	deps?: ReadonlyArray<unknown>;
	className?: string;
}

export function LegacyHost<C extends Component>({ create, deps = NO_DEPS, className }: LegacyHostProps<C>) {
	const hostRef = useRef<HTMLDivElement>(null);

	// Held in a ref so only `deps` decides when the component is rebuilt.
	const createRef = useRef(create);
	createRef.current = create;

	useEffect(() => {
		const parent = hostRef.current;
		if (!parent) return;

		const component = createRef.current(parent);
		return () => {
			component.dispose();
			// dispose() does not detach rootElem, and the host div survives a deps change.
			component.rootElem.remove();
		};
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	return <div ref={hostRef} className={className} />;
}

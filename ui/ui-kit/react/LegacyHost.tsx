// Mounts a not-yet-ported `Component` inside the React tree.
//
// This is what lets the migration run outside-in: React can own the shell while every feature it
// contains is still the existing imperative class. `Component`'s constructor appends its `rootElem`
// to the parent it is given, so the bridge only has to supply a container and tear the component
// down again on unmount.
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

	// `create` is nearly always an inline arrow, so it has a new identity on every render. Holding
	// it in a ref keeps `deps` the only thing that decides when the component is rebuilt.
	const createRef = useRef(create);
	createRef.current = create;

	useEffect(() => {
		const parent = hostRef.current;
		if (!parent) return;

		const component = createRef.current(parent);
		return () => {
			component.dispose();
			// dispose() tears down registered children and dispose callbacks but leaves the node in
			// place — only BaseModal detaches itself. React removes the host div on unmount, but on a
			// deps change the div survives, so the component's own element has to go explicitly.
			component.rootElem.remove();
		};
		// The effect deliberately keys on `deps` alone; see the ref above.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	return <div ref={hostRef} className={className} />;
}
